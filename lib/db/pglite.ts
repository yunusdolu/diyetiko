import 'server-only';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { env } from '@/lib/env';
import { OID, identity, parseJson, parseTimestamp, toNumber } from './parsers';
import type { DbRole, Driver, Param, Row, Tx } from './types';

const root = /* turbopackIgnore: true */ process.cwd();

export const LOCAL_ADMIN_ID = '00000000-0000-4000-8000-000000000001';
/** Demo client account (portal) — linked to the demo client "Deniz Aksoy" by supabase/local/demo.sql. */
export const LOCAL_CLIENT_ID = '00000000-0000-4000-8000-000000000002';

function migrationSql(): string[] {
  const dir = path.join(root, 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(dir, f), 'utf8'));
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function readOptional(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Create + migrate + seed a PGlite database. Exported for tests (in-memory when no dataDir). */
export async function createLocalDatabase(
  dataDir?: string,
  opts: { seed?: boolean; demo?: boolean; adminEmail?: string; adminPassword?: string } = {},
): Promise<PGlite> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = await PGlite.create({
    dataDir,
    parsers: {
      [OID.date]: identity,
      [OID.timestamp]: parseTimestamp,
      [OID.timestamptz]: parseTimestamp,
      [OID.numeric]: toNumber,
      [OID.int8]: toNumber,
      // same reading as the production driver (old double-encoded rows come back as objects)
      [OID.json]: parseJson,
      [OID.jsonb]: parseJson,
    },
  });
  await db.exec(`set timezone = 'UTC'; set datestyle = 'ISO, YMD';`);
  const version = schemaVersion(opts);
  const [state] = (
    await db.query<{ schema: string | null; ready: string | null }>(
      `select to_regclass('public.clients')::text as schema, to_regclass('local_meta.ready')::text as ready`,
    )
  ).rows;
  if (state?.ready) {
    // Built from the same migrations + seed? Otherwise it is an older schema: rebuild.
    const stored = await db
      .query<{ version: string }>(`select version from local_meta.ready limit 1`)
      .catch(() => null);
    if (stored?.rows[0]?.version === version) return db;
    await db.close();
    throw new Error(
      'local database was built by an older version of the app (migrations or seed changed)',
    );
  }
  if (state?.schema) {
    // Tables exist but setup never finished (the process died mid-seed): not trustworthy.
    await db.close();
    throw new Error('local database setup was interrupted');
  }

  await db.exec(readFileSync(path.join(root, 'supabase', 'local', 'stub.sql'), 'utf8'));
  for (const sql of migrationSql()) await db.exec(sql);

  if (opts.seed !== false) {
    const email = opts.adminEmail ?? env.localAdminEmail;
    const password = opts.adminPassword ?? env.localAdminPassword;
    await db.query(
      `insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
       values ($1, $2, $3, '{"full_name":"Diyetiko"}')`,
      [LOCAL_ADMIN_ID, email, hashPassword(password)],
    );
    const seed = readOptional(path.join(root, 'supabase', 'seed.sql'));
    if (seed) await db.exec(seed);
    if (opts.demo !== false) {
      // Created after the dietitian, so handle_new_user makes it a client account.
      await db.query(
        `insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, $2, $3, '{"full_name":"Deniz Aksoy"}')`,
        [LOCAL_CLIENT_ID, env.localClientEmail, hashPassword(env.localClientPassword)],
      );
      const demo = readOptional(path.join(root, 'supabase', 'local', 'demo.sql'));
      if (demo) await db.exec(demo);
    }
  }
  // Written last: its presence means migrations + seed completed. Outside `public` on purpose
  // (the RLS proof asserts every public table has RLS).
  await db.exec(
    `create schema local_meta; create table local_meta.ready (version text not null, at timestamptz default now());`,
  );
  await db.query(`insert into local_meta.ready (version) values ($1)`, [version]);
  return db;
}

/** Fingerprint of everything a local database is built from (stub, migrations, seed, demo data). */
function schemaVersion(opts: { seed?: boolean; demo?: boolean }): string {
  const h = createHash('sha256');
  h.update(readFileSync(path.join(root, 'supabase', 'local', 'stub.sql'), 'utf8'));
  for (const sql of migrationSql()) h.update(sql);
  if (opts.seed !== false) {
    h.update(readOptional(path.join(root, 'supabase', 'seed.sql')) ?? '');
    if (opts.demo !== false)
      h.update(readOptional(path.join(root, 'supabase', 'local', 'demo.sql')) ?? '');
  }
  return h.digest('hex').slice(0, 16);
}

/**
 * Opens the on-disk demo database. A PGlite directory can be left unreadable if the process is
 * killed mid-write (PGlite cannot always replay crash recovery — it aborts instead). Rather than
 * failing every request, the damaged directory is renamed aside (kept, never deleted) and a fresh
 * demo database is created in its place.
 */
