-- Client portal: invited clients sign in to see their program and progress, and to keep a food
-- diary (with meal photos), daily check-ins (weight, water, habits) and messages with the dietitian.
--
-- Access model
--   * Practice data (clients, programs, measurements, notes, files…) stays dietitian-only (_02).
--     Clients read the parts meant for them ONLY through the SECURITY DEFINER portal_* functions,
--     which return sanitized DTOs for their own linked client record (no internal notes).
--   * Client-written data (check-ins, diary, messages) lives in the tables below, with RLS for the
--     client (own rows) and the dietitian (own practice). owner_id always comes from the client
--     record (trigger), never from the request. Diary nutrition values are computed here from the
--     food database — a client cannot submit their own numbers.
--   * No explicit consent (KVKK: health data) → my_client_id() is NULL → no portal data at all.
--   * Accounts are created only through single-use, expiring invites (token stored as SHA-256).

-- ---------------------------------------------------------------------------
-- Link a client record to its portal account + consent
-- ---------------------------------------------------------------------------
alter table public.clients
  add column user_id uuid unique references auth.users (id) on delete set null,
  add column portal_consent_at timestamptz,
  add column portal_consent_version text;

-- The dietitian edits client records, but the account link and the client's own consent are set
-- only by the invite / consent functions below (column-level privileges).
revoke insert, update on public.clients from authenticated;
grant insert (id, full_name, email, phone, birth_date, sex, height_cm, goal, goal_weight_kg, activity_level, allergies,
              medical_notes, preferred_language, status, tags, source, kvkk_consent_at, kvkk_consent_version)
  on public.clients to authenticated;
grant update (full_name, email, phone, birth_date, sex, height_cm, goal, goal_weight_kg, activity_level, allergies,
              medical_notes, preferred_language, status, tags, source, kvkk_consent_at, kvkk_consent_version, deleted_at)
  on public.clients to authenticated;

-- The signed-in client's own client id — only while linked, active and consented.
create function public.my_client_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id
  from public.clients c
  join public.profiles p on p.id = c.user_id and p.role = 'client'
  where c.user_id = (select auth.uid())
    and c.deleted_at is null
    and c.portal_consent_at is not null
$$;

-- Storage folder of the signed-in client's photos: "<dietitian id>/<client id>/".
create function public.my_photo_prefix() returns text
language sql stable security definer set search_path = '' as $$
  select c.owner_id::text || '/' || c.id::text || '/' from public.clients c where c.id = public.my_client_id()
$$;

-- ---------------------------------------------------------------------------
-- Invites (dietitian → client). Only the SHA-256 of the token is stored.
-- ---------------------------------------------------------------------------
create table public.client_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  purpose text not null check (purpose in ('invite', 'reset')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_invites_client_idx on public.client_invites (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Habits the dietitian sets per client (e.g. "Kahvaltı yap", "30 dk yürüyüş")
-- ---------------------------------------------------------------------------
create table public.client_habits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  position smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_habits_client_idx on public.client_habits (client_id, position);

-- ---------------------------------------------------------------------------
-- Daily check-in (client-written): weight, water, habits done, energy, a short note
-- ---------------------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  day date not null,
  weight_kg real check (weight_kg is null or weight_kg between 20 and 400),
  water_ml integer check (water_ml is null or water_ml between 0 and 10000),
  habits uuid[] not null default '{}',
  energy smallint check (energy is null or energy between 1 and 5),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, day)
);
create index checkins_owner_idx on public.checkins (owner_id, day desc);

-- ---------------------------------------------------------------------------
-- Food diary (client-written): one record per meal slot per day, items inside
-- ---------------------------------------------------------------------------
create table public.diary_meals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  eaten_on date not null,
  slot public.meal_slot not null,
  time_label text check (time_label is null or time_label ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  note text check (note is null or char_length(note) <= 1000),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, eaten_on, slot)
);
create index diary_meals_owner_idx on public.diary_meals (owner_id, created_at desc);
create index diary_meals_client_idx on public.diary_meals (client_id, eaten_on);

