// Sets up — or resets — the database of the shared DEMO site (its own Supabase project).
//
//   node scripts/demo-db.mjs            first run: migrations, demo login, public content, demo practice
//   node scripts/demo-db.mjs --reset    later: wipe everything visitors changed, load the demo data again
//
// It also schedules, inside the demo database (pg_cron), a nightly reset at 03:00 Türkiye and an
// hourly job that marks the newest client messages unread again. Run it again after changing a
// migration, the seed or the demo data, so the stored reset uses the new files.
//
// Reads .env.demo.local (or --env <file>):
//   DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY   of the DEMO project
//   DEMO_ACCOUNTS         the first e-mail is the shared dietitian login
//   DEMO_ADMIN_PASSWORD   only used to create that login if it does not exist yet (never printed)
//
// It refuses to touch the production project named in .env.local.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const args = process.argv.slice(2);
const reset = args.includes('--reset');
const envFile = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env.demo.local';

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

function projectRef(env) {
  const fromUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(
    /^https:\/\/([a-z0-9]+)\.supabase\.co/,
  );
  const fromDb = (env.DATABASE_URL ?? '').match(/postgres\.([a-z0-9]+)[:@]|@db\.([a-z0-9]+)\./);
  return fromUrl?.[1] ?? fromDb?.[1] ?? fromDb?.[2] ?? null;
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const env = readEnv(path.resolve(root, envFile));
if (path.basename(envFile) === '.env.local')
  fail('Use a separate file for the demo (.env.demo.local).');
for (const key of [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'DEMO_ACCOUNTS',
]) {
  if (!env[key] || env[key].includes('<')) fail(`${key} is missing in ${envFile}.`);
}
const demoRef = projectRef(env);
const prodRef = projectRef(readEnv(path.resolve(root, '.env.local')));
if (!demoRef) fail('Could not read the project id from DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL.');
if (prodRef && demoRef === prodRef)
  fail('This is the PRODUCTION project from .env.local. Stopped.');
const dbRef = projectRef({ DATABASE_URL: env.DATABASE_URL });
if (dbRef && dbRef !== demoRef)
  fail('DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL belong to different projects.');

const adminEmail = env.DEMO_ACCOUNTS.split(',')[0].trim().toLowerCase();
const portalEmail = (env.DEMO_PORTAL_EMAIL || 'deniz@diyetiko.test').toLowerCase();
// data-only portal accounts that supabase/demo/extra.sql links to its clients (by e-mail)
const EXTRA_PORTAL_EMAILS = [
  'emre',
  'mert',
  'camille',
  'zeynep',
  'can',
  'ayse',
  'burak',
  'hakan',
].map((n) => `${n}@diyetiko.test`);
// newest client message of each thread from the last 3 days → unread again
const UNREAD_REFRESH = `update public.messages set read_at = null
  where read_at is not null and created_at > now() - interval '3 days'
    and id in (select distinct on (client_id) id from public.messages
               where author = 'client' order by client_id, created_at desc)`;
const sql = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1,
  connect_timeout: 15,
  onnotice: () => {},
});
const auth = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth.admin;
const file = (...p) => readFileSync(path.join(root, ...p), 'utf8');
const step = (s) => console.log(`• ${s}`);
const userId = async (email) =>
  (await sql`select id from auth.users where lower(email) = ${email}`)[0]?.id ?? null;

