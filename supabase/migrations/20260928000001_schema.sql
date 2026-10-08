-- Diyetiko — core schema
-- Conventions: uuid pk, created_at/updated_at, owner_id = auth.users.id of the dietitian.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.locale_code as enum ('tr', 'en', 'ar', 'fr');
create type public.translation_status as enum ('draft', 'needs_review', 'reviewed');
create type public.review_status as enum ('needs_review', 'verified');
create type public.client_status as enum ('active', 'paused', 'completed', 'archived');
create type public.lead_kind as enum ('contact', 'wizard', 'professional');
create type public.lead_status as enum ('new', 'contacted', 'converted', 'archived');
create type public.appointment_status as enum ('scheduled', 'done', 'cancelled', 'no_show');
create type public.appointment_kind as enum ('in_person', 'online', 'phone');
create type public.meal_slot as enum ('breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'snack_late');
create type public.program_status as enum ('draft', 'active', 'archived');

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth user) and roles
--   dietitian: the practice owner — the only role that owns data (owner_id)
--   client:    an invited client using the client portal (supabase/migrations/…_04)
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('dietitian', 'client');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text not null default '',
  admin_locale public.locale_code not null default 'tr',
  arabic_digits text not null default 'latn' check (arabic_digits in ('latn', 'arab')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The FIRST account is the dietitian (created by hand in the Supabase dashboard, README).
-- Every later account is a client (created only by the invite flow; sign-ups are disabled).
-- Nobody can change a role afterwards: profiles.role is not writable by users (see grants).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_role public.user_role;
begin
  -- Portal accounts are created by the server with app_metadata.role = 'client' (Admin API):
  -- they are clients even if no dietitian exists yet. Otherwise the first account is the dietitian.
  if coalesce(new.raw_app_meta_data ->> 'role', '') = 'client'
     or exists (select 1 from public.profiles where role = 'dietitian') then
    v_role := 'client';
  else
    v_role := 'dietitian';
  end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), v_role)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The signed-in user's id IF they are the dietitian, else NULL. Every "owner" policy compares
-- owner_id with this, so client accounts can never own, read or change practice data.
create function public.staff_uid() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p where p.id = (select auth.uid()) and p.role = 'dietitian'
$$;

-- ---------------------------------------------------------------------------
-- Clients (special-category personal data under KVKK)
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 160),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 32),
  birth_date date,
  sex text check (sex in ('female', 'male', 'other')),
  height_cm real check (height_cm is null or height_cm between 50 and 260),
  goal text check (goal is null or char_length(goal) <= 2000),
  goal_weight_kg real check (goal_weight_kg is null or goal_weight_kg between 20 and 400),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  allergies text check (allergies is null or char_length(allergies) <= 2000),
  medical_notes text check (medical_notes is null or char_length(medical_notes) <= 10000),
  preferred_language public.locale_code not null default 'tr',
  status public.client_status not null default 'active',
  tags text[] not null default '{}',
  source text,
  kvkk_consent_at timestamptz,
  kvkk_consent_version text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_owner_idx on public.clients (owner_id, deleted_at, status);
create index clients_name_idx on public.clients (owner_id, lower(full_name));

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg real check (weight_kg is null or weight_kg between 20 and 400),
  body_fat_pct real check (body_fat_pct is null or body_fat_pct between 2 and 75),
  muscle_kg real check (muscle_kg is null or muscle_kg between 5 and 150),
  waist_cm real check (waist_cm is null or waist_cm between 30 and 250),
  hip_cm real check (hip_cm is null or hip_cm between 30 and 250),
  chest_cm real check (chest_cm is null or chest_cm between 30 and 250),
  arm_cm real check (arm_cm is null or arm_cm between 10 and 100),
  thigh_cm real check (thigh_cm is null or thigh_cm between 20 and 150),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index measurements_client_idx on public.measurements (client_id, measured_at);

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 20000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_files_client_idx on public.client_files (client_id);

-- ---------------------------------------------------------------------------
-- Food database (values per 100 g)
-- ---------------------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]+$'),
  category text not null,
  kcal real not null check (kcal >= 0 and kcal <= 900),
  protein_g real not null default 0 check (protein_g >= 0 and protein_g <= 100),
  carb_g real not null default 0 check (carb_g >= 0 and carb_g <= 100),
  fat_g real not null default 0 check (fat_g >= 0 and fat_g <= 100),
  fiber_g real not null default 0 check (fiber_g >= 0 and fiber_g <= 100),
  -- factual composition flags used to derive diet tags: meat, fish, dairy, egg, gluten, honey
  flags text[] not null default '{}',
  -- [{ "key": "piece", "grams": 50 }]
  units jsonb not null default '[]'::jsonb,
  review_status public.review_status not null default 'needs_review',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);