create table public.diary_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  meal_id uuid not null references public.diary_meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  grams real check (grams is null or (grams > 0 and grams <= 5000)),
  unit_key text,
  unit_qty real check (unit_qty is null or (unit_qty > 0 and unit_qty <= 100)),
  servings real check (servings is null or (servings > 0 and servings <= 20)),
  -- computed by trigger from the food database; NULL for free-text items (unknown values)
  kcal real,
  protein_g real,
  carb_g real,
  fat_g real,
  fiber_g real,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index diary_items_meal_idx on public.diary_items (meal_id, position);

-- ---------------------------------------------------------------------------
-- Messages between client and dietitian (asynchronous notes, not a chat)
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  author text not null check (author in ('client', 'dietitian')),
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  diary_meal_id uuid references public.diary_meals (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_client_idx on public.messages (client_id, created_at);
create index messages_unread_idx on public.messages (owner_id, author, read_at);

-- ---------------------------------------------------------------------------
-- Triggers: owner from the client record; integrity checks; nutrition from the food database
-- ---------------------------------------------------------------------------
create function public.portal_set_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select c.owner_id into new.owner_id from public.clients c where c.id = new.client_id;
  if new.owner_id is null then
    raise exception 'client not found' using errcode = '23503';
  end if;
  return new;
end $$;

create trigger portal_set_owner before insert on public.checkins for each row execute function public.portal_set_owner();
create trigger portal_set_owner before insert on public.diary_meals for each row execute function public.portal_set_owner();

create function public.checkin_validate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.client_id is distinct from old.client_id then
      raise exception 'client_id cannot change' using errcode = '42501';
    end if;
    new.owner_id := old.owner_id; -- never re-parented by the client
  end if;
  -- only habits that belong to this client
  if exists (
    select 1 from unnest(new.habits) h
    where not exists (select 1 from public.client_habits ch where ch.id = h and ch.client_id = new.client_id)
  ) then
    raise exception 'unknown habit' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger checkin_validate before insert or update on public.checkins for each row execute function public.checkin_validate();

create function public.diary_meal_validate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.client_id is distinct from old.client_id then
      raise exception 'client_id cannot change' using errcode = '42501';
    end if;
    new.owner_id := old.owner_id; -- never re-parented by the client
  end if;
  if new.photo_path is not null and not starts_with(new.photo_path, new.owner_id::text || '/' || new.client_id::text || '/') then
    raise exception 'photo path outside the client folder' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger diary_meal_validate before insert or update on public.diary_meals for each row execute function public.diary_meal_validate();

-- Items inherit client/owner from their meal, and get nutrition from the dietitian's food DB
-- (grams / unit) or recipe (servings × per-serving values). Free text: values stay NULL.
create function public.diary_item_compute() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_food public.foods;
  v_recipe public.recipes;
  v_unit_grams real;
  v_grams real;
begin
  select m.client_id, m.owner_id into new.client_id, new.owner_id from public.diary_meals m where m.id = new.meal_id;
  if new.client_id is null then
    raise exception 'diary meal not found' using errcode = '23503';
  end if;

  if new.recipe_id is not null then
    select * into v_recipe from public.recipes r where r.id = new.recipe_id and r.owner_id = new.owner_id;
    if not found then
      raise exception 'recipe not available' using errcode = '23503';
    end if;
    new.food_id := null;
    new.grams := null; new.unit_key := null; new.unit_qty := null;
    new.servings := coalesce(new.servings, 1);
    new.kcal := round((v_recipe.kcal * new.servings)::numeric, 1);
    new.protein_g := round((v_recipe.protein_g * new.servings)::numeric, 1);
    new.carb_g := round((v_recipe.carb_g * new.servings)::numeric, 1);
    new.fat_g := round((v_recipe.fat_g * new.servings)::numeric, 1);
    new.fiber_g := round((v_recipe.fiber_g * new.servings)::numeric, 1);
    return new;
  end if;
  new.servings := null;

  if new.food_id is null then
    new.kcal := null; new.protein_g := null; new.carb_g := null; new.fat_g := null; new.fiber_g := null;
    return new;
  end if;

  select * into v_food from public.foods f where f.id = new.food_id and f.owner_id = new.owner_id;
  if not found then
    raise exception 'food not available' using errcode = '23503';
  end if;

  if new.unit_key is not null then
    select (u ->> 'grams')::real into v_unit_grams
    from jsonb_array_elements(v_food.units) u where u ->> 'key' = new.unit_key;
    if v_unit_grams is null or new.unit_qty is null then
      raise exception 'unknown unit' using errcode = '22023';
    end if;
    v_grams := v_unit_grams * new.unit_qty;
  else
    v_grams := new.grams;
  end if;
  if v_grams is null or v_grams <= 0 or v_grams > 5000 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;

  new.grams := round(v_grams::numeric, 1);
  new.kcal := round((v_food.kcal * v_grams / 100)::numeric, 1);
  new.protein_g := round((v_food.protein_g * v_grams / 100)::numeric, 1);
  new.carb_g := round((v_food.carb_g * v_grams / 100)::numeric, 1);
  new.fat_g := round((v_food.fat_g * v_grams / 100)::numeric, 1);
  new.fiber_g := round((v_food.fiber_g * v_grams / 100)::numeric, 1);
  return new;
end $$;
create trigger diary_item_compute before insert or update on public.diary_items for each row execute function public.diary_item_compute();

create function public.message_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select c.owner_id into new.owner_id from public.clients c where c.id = new.client_id;
  if new.owner_id is null then
    raise exception 'client not found' using errcode = '23503';
  end if;
  new.author_id := (select auth.uid());
  new.read_at := null;
  new.created_at := now();
  if new.diary_meal_id is not null and not exists (
    select 1 from public.diary_meals m where m.id = new.diary_meal_id and m.client_id = new.client_id
  ) then
    raise exception 'diary meal of another client' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger message_prepare before insert on public.messages for each row execute function public.message_prepare();

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.client_invites, public.client_habits, public.checkins,
  public.diary_meals, public.diary_items to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
grant all on public.client_invites, public.client_habits, public.checkins, public.diary_meals,
  public.diary_items, public.messages to service_role;

alter table public.client_invites enable row level security;
alter table public.client_habits enable row level security;
alter table public.checkins enable row level security;
alter table public.diary_meals enable row level security;
alter table public.diary_items enable row level security;
alter table public.messages enable row level security;

-- Invites: dietitian only (clients never see them; redemption is a service-side function).
create policy client_invites_owner_select on public.client_invites for select to authenticated
  using (owner_id = (select public.staff_uid()));
create policy client_invites_owner_insert on public.client_invites for insert to authenticated
  with check (owner_id = (select public.staff_uid()) and public.owns_client(client_id));
create policy client_invites_owner_delete on public.client_invites for delete to authenticated
  using (owner_id = (select public.staff_uid()));

-- Habits: the dietitian manages them; the client reads their own active habits.
create policy client_habits_owner_all on public.client_habits for all to authenticated
  using (owner_id = (select public.staff_uid()))
  with check (owner_id = (select public.staff_uid()) and public.owns_client(client_id));
create policy client_habits_client_select on public.client_habits for select to authenticated
  using (client_id = (select public.my_client_id()) and active);

-- Client-written tables: the client has full control of their own rows; the dietitian reads.
do $$
declare t text;
begin
  foreach t in array array['checkins', 'diary_meals', 'diary_items'] loop
    execute format($f$
      create policy %1$s_client_select on public.%1$I for select to authenticated
        using (client_id = (select public.my_client_id()));
      create policy %1$s_client_insert on public.%1$I for insert to authenticated
        with check (client_id = (select public.my_client_id()));
      create policy %1$s_client_update on public.%1$I for update to authenticated
        using (client_id = (select public.my_client_id())) with check (client_id = (select public.my_client_id()));
      create policy %1$s_client_delete on public.%1$I for delete to authenticated
        using (client_id = (select public.my_client_id()));
      create policy %1$s_owner_select on public.%1$I for select to authenticated
        using (owner_id = (select public.staff_uid()));
    $f$, t);
  end loop;
end $$;

-- Messages: each side writes as itself; nobody edits a message. read_at is the only update.
create policy messages_client_select on public.messages for select to authenticated
  using (client_id = (select public.my_client_id()));
create policy messages_client_insert on public.messages for insert to authenticated
  with check (client_id = (select public.my_client_id()) and author = 'client');
create policy messages_owner_select on public.messages for select to authenticated
  using (owner_id = (select public.staff_uid()));
create policy messages_owner_insert on public.messages for insert to authenticated
  with check (owner_id = (select public.staff_uid()) and author = 'dietitian' and public.owns_client(client_id));
create policy messages_owner_update on public.messages for update to authenticated
  using (owner_id = (select public.staff_uid()) and author = 'client')
  with check (owner_id = (select public.staff_uid()) and author = 'client');
create policy messages_owner_delete on public.messages for delete to authenticated
  using (owner_id = (select public.staff_uid()) and author = 'dietitian');

-- ---------------------------------------------------------------------------
-- Portal functions (client side). Each returns data ONLY for the caller's own client record.
-- ---------------------------------------------------------------------------

-- Who am I in the portal? NULL when the account is not a linked client.
create function public.portal_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'clientId', c.id,
    'firstName', split_part(btrim(c.full_name), ' ', 1),
    'locale', c.preferred_language,
    'consented', c.portal_consent_at is not null,
    'active', c.deleted_at is null
  )
  from public.clients c
  join public.profiles p on p.id = c.user_id and p.role = 'client'
  where c.user_id = (select auth.uid())
