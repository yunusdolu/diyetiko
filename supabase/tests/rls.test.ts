/**
 * Proves the RLS model against the real migrations (PGlite = Postgres 17 in WASM).
 * The same assertions exist as pgTAP in database/rls.test.sql for `supabase test db`
 * (also executed here through a shim: pgtap-file.test.ts).
 */
import { randomBytes } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalDatabase, pgliteDriver } from '@/lib/db/pglite';
import type { Driver, Tx } from '@/lib/db/types';

const A = '0a000000-0000-4000-8000-00000000000a';
const B = '0b000000-0000-4000-8000-00000000000b';

let db: PGlite;
let driver: Driver;
const asA = <T>(fn: (tx: Tx) => Promise<T>) => driver.run('authenticated', A, fn);
const asB = <T>(fn: (tx: Tx) => Promise<T>) => driver.run('authenticated', B, fn);
const asAnon = <T>(fn: (tx: Tx) => Promise<T>) => driver.run('anon', null, fn);
const asService = <T>(fn: (tx: Tx) => Promise<T>) => driver.run('service_role', null, fn);

const token = randomBytes(32).toString('base64url');
let clientId = '';
let programId = '';

beforeAll(async () => {
  db = await createLocalDatabase(undefined, { seed: false });
  driver = pgliteDriver(() => Promise.resolve(db));
  await db.query(`insert into auth.users (id, email) values ($1, 'a@test'), ($2, 'b@test')`, [
    A,
    B,
  ]);

  await asA(async (tx) => {
    const [c] = await tx.query<{ id: string }>(
      `insert into clients (full_name, email, phone, medical_notes)
       values ('Ayşe Yılmaz', 'ayse@example.com', '+905550000000', 'SECRET-MEDICAL-NOTE') returning id`,
    );
    clientId = c!.id;
    await tx.query(`insert into measurements (client_id, weight_kg) values ($1, 72.5)`, [clientId]);
    const [p] = await tx.query<{ id: string }>(
      `insert into programs (client_id, title, language) values ($1, 'Haftalık plan', 'tr') returning id`,
      [clientId],
    );
    programId = p!.id;
    const [d] = await tx.query<{ id: string }>(
      `insert into program_days (program_id, position) values ($1, 0) returning id`,
      [programId],
    );
    const [m] = await tx.query<{ id: string }>(
      `insert into program_meals (program_id, day_id, slot) values ($1, $2, 'breakfast') returning id`,
      [programId, d!.id],
    );
    await tx.query(
      `insert into program_meal_items (program_id, meal_id, name, grams, kcal) values ($1, $2, 'Yulaf', 40, 150)`,
      [programId, m!.id],
    );
    await tx.query(
      `insert into share_links (program_id, token, show_client_name) values ($1, $2, true)`,
      [programId, token],
    );
    const [f] = await tx.query<{ id: string }>(
      `insert into foods (key, category, kcal, protein_g, carb_g, fat_g, flags)
       values ('egg', 'dairy_egg', 143, 12.6, 0.7, 9.5, '{egg}') returning id`,
    );
    const [pub] = await tx.query<{ id: string }>(
      `insert into recipes (published, servings) values (true, 1) returning id`,
    );
    const [draft] = await tx.query<{ id: string }>(
      `insert into recipes (published, servings) values (false, 1) returning id`,
    );
    await tx.query(
      `insert into recipe_ingredients (recipe_id, food_id, grams) values ($1, $2, 100)`,
      [pub!.id, f!.id],
    );
    await tx.query(
      `insert into recipe_translations (recipe_id, locale, slug, title, translation_status)
       values ($1, 'tr', 'yayinda', 'Yayında', 'reviewed'), ($1, 'fr', 'brouillon-fr', 'Brouillon', 'draft'),
              ($2, 'tr', 'taslak', 'Taslak', 'reviewed')`,
      [pub!.id, draft!.id],
    );
    await tx.query(
      `insert into audit_log (action, entity, entity_id) values ('client.read', 'client', $1)`,
      [clientId],
    );
  });
});

afterAll(async () => {
  await db?.close();
});

