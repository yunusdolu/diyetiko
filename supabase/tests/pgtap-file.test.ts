/**
 * Runs supabase/tests/database/rls.test.sql — the pgTAP suite for `supabase test db` — against the real
 * migrations on PGlite. PGlite has no pgTAP, so a tiny compatible shim provides the handful of
 * functions the file uses. The shim functions are SECURITY INVOKER: every assertion executes
 * with the role the file switched to, so RLS is exercised exactly as under pgTAP.
 */
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createLocalDatabase } from '@/lib/db/pglite';

const SHIM = `
create schema tap;
create table tap.results (n serial, ok boolean not null, description text);
create table tap.meta (planned int);
grant usage on schema tap to public;
grant all on all tables in schema tap to public;
grant all on all sequences in schema tap to public;

create function tap.record(pass boolean, description text) returns text language plpgsql as $$
begin
  insert into tap.results (ok, description) values (coalesce(pass, false), description);
  return (case when coalesce(pass, false) then 'ok' else 'not ok' end) || ' - ' || coalesce(description, '');
end $$;

create function public.plan(n int) returns text language sql as $$ insert into tap.meta values (n); select '1..' || n $$;
create function public.ok(pass boolean, description text) returns text language sql as $$ select tap.record(pass, description) $$;
create function public.is(have anyelement, want anyelement, description text) returns text language sql as
  $$ select tap.record(have is not distinct from want, description || ' (have ' || coalesce(have::text, 'NULL') || ', want ' || coalesce(want::text, 'NULL') || ')') $$;

create function public.is_empty(query text, description text) returns text language plpgsql as $$
declare c int;
begin
  execute 'with q as (' || query || ') select count(*) from q' into c;
  return tap.record(c = 0, description);
end $$;

create function public.throws_ok(query text, errcode text, errmsg text, description text) returns text language plpgsql as $$
begin
  begin
    execute query;
  exception when others then
    return tap.record(sqlstate = errcode, description || ' (got ' || sqlstate || ': ' || sqlerrm || ')');
  end;
  return tap.record(false, description || ' (no exception)');
end $$;

create function public.results_eq(have text, want text, description text) returns text language plpgsql as $$
declare h text[]; w text[];
begin
  execute 'select coalesce(array_agg(x::text order by x::text), ''{}'') from (' || have || ') as x' into h;
  execute 'select coalesce(array_agg(x::text order by x::text), ''{}'') from (' || want || ') as x' into w;
  return tap.record(h = w, description || ' (have ' || h::text || ', want ' || w::text || ')');
end $$;

create function public.finish() returns setof text language plpgsql as $$
declare planned int; total int; failed text;
begin
  select m.planned into planned from tap.meta m limit 1;
  select count(*) into total from tap.results;
  select string_agg('#' || n || ' ' || description, E'\\n' order by n) into failed from tap.results where not ok;
  if failed is not null then raise exception E'pgTAP failures:\\n%', failed; end if;
  if planned is distinct from total then raise exception 'planned % tests, ran %', planned, total; end if;
  return next 'all ' || total || ' passed';
end $$;
`;

let db: PGlite;

beforeAll(async () => {
  db = await createLocalDatabase(undefined, { seed: false });
  await db.exec(SHIM);
});

afterAll(async () => {
  await db?.close();
});

it('supabase/tests/database/rls.test.sql passes (all planned assertions, as the roles it switches to)', async () => {
  const sql = readFileSync('supabase/tests/database/rls.test.sql', 'utf8')
    // pgTAP itself is provided by the shim above.
    .replace(/^create extension if not exists pgtap.*$/m, '');
  // The file ends with ROLLBACK, so a failing finish() surfaces as a thrown error here.
  await expect(db.exec(sql)).resolves.toBeDefined();
});