$$;

-- Explicit consent (KVKK, special-category data). Required before any portal data exists.
create function public.portal_give_consent(p_version text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_version is null or char_length(p_version) not between 1 and 40 then
    raise exception 'consent version required' using errcode = '22023';
  end if;
  update public.clients c
     set portal_consent_at = now(), portal_consent_version = p_version
   where c.user_id = (select auth.uid()) and c.deleted_at is null
     and exists (select 1 from public.profiles p where p.id = c.user_id and p.role = 'client');
  return found;
end $$;

-- Withdrawing consent stops all portal processing at once (my_client_id() becomes NULL).
create function public.portal_withdraw_consent() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.clients c set portal_consent_at = null, portal_consent_version = null
   where c.user_id = (select auth.uid())
     and exists (select 1 from public.profiles p where p.id = c.user_id and p.role = 'client');
  return found;
end $$;

-- Profile facts the client may see (no medical notes, tags, source, internal fields).
create function public.portal_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'fullName', c.full_name,
    'firstName', split_part(btrim(c.full_name), ' ', 1),
    'email', c.email,
    'locale', c.preferred_language,
    'heightCm', c.height_cm,
    'goal', c.goal,
    'goalWeightKg', c.goal_weight_kg,
    'dietitianName', nullif(p.full_name, '')
  )
  from public.clients c
  join public.profiles p on p.id = c.owner_id
  where c.id = public.my_client_id()