create table public.food_translations (
  food_id uuid not null references public.foods (id) on delete cascade,
  locale public.locale_code not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  translation_status public.translation_status not null default 'needs_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (food_id, locale)
);

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  published boolean not null default false,
  published_at timestamptz,
  illustration text not null default 'lemon',
  cover_path text,
  prep_min integer not null default 10 check (prep_min between 0 and 1440),
  cook_min integer not null default 0 check (cook_min between 0 and 1440),
  servings integer not null default 2 check (servings between 1 and 24),
  meal_types text[] not null default '{}',
  -- cached, recomputed from ingredients by trigger (per serving)
  kcal real not null default 0,
  protein_g real not null default 0,
  carb_g real not null default 0,
  fat_g real not null default 0,
  fiber_g real not null default 0,
  diet_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_published_idx on public.recipes (published, published_at desc);

create table public.recipe_translations (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  locale public.locale_code not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '',
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  tips text,
  translation_status public.translation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (recipe_id, locale),
  unique (locale, slug)
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  grams real not null check (grams > 0 and grams <= 5000),
  unit_key text,
  unit_qty real check (unit_qty is null or unit_qty > 0),
  optional boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_ingredients_food_idx on public.recipe_ingredients (food_id);

-- ---------------------------------------------------------------------------
-- Articles (guides)
-- ---------------------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  published boolean not null default false,
  published_at timestamptz,
  illustration text not null default 'lemon',
  cover_path text,
  category text not null default 'basics',
  reading_min integer not null default 3 check (reading_min between 1 and 60),
  -- [{ "title": "...", "publisher": "...", "url": "https://..." }]
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.article_translations (
  article_id uuid not null references public.articles (id) on delete cascade,
  locale public.locale_code not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text not null default '',
  body text not null default '',
  translation_status public.translation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (article_id, locale),
  unique (locale, slug)
);

-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  is_template boolean not null default false,
  title text not null check (char_length(title) between 1 and 160),
  language public.locale_code not null default 'tr',
  status public.program_status not null default 'draft',
  starts_on date,
  target_kcal real check (target_kcal is null or target_kcal between 800 and 6000),
  target_protein_g real check (target_protein_g is null or target_protein_g between 0 and 500),
  target_carb_g real check (target_carb_g is null or target_carb_g between 0 and 900),
  target_fat_g real check (target_fat_g is null or target_fat_g between 0 and 400),
  notes text,
  hydration text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_owner_idx on public.programs (owner_id, is_template, updated_at desc);
create index programs_client_idx on public.programs (client_id);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  position smallint not null check (position between 0 and 13),
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, position)
);

create table public.program_meals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  day_id uuid not null references public.program_days (id) on delete cascade,
  slot public.meal_slot not null,
  position smallint not null default 0,
  time_label text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index program_meals_day_idx on public.program_meals (day_id, position);

create table public.program_meal_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  meal_id uuid not null references public.program_meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  -- name snapshot in the program language, so the share page never needs other tables
  name text not null check (char_length(name) between 1 and 160),
  grams real check (grams is null or grams > 0),
  unit_key text,
  unit_qty real,
  servings real check (servings is null or servings > 0),
  kcal real not null default 0,
  protein_g real not null default 0,
  carb_g real not null default 0,
  fat_g real not null default 0,
  fiber_g real not null default 0,
  note text,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index program_meal_items_meal_idx on public.program_meal_items (meal_id, position);

create table public.program_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  label text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index program_versions_program_idx on public.program_versions (program_id, created_at desc);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  -- 32 random bytes, base64url → 43 chars
  token text not null unique check (char_length(token) between 43 and 128 and token ~ '^[A-Za-z0-9_-]+$'),
  expires_at timestamptz,
  revoked_at timestamptz,
  show_client_name boolean not null default false,
  allow_pdf boolean not null default true,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index share_links_program_idx on public.share_links (program_id);

-- ---------------------------------------------------------------------------
-- Leads & appointments
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind public.lead_kind not null,
  name text not null check (char_length(name) between 1 and 160),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 32),
  organization text check (organization is null or char_length(organization) <= 160),
  message text check (message is null or char_length(message) <= 4000),
  payload jsonb not null default '{}'::jsonb,
  locale public.locale_code not null default 'tr',
  consent_at timestamptz not null,
  consent_version text not null,
  status public.lead_status not null default 'new',
  converted_client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_owner_idx on public.leads (owner_id, status, created_at desc);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  title text,
  starts_at timestamptz not null,
  duration_min integer not null default 45 check (duration_min between 5 and 480),
  kind public.appointment_kind not null default 'in_person',
  status public.appointment_status not null default 'scheduled',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_owner_idx on public.appointments (owner_id, starts_at);

-- ---------------------------------------------------------------------------
-- Site settings (+ per-locale data)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  is_public boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_setting_translations (
  key text not null references public.site_settings (key) on delete cascade,
  locale public.locale_code not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  translation_status public.translation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

-- ---------------------------------------------------------------------------
-- Audit log (append-only) and rate limits (service only)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  actor_id uuid default auth.uid(),
  action text not null check (action ~ '^[a-z_.]+$'),
  entity text not null,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_owner_idx on public.audit_log (owner_id, created_at desc);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'clients', 'measurements', 'client_notes', 'client_files', 'foods', 'food_translations',
    'recipes', 'recipe_translations', 'recipe_ingredients', 'articles', 'article_translations',
    'programs', 'program_days', 'program_meals', 'program_meal_items', 'program_versions',
    'share_links', 'leads', 'appointments', 'site_settings', 'site_setting_translations'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
