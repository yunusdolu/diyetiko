import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, expect, it } from 'vitest';
import { createLocalDatabase } from '@/lib/db/pglite';

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(path.join(tmpdir(), 'dm-pglite-'));
  dirs.push(d);
  return d;
};

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('local demo database', () => {
  it('reopens a completed database without re-seeding', async () => {
    const dir = tempDir();
    const first = await createLocalDatabase(dir, { demo: false });
    const before = (await first.query<{ n: number }>('select count(*)::int as n from recipes'))
      .rows[0]!.n;
    await first.close();

    const again = await createLocalDatabase(dir, { demo: false });
    const after = (await again.query<{ n: number }>('select count(*)::int as n from recipes'))
      .rows[0]!.n;
    await again.close();
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(before);
  });

  it('builds the full demo (seed + demo.sql) including a working client portal account', async () => {
    const db = await createLocalDatabase(undefined);
    const q = async <T>(sql: string) => (await db.query<T>(sql)).rows[0]!;
    const link = await q<{ role: string; consent: boolean; name: string }>(
      `select p.role::text as role, c.portal_consent_at is not null as consent, c.full_name as name
         from clients c join profiles p on p.id = c.user_id where c.user_id = '00000000-0000-4000-8000-000000000002'`,
    );
    expect(link).toEqual({ role: 'client', consent: true, name: 'Deniz Aksoy (demo)' });
    const counts = await q<{
      habits: number;
      checkins: number;
      meals: number;
      msgs: number;
      kcal: number;
      free: number;
    }>(
      `select (select count(*)::int from client_habits) as habits, (select count(*)::int from checkins) as checkins,
              (select count(*)::int from diary_meals) as meals, (select count(*)::int from messages) as msgs,
              (select round(sum(kcal))::int from diary_items) as kcal, (select count(*)::int from diary_items where kcal is null) as free`,
    );
    expect(counts.habits).toBe(4);
    expect(counts.checkins).toBe(11);
    expect(counts.meals).toBe(7);
    expect(counts.msgs).toBe(3);
    expect(counts.kcal).toBeGreaterThan(1500); // computed by the database from the food table
    expect(counts.free).toBe(2); // free-text items have no invented values
    await db.close();
  });

  it('refuses a half-initialised database (process died during first setup)', async () => {
    const dir = tempDir();
    const partial = await PGlite.create({ dataDir: dir });
    await partial.exec('create table public.clients (id int)'); // schema started, never finished
    await partial.close();
    await expect(createLocalDatabase(dir)).rejects.toThrow(/interrupted/);
  });
});