$$;

-- The client's current program (latest active, not a template), same shape as a share link.
create function public.portal_program() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.program_payload(p.id)
  from public.programs p
  where p.client_id = public.my_client_id() and p.status = 'active' and not p.is_template
  order by p.updated_at desc
  limit 1
$$;

-- Clinic measurements (no internal notes).
create function public.portal_measurements() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', m.measured_at,
    'weightKg', m.weight_kg,
    'bodyFatPct', m.body_fat_pct,
    'muscleKg', m.muscle_kg,
    'waistCm', m.waist_cm,
    'hipCm', m.hip_cm
  ) order by m.measured_at), '[]'::jsonb)
  from public.measurements m
  where m.client_id = public.my_client_id()
$$;

-- Appointments (time, kind, status only — no internal note or title).
create function public.portal_appointments() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'startsAt', a.starts_at,
    'durationMin', a.duration_min,
    'kind', a.kind,
    'status', a.status
  ) order by a.starts_at), '[]'::jsonb)
  from public.appointments a
  where a.client_id = public.my_client_id()
    and a.starts_at > now() - interval '60 days'
$$;

-- The dietitian's food database, named in the requested language (fallback: en, then tr).
create function public.portal_foods(p_locale public.locale_code) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'key', f.key,
    'category', f.category,
    'name', coalesce(
      (select t.name from public.food_translations t where t.food_id = f.id and t.locale = p_locale),
      (select t.name from public.food_translations t where t.food_id = f.id and t.locale = 'en'),
      (select t.name from public.food_translations t where t.food_id = f.id and t.locale = 'tr'),
      f.key),
    'kcal', f.kcal,
    'protein', f.protein_g,
    'carb', f.carb_g,
    'fat', f.fat_g,
    'units', f.units
  ) order by f.category, f.key), '[]'::jsonb)
  from public.foods f
  join public.clients c on c.owner_id = f.owner_id
  where c.id = public.my_client_id()
