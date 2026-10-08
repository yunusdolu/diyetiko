-- RLS proof for `supabase test db` (pgTAP). Mirrors supabase/tests/rls.test.ts, which runs the
-- same migrations on PGlite in CI/local (`pnpm db:test`). Everything happens in one transaction
-- and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- ── fixtures ─────────────────────────────────────────────────────────────────
-- Owner A and owner B (two independent tenants), inserted as postgres.
insert into auth.users (id, email) values
  ('0a000000-0000-4000-8000-00000000000a', 'a@test'),
  ('0b000000-0000-4000-8000-00000000000b', 'b@test');

-- Everything below is created *as owner A*, through RLS.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into clients (id, full_name, email, phone, medical_notes)
values ('c1000000-0000-4000-8000-000000000001', 'Ayşe Yılmaz', 'ayse@example.com', '+905550000000', 'SECRET-MEDICAL-NOTE');
insert into measurements (client_id, weight_kg) values ('c1000000-0000-4000-8000-000000000001', 72.5);
insert into programs (id, client_id, title, language)
values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Haftalık plan', 'tr');
insert into program_days (id, program_id, position) values ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 0);
insert into program_meals (id, program_id, day_id, slot)
values ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'breakfast');
insert into program_meal_items (program_id, meal_id, name, grams, kcal)
values ('a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Yulaf', 40, 150);
insert into share_links (program_id, token, show_client_name)
values ('a1000000-0000-4000-8000-000000000001', 'pgtap-token-0123456789abcdefghijklmnopqrstuv', true);
insert into foods (id, key, category, kcal, protein_g, carb_g, fat_g, flags)
values ('f1000000-0000-4000-8000-000000000001', 'egg', 'dairy_egg', 143, 12.6, 0.7, 9.5, '{egg}');
insert into recipes (id, published, servings) values
  ('b1000000-0000-4000-8000-000000000001', true, 1),
  ('b2000000-0000-4000-8000-000000000002', false, 1);
insert into recipe_ingredients (recipe_id, food_id, grams)
values ('b1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 100);
insert into recipe_translations (recipe_id, locale, slug, title, translation_status) values
  ('b1000000-0000-4000-8000-000000000001', 'tr', 'yayinda', 'Yayında', 'reviewed'),
  ('b1000000-0000-4000-8000-000000000001', 'fr', 'brouillon-fr', 'Brouillon', 'draft'),
  ('b2000000-0000-4000-8000-000000000002', 'tr', 'taslak', 'Taslak', 'reviewed');
insert into audit_log (action, entity, entity_id) values ('client.read', 'client', 'c1000000-0000-4000-8000-000000000001');
reset role;

-- ── schema-wide ──────────────────────────────────────────────────────────────
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS is enabled on every table in public');

-- ── owner isolation ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from clients), 1, 'owner A sees their own client');

select set_config('request.jwt.claims', '{"sub":"0b000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from clients), 0, 'B cannot read A''s clients');
select is((select count(*)::int from measurements), 0, 'B cannot read A''s measurements');
select is((select count(*)::int from programs), 0, 'B cannot read A''s programs');
select is((select count(*)::int from program_meal_items), 0, 'B cannot read A''s program items');
select is((select count(*)::int from share_links), 0, 'B cannot read A''s share links');
select is((select count(*)::int from audit_log), 0, 'B cannot read A''s audit log');

select is_empty($$ update clients set full_name = 'hacked' where id = 'c1000000-0000-4000-8000-000000000001' returning id $$,
  'B cannot update A''s client');
select is_empty($$ delete from clients where id = 'c1000000-0000-4000-8000-000000000001' returning id $$,
  'B cannot delete A''s client');
select throws_ok($$ insert into measurements (client_id, weight_kg) values ('c1000000-0000-4000-8000-000000000001', 60) $$,
  '42501', null, 'B cannot attach a measurement to A''s client');
select throws_ok($$ insert into share_links (program_id, token) values ('a1000000-0000-4000-8000-000000000001', 'pgtap-token-forged-0123456789abcdefghijklmnop') $$,
  '42501', null, 'B cannot create a share link for A''s program');
select throws_ok($$ insert into clients (owner_id, full_name) values ('0a000000-0000-4000-8000-00000000000a', 'x') $$,
  '42501', null, 'B cannot forge owner_id');

select set_config('request.jwt.claims', '{"sub":"0a000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select is((select full_name from clients where id = 'c1000000-0000-4000-8000-000000000001'), 'Ayşe Yılmaz',
  'A''s client is unchanged');
select throws_ok($$ update audit_log set action = 'x' $$, '42501', null, 'audit log: no updates');
select throws_ok($$ delete from audit_log $$, '42501', null, 'audit log: no deletes');
reset role;

-- ── anonymous visitors ───────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from clients $$, '42501', null, 'anon: clients denied');
select throws_ok($$ select * from measurements $$, '42501', null, 'anon: measurements denied');
select throws_ok($$ select * from programs $$, '42501', null, 'anon: programs denied');
select throws_ok($$ select * from share_links $$, '42501', null, 'anon: share links denied');
select throws_ok($$ select * from leads $$, '42501', null, 'anon: leads denied');
select throws_ok($$ select * from audit_log $$, '42501', null, 'anon: audit log denied');
select throws_ok(
  $$ insert into leads (owner_id, kind, name, consent_at, consent_version) values ('0a000000-0000-4000-8000-00000000000a', 'contact', 'x', now(), 'v1') $$,
  '42501', null, 'anon cannot insert leads directly (server action only)');
select is((select count(*)::int from recipes), 1, 'anon sees only the published recipe');
select results_eq($$ select slug from recipe_translations $$, $$ values ('yayinda'::text) $$,
  'anon sees only non-draft translations of published recipes');
select is((select count(*)::int from foods), 1, 'anon sees foods used by published recipes');
select is((select round(kcal)::int from recipes), 143, 'recipe kcal is derived from ingredients');
select throws_ok($$ select rate_limit_hit('k', 60, 5) $$, '42501', null, 'anon cannot call the rate limiter');

-- ── shared program resolution (SECURITY DEFINER RPC, sanitized DTO) ──────────
select ok(
  (select dto->>'title' = 'Haftalık plan' and dto->>'clientFirstName' = 'Ayşe'
          and dto::text not like '%SECRET-MEDICAL-NOTE%' and dto::text not like '%ayse@example.com%'
          and dto::text not like '%+905550000000%' and dto::text not like '%Yılmaz%'
          and dto::text not like '%c1000000-0000-4000-8000-000000000001%'
     from (select get_shared_program('pgtap-token-0123456789abcdefghijklmnopqrstuv') as dto) s),
  'valid token → sanitized DTO (first name only; no notes, e-mail, phone, surname or ids)');
select ok(get_shared_program('short') is null, 'malformed token → null');
reset role;

-- revoke as owner A, then the same token resolves to nothing
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
update share_links set revoked_at = now();
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select ok(get_shared_program('pgtap-token-0123456789abcdefghijklmnopqrstuv') is null, 'revoked token → null');
reset role;

select * from finish();
rollback;