async function openPersisted(dir: string): Promise<PGlite> {
  try {
    return await createLocalDatabase(dir);
  } catch (error) {
    const reason =
      error instanceof Error && /older version/.test(error.message) ? 'outdated' : 'broken';
    const aside = `${dir}.${reason}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try {
      renameSync(dir, aside);
    } catch {
      throw new Error(
        `The local demo database at ${dir} cannot be opened and could not be moved aside ` +
          `(is another dev server using it?). Stop all dev servers, delete or rename that folder, and start again.`,
        { cause: error },
      );
    }
    console.warn(
      `[local db] ${dir} could not be opened (${error instanceof Error ? error.message : String(error)}). ` +
        `Moved it to ${aside} and created a fresh demo database.`,
    );
    mkdirSync(dir, { recursive: true });
    return createLocalDatabase(dir);
  }
}

type GlobalWithPg = typeof globalThis & {
  __pgliteDb?: Promise<PGlite>;
  __pgliteQueue?: Promise<unknown>;
  __pgliteVersion?: string;
  __pgliteCheckedAt?: number;
};
const g = globalThis as GlobalWithPg;

function instance(): Promise<PGlite> {
  // `next dev` keeps the database open across edits. When the migrations or seed files change,
  // close it and rebuild (openPersisted sets the old folder aside) — no server restart needed.
  if (
    g.__pgliteDb &&
    process.env.NODE_ENV === 'development' &&
    Date.now() - (g.__pgliteCheckedAt ?? 0) > 3000
  ) {
    g.__pgliteCheckedAt = Date.now();
    const current = schemaVersion({});
    if (current !== g.__pgliteVersion) {
      // (undefined = opened by older code: rebuild too)
      const stale = g.__pgliteDb;
      const queue = g.__pgliteQueue ?? Promise.resolve();
      g.__pgliteDb = undefined;
      g.__pgliteVersion = undefined;
      const closing = (async () => {
        await queue;
        const db = await stale.catch(() => null);
        await db?.close().catch(() => undefined);
      })();
      g.__pgliteDb = closing.then(() => {
        g.__pgliteDb = undefined;
        return instance();
      });
      return g.__pgliteDb;
    }
  }
  if (!g.__pgliteDb) {
    g.__pgliteVersion = schemaVersion({});
    g.__pgliteCheckedAt = Date.now();
    // PGlite allows ONE process per data directory; a second one corrupts it. Next runs code in
    // extra processes: parallel workers during `next build`, and in `next dev` a jest-worker for
    // generateStaticParams (it sets JEST_WORKER_ID). Those get their own in-memory, freshly
    // seeded copy; only the main server process opens the on-disk demo database.
    const building = process.env.NEXT_PHASE === 'phase-production-build';
    // (Vitest too: a test run must never open the dev server's database.)
    const secondaryProcess = Boolean(process.env.JEST_WORKER_ID || process.env.VITEST);
    const dir = building || secondaryProcess ? undefined : path.join(root, env.localDataDir, 'pg');
    if (dir) mkdirSync(dir, { recursive: true });
    const opening = dir ? openPersisted(dir) : createLocalDatabase(undefined);
    // Never cache a failure: the next request should try again instead of replaying the error.
    opening.catch(() => {
      if (g.__pgliteDb === opening) g.__pgliteDb = undefined;
    });
    g.__pgliteDb = opening;
  }
  return g.__pgliteDb;
}

/** PGlite is single-connection: serialise transactions explicitly. */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const prev = g.__pgliteQueue ?? Promise.resolve();
  const next = prev.then(job, job);
  g.__pgliteQueue = next.catch(() => undefined);
  return next;
}

export function pgliteDriver(getDb: () => Promise<PGlite> = instance): Driver {
  return {
    async run<T>(role: DbRole, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
      const db = await getDb();
      return enqueue(() =>
        db.transaction(async (t) => {
          const claims = userId ? { sub: userId, role } : { role };
          await t.query(`select set_config('request.jwt.claims', $1, true)`, [
            JSON.stringify(claims),
          ]);
          await t.exec(`set local role ${role}`);
          const tx: Tx = {
            async query<R = Row>(text: string, params: readonly Param[] = []) {
              const res = await t.query<R>(text, params as Param[]);
              return res.rows;
            },
          };
          return fn(tx);
        }),
      );
    },
  };
}

/** Local-mode auth lookup (runs as the table owner, like Supabase Auth's own service). */
export async function localAuthUser(
  email: string,
): Promise<{ id: string; email: string; encrypted_password: string } | null> {
  const db = await instance();
  return enqueue(async () => {
    const res = await db.query<{ id: string; email: string; encrypted_password: string }>(
      `select id, email, encrypted_password from auth.users where lower(email) = lower($1)`,
      [email],
    );
    return res.rows[0] ?? null;
  });
}