$$;

-- Mark the dietitian's messages as read (the client cannot edit messages otherwise).
create function public.portal_mark_read() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.messages set read_at = now()
   where client_id = public.my_client_id() and author = 'dietitian' and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Invite redemption (server side, service role only)
-- ---------------------------------------------------------------------------

-- What a still-valid invite is for. NULL when unknown, used or expired.
create function public.peek_client_invite(p_token_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'purpose', i.purpose,
    'clientId', c.id,
    'email', c.email,
    'firstName', split_part(btrim(c.full_name), ' ', 1),
    'locale', c.preferred_language,
    'userId', c.user_id,
    'expiresAt', i.expires_at
  )
  from public.client_invites i
  join public.clients c on c.id = i.client_id and c.deleted_at is null
  where i.token_hash = p_token_hash and i.used_at is null and i.expires_at > now()
$$;

-- Consume an invite. For 'invite' it links p_user_id to the client record (the account was just
-- created by the server); for 'reset' it only marks the link used. All other open links of the
-- client are closed too. Returns the client id, or raises.
create function public.redeem_client_invite(p_token_hash text, p_user_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.client_invites;
begin
  select * into v from public.client_invites
   where token_hash = p_token_hash and used_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'invalid or expired invite' using errcode = '22023';
  end if;

  if v.purpose = 'invite' then
    if p_user_id is null then
      raise exception 'user required' using errcode = '22023';
    end if;
    update public.clients set user_id = p_user_id where id = v.client_id and deleted_at is null and user_id is null;
    if not found then
      raise exception 'client already linked or archived' using errcode = '22023';
    end if;
    update public.profiles set role = 'client' where id = p_user_id;
  end if;

  update public.client_invites set used_at = now() where client_id = v.client_id and used_at is null;
  return v.client_id;
end $$;

revoke all on function public.peek_client_invite(text) from public, anon, authenticated;
revoke all on function public.redeem_client_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.peek_client_invite(text) to service_role;
grant execute on function public.redeem_client_invite(text, uuid) to service_role;

revoke all on function public.portal_status(), public.portal_give_consent(text), public.portal_withdraw_consent(),
  public.portal_profile(), public.portal_program(), public.portal_measurements(), public.portal_appointments(),
  public.portal_foods(public.locale_code), public.portal_mark_read() from public, anon;
grant execute on function public.portal_status(), public.portal_give_consent(text), public.portal_withdraw_consent(),
  public.portal_profile(), public.portal_program(), public.portal_measurements(), public.portal_appointments(),
  public.portal_foods(public.locale_code), public.portal_mark_read() to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.client_invites for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.client_habits for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.checkins for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.diary_meals for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.diary_items for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Meal photos: private bucket, "<dietitian id>/<client id>/<uuid>.jpg"
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('diary-photos', 'diary-photos', false)
on conflict (id) do nothing;

create policy "diary photos client write" on storage.objects for insert to authenticated
  with check (bucket_id = 'diary-photos' and starts_with(name, (select public.my_photo_prefix())));
create policy "diary photos client read" on storage.objects for select to authenticated
  using (bucket_id = 'diary-photos' and starts_with(name, (select public.my_photo_prefix())));
create policy "diary photos client delete" on storage.objects for delete to authenticated
  using (bucket_id = 'diary-photos' and starts_with(name, (select public.my_photo_prefix())));
create policy "diary photos dietitian read" on storage.objects for select to authenticated
  using (bucket_id = 'diary-photos' and (storage.foldername(name))[1] = (select public.staff_uid())::text);
create policy "diary photos dietitian delete" on storage.objects for delete to authenticated
  using (bucket_id = 'diary-photos' and (storage.foldername(name))[1] = (select public.staff_uid())::text);