try {
  console.log(`Demo project: ${demoRef}${reset ? ' (reset)' : ''}`);

  // 1. Schema — a fresh project gets every migration, in file-name order.
  const [{ ready }] = await sql`select to_regclass('public.profiles') is not null as ready`;
  if (!ready) {
    for (const f of readdirSync(path.join(root, 'supabase', 'migrations')).sort()) {
      step(`migration ${f}`);
      await sql.unsafe(file('supabase', 'migrations', f));
    }
  }

  // 2. The shared dietitian login. The FIRST profile is the dietitian (handle_new_user).
  let owner = await userId(adminEmail);
  if (!owner) {
    const pw = env.DEMO_ADMIN_PASSWORD ?? '';
    if (!pw || pw.includes('<')) fail(`Create ${adminEmail} first, or set DEMO_ADMIN_PASSWORD.`);
    if (pw.length < 10) fail('DEMO_ADMIN_PASSWORD needs at least 10 characters.');
    const { data, error } = await auth.createUser({
      email: adminEmail,
      password: env.DEMO_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Demo Diyetisyen' },
    });
    if (error) fail(`Could not create ${adminEmail}: ${error.message}`);
    owner = data.user.id;
    step(`created the demo login ${adminEmail}`);
  }
  // a login made before the migrations ran has no profile yet
  await sql`insert into public.profiles (id, full_name, role) values (${owner}, 'Demo Diyetisyen', 'dietitian')
            on conflict (id) do update set role = 'dietitian'`;
  const others =
    await sql`select count(*)::int as n from public.profiles where role = 'dietitian' and id <> ${owner}`;
  if (others[0].n > 0)
    fail('Another dietitian account exists in this project; the demo login must be the only one.');

  // 3. Portal clients behind the demo clients, so their Takip / Günlük / Mesajlar tabs have data
  //    (Deniz from demo.sql, the others from supabase/demo/extra.sql). No password: nobody signs
  //    in with them.
  const portalIds = {};
  for (const email of [portalEmail, ...EXTRA_PORTAL_EMAILS]) {
    let id = await userId(email);
    if (!id) {
      const { data, error } = await auth.createUser({
        email,
        email_confirm: true,
        app_metadata: { role: 'client' },
      });
      if (error) fail(`Could not create ${email}: ${error.message}`);
      id = data.user.id;
      step(`created the data-only portal client ${email}`);
    }
    portalIds[email] = id;
  }

  // 4. Everything visitors can change is rebuilt by ONE stored statement: empty the tables
  //    (accounts and rate limits stay), then public content, the demo practice and the extra
  //    demo data. Kept in the database so pg_cron can run it every night.
  const tables = await sql`select tablename from pg_tables where schemaname = 'public'
                           and tablename not in ('profiles', 'rate_limits') order by tablename`;
  const list = tables.map((t) => `public."${t.tablename.replaceAll('"', '""')}"`).join(', ');
  const resetSql = [
    `truncate ${list} restart identity cascade;`,
    file('supabase', 'seed.sql'),
    file('supabase', 'local', 'demo.sql').replaceAll(
      '00000000-0000-4000-8000-000000000002',
      portalIds[portalEmail],
    ),
    file('supabase', 'demo', 'extra.sql'),
  ].join('\n');
  await sql.unsafe(`
    create schema if not exists demo_admin;
    revoke all on schema demo_admin from public;
    create table if not exists demo_admin.reset_sql (id int primary key, body text not null);
    create or replace function demo_admin.reset() returns void language plpgsql as $fn$
    begin
      execute (select body from demo_admin.reset_sql where id = 1);
    end $fn$;
    revoke all on function demo_admin.reset() from public;
  `);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await sql.unsafe(`revoke all on schema demo_admin from ${role}`);
    await sql.unsafe(`revoke all on function demo_admin.reset() from ${role}`);
  }
  await sql`insert into demo_admin.reset_sql (id, body) values (1, ${resetSql})
            on conflict (id) do update set body = excluded.body`;

  // 5. Shared account, so: rebuild every night at 03:00 Türkiye (00:00 UTC), and every hour mark
  //    the newest client message of recent threads unread again (someone opening the inbox
  //    clears the badges for everyone).
  await sql.unsafe(`create extension if not exists pg_cron`);
  await sql`select cron.schedule('demo-nightly-reset', '0 0 * * *', 'select demo_admin.reset()')`;
  await sql`select cron.schedule('demo-unread-refresh', '15 * * * *', ${UNREAD_REFRESH})`;
  step('scheduled the nightly reset and the hourly unread refresh (pg_cron)');

  // 6. Load now: on --reset, or when the practice is still empty.
  const [{ clients }] = await sql`select count(*)::int as clients from public.clients`;
  if (reset || clients === 0) {
    step('loading public content, demo practice and extra demo data');
    await sql`select demo_admin.reset()`;
  }

  const [c] = await sql`select (select count(*) from public.clients)::int as clients,
                               (select count(*) from public.programs)::int as programs,
                               (select count(*) from public.recipes)::int as recipes,
                               (select count(*) from public.leads)::int as leads`;
  console.log(
    `\n✓ Demo ready: ${c.clients} clients, ${c.programs} programs, ${c.recipes} recipes, ${c.leads} requests.`,
  );
  console.log(`  Login: ${adminEmail} (password: the one you chose).`);
} finally {
  await sql.end({ timeout: 5 });
}