describe('owner isolation', () => {
  it('owner A sees their own client', async () => {
    const rows = await asA((tx) => tx.query(`select id from clients`));
    expect(rows).toHaveLength(1);
  });

  it('owner B cannot read A’s clients, measurements, programs, share links or audit log', async () => {
    const counts = await asB(async (tx) => {
      const out: Record<string, number> = {};
      for (const t of [
        'clients',
        'measurements',
        'programs',
        'program_meal_items',
        'share_links',
        'audit_log',
      ]) {
        const [r] = await tx.query<{ n: number }>(`select count(*)::int as n from ${t}`);
        out[t] = r!.n;
      }
      return out;
    });
    expect(counts).toEqual({
      clients: 0,
      measurements: 0,
      programs: 0,
      program_meal_items: 0,
      share_links: 0,
      audit_log: 0,
    });
  });

  it('owner B cannot update or delete A’s client', async () => {
    const updated = await asB((tx) =>
      tx.query(`update clients set full_name = 'hacked' where id = $1 returning id`, [clientId]),
    );
    const deleted = await asB((tx) =>
      tx.query(`delete from clients where id = $1 returning id`, [clientId]),
    );
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
    const [row] = await asA((tx) =>
      tx.query<{ full_name: string }>(`select full_name from clients`),
    );
    expect(row!.full_name).toBe('Ayşe Yılmaz');
  });

  it('owner B cannot attach rows to A’s client or program (cross-tenant insert)', async () => {
    await expect(
      asB((tx) =>
        tx.query(`insert into measurements (client_id, weight_kg) values ($1, 60)`, [clientId]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asB((tx) =>
        tx.query(`insert into share_links (program_id, token) values ($1, $2)`, [
          programId,
          randomBytes(32).toString('base64url'),
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('owner B cannot forge owner_id', async () => {
    await expect(
      asB((tx) => tx.query(`insert into clients (owner_id, full_name) values ($1, 'x')`, [A])),
    ).rejects.toThrow(/row-level security|permission denied/); // owner_id is not even an insertable column
  });

  it('audit log is append-only', async () => {
    await expect(asA((tx) => tx.query(`update audit_log set action = 'x'`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(asA((tx) => tx.query(`delete from audit_log`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('anonymous visitors', () => {
  it('cannot read any client data', async () => {
    for (const t of [
      'clients',
      'measurements',
      'client_notes',
      'client_files',
      'programs',
      'share_links',
      'leads',
      'appointments',
      'audit_log',
      'profiles',
    ]) {
      await expect(
        asAnon((tx) => tx.query(`select * from ${t}`)),
        t,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('cannot insert leads directly (only via the server action / service role)', async () => {
    await expect(
      asAnon((tx) =>
        tx.query(
          `insert into leads (owner_id, kind, name, consent_at, consent_version) values ($1, 'contact', 'x', now(), 'v1')`,
          [A],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('sees only published recipes and non-draft translations', async () => {
    const recipes = await asAnon((tx) => tx.query(`select id from recipes`));
    expect(recipes).toHaveLength(1);
    const translations = await asAnon((tx) =>
      tx.query<{ slug: string }>(`select slug from recipe_translations`),
    );
    expect(translations.map((t) => t.slug)).toEqual(['yayinda']);
  });

  it('can read foods only when used by a published recipe', async () => {
    const foods = await asAnon((tx) => tx.query(`select key from foods`));
    expect(foods).toHaveLength(1);
  });

  it('cannot call the rate limiter', async () => {
    await expect(asAnon((tx) => tx.query(`select rate_limit_hit('k', 60, 5)`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('recipe nutrition is derived from ingredients', () => {
  it('computes per-serving macros and diet flags', async () => {
    const [r] = await asAnon((tx) =>
      tx.query<{ kcal: number; protein_g: number; diet_flags: string[] }>(
        `select kcal, protein_g, diet_flags from recipes`,
      ),
    );
    expect(Math.round(r!.kcal)).toBe(143);
    expect(r!.protein_g).toBeCloseTo(12.6, 1);
    expect(r!.diet_flags).toEqual(
      expect.arrayContaining(['vegetarian', 'gluten_free', 'dairy_free']),
    );
    expect(r!.diet_flags).not.toContain('vegan');
  });
});

describe('shared program resolution', () => {
  it('returns a sanitized DTO for a valid token (no medical notes, phone, e-mail)', async () => {
    const [row] = await asAnon((tx) =>
      tx.query<{ dto: Record<string, unknown> }>(`select get_shared_program($1) as dto`, [token]),
    );
    const dto = row!.dto;
    expect(dto).toBeTruthy();
    expect(dto.title).toBe('Haftalık plan');
    expect(dto.clientFirstName).toBe('Ayşe');
    const text = JSON.stringify(dto);
    expect(text).not.toContain('SECRET-MEDICAL-NOTE');
    expect(text).not.toContain('ayse@example.com');
    expect(text).not.toContain('+905550000000');
    expect(text).not.toContain('Yılmaz');
    expect(text).not.toContain(clientId);
  });

  it('counts views', async () => {
    const [row] = await asA((tx) =>
      tx.query<{ view_count: number }>(`select view_count from share_links`),
    );
    expect(row!.view_count).toBeGreaterThanOrEqual(1);
  });

  it('rejects malformed and unknown tokens', async () => {
    const [bad] = await asAnon((tx) =>
      tx.query<{ dto: unknown }>(`select get_shared_program('short') as dto`),
    );
    const [unknown] = await asAnon((tx) =>
      tx.query<{ dto: unknown }>(`select get_shared_program($1) as dto`, [
        randomBytes(32).toString('base64url'),
      ]),
    );
    expect(bad!.dto).toBeNull();
    expect(unknown!.dto).toBeNull();
  });

  it('returns null once expired or revoked', async () => {
    await asA((tx) => tx.query(`update share_links set expires_at = now() - interval '1 minute'`));
    const [expired] = await asAnon((tx) =>
      tx.query<{ dto: unknown }>(`select get_shared_program($1) as dto`, [token]),
    );
    expect(expired!.dto).toBeNull();
    await asA((tx) => tx.query(`update share_links set expires_at = null, revoked_at = now()`));
    const [revoked] = await asAnon((tx) =>
      tx.query<{ dto: unknown }>(`select get_shared_program($1) as dto`, [token]),
    );
    expect(revoked!.dto).toBeNull();
  });
});

describe('service role', () => {
  it('rate limiter allows up to the max within a window', async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const [r] = await asService((tx) =>
        tx.query<{ ok: boolean }>(`select rate_limit_hit('test', 60, 3) as ok`),
      );
      results.push(r!.ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
