-- Functions: shared-program resolution, recipe nutrition cache, rate limiting, storage.

-- ---------------------------------------------------------------------------
-- Recipe nutrition + diet flags, derived from ingredients (never typed by hand)
-- ---------------------------------------------------------------------------
create function public.recompute_recipe(p_recipe_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_servings integer;
begin
  select servings into v_servings from public.recipes where id = p_recipe_id;
  if v_servings is null then return; end if;

  update public.recipes r set
    kcal      = coalesce(agg.kcal, 0) / v_servings,
    protein_g = coalesce(agg.protein, 0) / v_servings,
    carb_g    = coalesce(agg.carb, 0) / v_servings,
    fat_g     = coalesce(agg.fat, 0) / v_servings,
    fiber_g   = coalesce(agg.fiber, 0) / v_servings,
    diet_flags = array_remove(array[
      case when not coalesce(agg.flags && array['meat', 'fish'], false) then 'vegetarian' end,
      case when not coalesce(agg.flags && array['meat', 'fish', 'dairy', 'egg', 'honey'], false) then 'vegan' end,
      case when not coalesce(agg.flags && array['gluten'], false) then 'gluten_free' end,
      case when not coalesce(agg.flags && array['dairy'], false) then 'dairy_free' end
    ], null)
  from (
    select
      sum(f.kcal * ri.grams / 100) as kcal,
      sum(f.protein_g * ri.grams / 100) as protein,
      sum(f.carb_g * ri.grams / 100) as carb,
      sum(f.fat_g * ri.grams / 100) as fat,
      sum(f.fiber_g * ri.grams / 100) as fiber,
      coalesce(array_agg(distinct fl) filter (where fl is not null), '{}') as flags
    from public.recipe_ingredients ri
    join public.foods f on f.id = ri.food_id
    left join lateral unnest(f.flags) fl on true
    where ri.recipe_id = p_recipe_id and not ri.optional
  ) agg
  where r.id = p_recipe_id;
end $$;

create function public.on_recipe_ingredient_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.recompute_recipe(old.recipe_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.recompute_recipe(new.recipe_id); end if;
  return null;
end $$;

create trigger recipe_ingredients_recompute
  after insert or update or delete on public.recipe_ingredients
  for each row execute function public.on_recipe_ingredient_change();

create function public.on_recipe_servings_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.servings is distinct from old.servings then perform public.recompute_recipe(new.id); end if;
  return null;
end $$;

create trigger recipes_servings_recompute
  after update of servings on public.recipes
  for each row execute function public.on_recipe_servings_change();

create function public.on_food_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  for r in select distinct recipe_id from public.recipe_ingredients where food_id = new.id loop
    perform public.recompute_recipe(r);
  end loop;
  return null;
end $$;

create trigger foods_recompute
  after update of kcal, protein_g, carb_g, fat_g, fiber_g, flags on public.foods
  for each row execute function public.on_food_change();

revoke all on function public.recompute_recipe(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Program payload: the client-facing view of one program (content, targets, notes for the
-- client). Used by the share link AND the client portal, so both show exactly the same thing.
-- Internal: not executable by users directly (only through the definer functions below).
-- ---------------------------------------------------------------------------
create function public.program_payload(p_program_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'language', p.language,
    'startsOn', p.starts_on,
    'updatedAt', p.updated_at,
    'notes', p.notes,
    'hydration', p.hydration,
    'targets', jsonb_build_object(
      'kcal', p.target_kcal,
      'protein', p.target_protein_g,
      'carb', p.target_carb_g,
      'fat', p.target_fat_g
    ),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', d.position,
        'label', d.label,
        'meals', coalesce((
          select jsonb_agg(jsonb_build_object(
            'slot', m.slot,
            'time', m.time_label,
            'note', m.note,
            'items', coalesce((
              select jsonb_agg(jsonb_build_object(
                'name', i.name,
                'foodId', i.food_id,
                'recipeId', i.recipe_id,
                'grams', i.grams,
                'unitKey', i.unit_key,
                'unitQty', i.unit_qty,
                'servings', i.servings,
                'kcal', i.kcal,
                'protein', i.protein_g,
                'carb', i.carb_g,
                'fat', i.fat_g,
                'fiber', i.fiber_g,
                'note', i.note
              ) order by i.position)
              from public.program_meal_items i where i.meal_id = m.id
            ), '[]'::jsonb)
          ) order by m.position, m.slot)
          from public.program_meals m where m.day_id = d.id
        ), '[]'::jsonb)
      ) order by d.position)
      from public.program_days d where d.program_id = p.id
    ), '[]'::jsonb)
  )
  from public.programs p
  where p.id = p_program_id
$$;
revoke all on function public.program_payload(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared program resolution (the ONLY way a share token reaches data)
-- Returns a sanitized DTO: no medical notes, contact data, measurements or other clients.
-- ---------------------------------------------------------------------------
create function public.get_shared_program(p_token text, p_count_view boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.share_links;
  v_program public.programs;
  v_first_name text;
begin
  if p_token is null or char_length(p_token) not between 43 and 128 or p_token !~ '^[A-Za-z0-9_-]+$' then
    return null;
  end if;

  select * into v_link from public.share_links where token = p_token;
  if not found
     or v_link.revoked_at is not null
     or (v_link.expires_at is not null and v_link.expires_at <= now()) then
    return null;
  end if;

  select * into v_program from public.programs
  where id = v_link.program_id and owner_id = v_link.owner_id;
  if not found then return null; end if;

  if v_link.show_client_name and v_program.client_id is not null then
    select split_part(btrim(c.full_name), ' ', 1) into v_first_name
    from public.clients c
    where c.id = v_program.client_id and c.deleted_at is null;
  end if;

  if p_count_view then
    update public.share_links
    set view_count = view_count + 1, last_viewed_at = now()
    where id = v_link.id;
  end if;

  return public.program_payload(v_program.id) - 'id' || jsonb_build_object(
    'expiresAt', v_link.expires_at,
    'allowPdf', v_link.allow_pdf,
    'clientFirstName', v_first_name
  );
end $$;

revoke all on function public.get_shared_program(text, boolean) from public;
grant execute on function public.get_shared_program(text, boolean) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Keys are hashes — never raw IPs.
-- Returns true when the call is allowed.
-- ---------------------------------------------------------------------------
create function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_max;
end $$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Storage buckets & policies
-- Paths: <owner uuid>/<...>. client-files is private (signed URLs only). Only the dietitian
-- (staff_uid) may write — a client account must never be able to host files in public buckets.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('recipe-media', 'recipe-media', true),
  ('site-media', 'site-media', true),
  ('client-files', 'client-files', false)
on conflict (id) do nothing;

create policy "media owner write" on storage.objects for insert to authenticated
  with check (bucket_id in ('recipe-media', 'site-media', 'client-files')
              and (storage.foldername(name))[1] = (select public.staff_uid())::text);

create policy "media owner update" on storage.objects for update to authenticated
  using (bucket_id in ('recipe-media', 'site-media', 'client-files')
         and (storage.foldername(name))[1] = (select public.staff_uid())::text);

create policy "media owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('recipe-media', 'site-media', 'client-files')
         and (storage.foldername(name))[1] = (select public.staff_uid())::text);

create policy "client files owner read" on storage.objects for select to authenticated
  using (bucket_id = 'client-files' and (storage.foldername(name))[1] = (select public.staff_uid())::text);

create policy "public media read" on storage.objects for select to anon, authenticated
  using (bucket_id in ('recipe-media', 'site-media'));
