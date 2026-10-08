-- Row Level Security: every table, owner-only by default. "Owner" means the DIETITIAN:
-- policies compare owner_id with public.staff_uid(), which is NULL for client accounts, so a
-- client can never create, read or change practice data (they use the portal functions in _04).
-- Anonymous visitors can read ONLY published recipes/articles (+ their translations,
-- ingredients and the foods those use) and public site settings. Leads are inserted by a
-- server action with the service role — anon has no write access to any table.

-- ---------------------------------------------------------------------------
-- Grants (explicit; do not rely on platform default privileges)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

grant select on
  public.recipes, public.recipe_translations, public.recipe_ingredients,
  public.foods, public.food_translations,
  public.articles, public.article_translations,
  public.site_settings, public.site_setting_translations
to anon;

-- rate_limits is service-only; audit_log is append-only for authenticated.
revoke all on public.rate_limits from authenticated;
revoke update, delete on public.audit_log from authenticated;

-- A user may edit their own name/preferences, never their role (no self-promotion to dietitian).
revoke update on public.profiles from authenticated;
grant update (full_name, admin_locale, arabic_digits) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'clients', 'measurements', 'client_notes', 'client_files', 'foods', 'food_translations',
    'recipes', 'recipe_translations', 'recipe_ingredients', 'articles', 'article_translations',
    'programs', 'program_days', 'program_meals', 'program_meal_items', 'program_versions',
    'share_links', 'leads', 'appointments', 'site_settings', 'site_setting_translations',
    'audit_log', 'rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY INVOKER — they run under the caller's RLS)
-- ---------------------------------------------------------------------------
create function public.owns_client(p_client_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.clients c where c.id = p_client_id and c.owner_id = (select public.staff_uid()));
$$;

create function public.owns_program(p_program_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.programs p where p.id = p_program_id and p.owner_id = (select public.staff_uid()));
$$;

create function public.owns_recipe(p_recipe_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.recipes r where r.id = p_recipe_id and r.owner_id = (select public.staff_uid()));
$$;

-- ---------------------------------------------------------------------------
-- profiles: a user sees and edits only their own profile
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Plain owner tables (no parent)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients', 'foods', 'recipes', 'articles', 'programs', 'leads', 'site_settings'] loop
    execute format($f$
      create policy %1$s_owner_select on public.%1$I for select to authenticated using (owner_id = (select public.staff_uid()));
      create policy %1$s_owner_insert on public.%1$I for insert to authenticated with check (owner_id = (select public.staff_uid()));
      create policy %1$s_owner_update on public.%1$I for update to authenticated
        using (owner_id = (select public.staff_uid())) with check (owner_id = (select public.staff_uid()));
      create policy %1$s_owner_delete on public.%1$I for delete to authenticated using (owner_id = (select public.staff_uid()));
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Child tables: owner AND parent must belong to the same owner (no cross-tenant references)
-- ---------------------------------------------------------------------------
do $$
declare
  spec text[];
  specs text[][] := array[
    array['measurements', 'public.owns_client(client_id)'],
    array['client_notes', 'public.owns_client(client_id)'],
    array['client_files', 'public.owns_client(client_id)'],
    array['program_days', 'public.owns_program(program_id)'],
    array['program_meals', 'public.owns_program(program_id)'],
    array['program_meal_items', 'public.owns_program(program_id)'],
    array['program_versions', 'public.owns_program(program_id)'],
    array['share_links', 'public.owns_program(program_id)'],
    array['recipe_translations', 'public.owns_recipe(recipe_id)'],
    array['recipe_ingredients', 'public.owns_recipe(recipe_id)'],
    array['appointments', '(client_id is null or public.owns_client(client_id))'],
    array['food_translations', 'exists (select 1 from public.foods f where f.id = food_id and f.owner_id = (select public.staff_uid()))'],
    array['article_translations', 'exists (select 1 from public.articles a where a.id = article_id and a.owner_id = (select public.staff_uid()))'],
    array['site_setting_translations', 'exists (select 1 from public.site_settings s where s.key = site_setting_translations.key and s.owner_id = (select public.staff_uid()))']
  ];
begin
  foreach spec slice 1 in array specs loop
    execute format($f$
      create policy %1$s_owner_select on public.%1$I for select to authenticated using (owner_id = (select public.staff_uid()));
      create policy %1$s_owner_insert on public.%1$I for insert to authenticated
        with check (owner_id = (select public.staff_uid()) and %2$s);
      create policy %1$s_owner_update on public.%1$I for update to authenticated
        using (owner_id = (select public.staff_uid())) with check (owner_id = (select public.staff_uid()) and %2$s);
      create policy %1$s_owner_delete on public.%1$I for delete to authenticated using (owner_id = (select public.staff_uid()));
    $f$, spec[1], spec[2]);
  end loop;
end $$;

-- audit_log: insert + read own; never update/delete (no policy → denied)
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (owner_id = (select public.staff_uid()) and actor_id = (select public.staff_uid()));
create policy audit_log_select on public.audit_log for select to authenticated
  using (owner_id = (select public.staff_uid()));

-- rate_limits: no policies at all → only service_role (bypasses RLS) can touch it.

-- ---------------------------------------------------------------------------
-- Public read (anon + authenticated visitors)
-- ---------------------------------------------------------------------------
create policy recipes_public_read on public.recipes for select to anon, authenticated
  using (published);

create policy recipe_translations_public_read on public.recipe_translations for select to anon, authenticated
  using (
    translation_status <> 'draft'
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.published)
  );

create policy recipe_ingredients_public_read on public.recipe_ingredients for select to anon, authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.published));

create policy foods_public_read on public.foods for select to anon, authenticated
  using (exists (
    select 1 from public.recipe_ingredients ri
    join public.recipes r on r.id = ri.recipe_id
    where ri.food_id = foods.id and r.published
  ));

create policy food_translations_public_read on public.food_translations for select to anon, authenticated
  using (exists (
    select 1 from public.recipe_ingredients ri
    join public.recipes r on r.id = ri.recipe_id
    where ri.food_id = food_translations.food_id and r.published
  ));

create policy articles_public_read on public.articles for select to anon, authenticated
  using (published);

create policy article_translations_public_read on public.article_translations for select to anon, authenticated
  using (
    translation_status <> 'draft'
    and exists (select 1 from public.articles a where a.id = article_id and a.published)
  );

create policy site_settings_public_read on public.site_settings for select to anon, authenticated
  using (is_public);

create policy site_setting_translations_public_read on public.site_setting_translations for select to anon, authenticated
  using (
    translation_status <> 'draft'
    and exists (select 1 from public.site_settings s where s.key = site_setting_translations.key and s.is_public)
  );
