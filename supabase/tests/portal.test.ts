/**
 * Client portal security, against the real migrations (PGlite = Postgres 17).
 * Actors: the dietitian D (first account), clients C1 and C2 of D (linked through invites),
 * and U (an account linked to a client record but without consent yet).
 */
import { createHash, randomBytes } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalDatabase, pgliteDriver } from '@/lib/db/pglite';
import type { Driver, Tx } from '@/lib/db/types';

const D = '0d000000-0000-4000-8000-00000000000d';
const C1 = '0c100000-0000-4000-8000-0000000000c1';
const C2 = '0c200000-0000-4000-8000-0000000000c2';
const U = '0e000000-0000-4000-8000-00000000000e';

let db: PGlite;
let driver: Driver;
const as =
  (uid: string) =>
  <T>(fn: (tx: Tx) => Promise<T>) =>
    driver.run('authenticated', uid, fn);
const asD = as(D);
const asC1 = as(C1);
const asC2 = as(C2);
const asU = as(U);
const asService = <T>(fn: (tx: Tx) => Promise<T>) => driver.run('service_role', null, fn);

const hash = (t: string) => createHash('sha256').update(t).digest('hex');
let client1 = '';
let client2 = '';
let client3 = '';
let habit1 = '';
let habit2 = '';
let foodEgg = '';
let meal2 = '';

async function invite(
  clientId: string,
  purpose: 'invite' | 'reset' = 'invite',
  expires = "now() + interval '7 days'",
) {
  const token = randomBytes(32).toString('base64url');
  await asD((tx) =>
    tx.query(
      `insert into client_invites (client_id, purpose, token_hash, expires_at) values ($1, $2, $3, ${expires})`,
      [clientId, purpose, hash(token)],
    ),
  );
  return token;
}

beforeAll(async () => {
  db = await createLocalDatabase(undefined, { seed: false });
  driver = pgliteDriver(() => Promise.resolve(db));
  // D first → dietitian; the others → clients (handle_new_user)
  await db.query(`insert into auth.users (id, email) values ($1, 'd@test')`, [D]);
  await db.query(
    `insert into auth.users (id, email) values ($1, 'c1@test'), ($2, 'c2@test'), ($3, 'u@test')`,
    [C1, C2, U],
  );

  await asD(async (tx) => {
    const rows = await tx.query<{ id: string }>(
      `insert into clients (full_name, email, medical_notes) values
         ('Ayşe Yılmaz', 'c1@test', 'SECRET-MEDICAL'), ('Mehmet Kaya', 'c2@test', null), ('Unconsented User', 'u@test', null)
       returning id`,
    );
    [client1, client2, client3] = rows.map((r) => r.id) as [string, string, string];
    await tx.query(`insert into client_notes (client_id, body) values ($1, 'PRIVATE-NOTE')`, [
      client1,
    ]);
    await tx.query(
      `insert into measurements (client_id, weight_kg, note) values ($1, 70, 'INTERNAL-MEASURE-NOTE')`,
      [client1],
    );
    const h = await tx.query<{ id: string }>(
      `insert into client_habits (client_id, label) values ($1, 'Kahvaltı'), ($2, 'Yürüyüş') returning id`,
      [client1, client2],
    );
    [habit1, habit2] = h.map((r) => r.id) as [string, string];
    const [f] = await tx.query<{ id: string }>(
      `insert into foods (key, category, kcal, protein_g, carb_g, fat_g, units) values ('egg', 'dairy_egg', 143, 12.6, 0.7, 9.5, '[{"key":"piece","grams":50}]') returning id`,
    );
    foodEgg = f!.id;
    const [p] = await tx.query<{ id: string }>(
      `insert into programs (client_id, title, status, notes) values ($1, 'Plan A', 'active', 'Su iç') returning id`,
      [client1],
    );
    await tx.query(
      `insert into programs (client_id, title, status) values ($1, 'Plan B', 'active')`,
      [client2],
    );
    await tx.query(`insert into program_days (program_id, position) values ($1, 0)`, [p!.id]);
    await tx.query(
      `insert into appointments (client_id, starts_at, note, title) values ($1, now() + interval '2 days', 'INTERNAL-APPT-NOTE', 'INTERNAL-TITLE')`,
      [client1],
    );
  });

  // Accounts are linked only through invites (service side)
  for (const [clientId, uid] of [
    [client1, C1],
    [client2, C2],
    [client3, U],
  ] as const) {
    const token = await invite(clientId);
    await asService((tx) => tx.query(`select redeem_client_invite($1, $2)`, [hash(token), uid]));
  }
  await asC1((tx) => tx.query(`select portal_give_consent('portal-2026-01')`));
  await asC2((tx) => tx.query(`select portal_give_consent('portal-2026-01')`));
});

afterAll(async () => {
  await db?.close();
});

describe('roles', () => {
  it('a server-created portal account is a client even when no dietitian exists', async () => {
    const empty = await createLocalDatabase(undefined, { seed: false });
    try {
      await empty.query(
        `insert into auth.users (email, raw_app_meta_data) values ('first@test', '{"role":"client"}')`,
      );
      const { rows } = await empty.query<{ role: string }>(
        `select role::text as role from profiles`,
      );
      expect(rows).toEqual([{ role: 'client' }]);
    } finally {
      await empty.close();
    }
  });

  it('the first account is the dietitian, invited accounts are clients', async () => {
    const rows = await db.query<{ id: string; role: string }>(
      `select id, role::text as role from profiles order by created_at, id`,
    );
    const role = Object.fromEntries(rows.rows.map((r) => [r.id, r.role]));
    expect(role[D]).toBe('dietitian');
    expect([role[C1], role[C2], role[U]]).toEqual(['client', 'client', 'client']);
  });

  it('a client cannot promote itself', async () => {
    await expect(
      asC1((tx) => tx.query(`update profiles set role = 'dietitian' where id = $1`, [C1])),
    ).rejects.toThrow(/permission denied/);
  });

  it('a client owns nothing: no practice rows, no recipes, no public files', async () => {
    const counts = await asC1(async (tx) => {
      const out: Record<string, number> = {};
      for (const t of [
        'clients',
        'client_notes',
        'measurements',
        'programs',
        'appointments',
        'share_links',
        'leads',
        'client_invites',
        'audit_log',
      ]) {
        const [r] = await tx.query<{ n: number }>(`select count(*)::int as n from ${t}`);
        out[t] = r!.n;
      }
      return out;
    });
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    await expect(
      asC1((tx) => tx.query(`insert into recipes (published) values (true)`)),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asC1((tx) => tx.query(`insert into clients (full_name) values ('x')`)),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asC1((tx) =>
        tx.query(`insert into storage.objects (bucket_id, name) values ('recipe-media', $1)`, [
          `${C1}/x.jpg`,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('the dietitian cannot link accounts or fake consent directly', async () => {
    await expect(
      asD((tx) => tx.query(`update clients set user_id = $2 where id = $1`, [client2, C1])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asD((tx) =>
        tx.query(`update clients set portal_consent_at = now() where id = $1`, [client3]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('invites', () => {
  it('cannot be redeemed by users, twice, or after expiry', async () => {
    const token = await invite(client2, 'reset');
    await expect(
      asC1((tx) => tx.query(`select redeem_client_invite($1)`, [hash(token)])),
    ).rejects.toThrow(/permission denied/);
    await asService((tx) => tx.query(`select redeem_client_invite($1)`, [hash(token)]));
    await expect(
      asService((tx) => tx.query(`select redeem_client_invite($1)`, [hash(token)])),
    ).rejects.toThrow(/invalid or expired/);
    const expired = await invite(client2, 'reset', "now() - interval '1 minute'");
    const [peek] = await asService((tx) =>
      tx.query<{ p: unknown }>(`select peek_client_invite($1) as p`, [hash(expired)]),
    );
    expect(peek!.p).toBeNull();
  });

  it('an invite cannot re-link an already linked client', async () => {
    const token = await invite(client1);
    await expect(
      asService((tx) => tx.query(`select redeem_client_invite($1, $2)`, [hash(token), U])),
    ).rejects.toThrow(/already linked/);
  });
});

describe('consent gate', () => {
  it('without consent there is no portal data and nothing can be written', async () => {
    const [s] = await asU((tx) =>
      tx.query<{ s: { consented: boolean } }>(`select portal_status() as s`),
    );
    expect(s!.s.consented).toBe(false);
    const [p] = await asU((tx) => tx.query<{ p: unknown }>(`select portal_profile() as p`));
    expect(p!.p).toBeNull();
    await expect(
      asU((tx) =>
        tx.query(`insert into checkins (client_id, day, water_ml) values ($1, current_date, 500)`, [
          client3,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('client reads (sanitized)', () => {
  it('profile, program, measurements and appointments without internal notes', async () => {
    const [row] = await asC1((tx) =>
      tx.query<{
        profile: Record<string, unknown>;
        program: Record<string, unknown>;
        m: unknown[];
        a: unknown[];
      }>(
        `select portal_profile() as profile, portal_program() as program, portal_measurements() as m, portal_appointments() as a`,
      ),
    );
    expect(row!.profile.firstName).toBe('Ayşe');
    expect(row!.program.title).toBe('Plan A');
    expect(row!.m).toHaveLength(1);
    expect(row!.a).toHaveLength(1);
    const text = JSON.stringify(row);
    for (const secret of [
      'SECRET-MEDICAL',
      'PRIVATE-NOTE',
      'INTERNAL-MEASURE-NOTE',
      'INTERNAL-APPT-NOTE',
      'INTERNAL-TITLE',
      'Plan B',
      'Mehmet',
    ]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it('the food list comes from the own dietitian', async () => {
    const [row] = await asC1((tx) =>
      tx.query<{ f: { id: string }[] }>(`select portal_foods('tr') as f`),
    );
    expect(row!.f.map((f) => f.id)).toEqual([foodEgg]);
  });
});

describe('client writes (own rows only)', () => {
  it('check-ins: own client only, own habits only, owner from the record', async () => {
    await asC1((tx) =>
      tx.query(
        `insert into checkins (client_id, day, weight_kg, water_ml, habits) values ($1, current_date, 69.5, 1500, $2::uuid[])`,
        [client1, `{${habit1}}`],
      ),
    );
    await expect(
      asC1((tx) =>
        tx.query(`insert into checkins (client_id, day) values ($1, current_date)`, [client2]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asC1((tx) =>
        tx.query(
          `insert into checkins (client_id, day, habits) values ($1, current_date - 1, $2::uuid[])`,
          [client1, `{${habit2}}`],
        ),
      ),
    ).rejects.toThrow(/unknown habit/);
    const [c] = await asD((tx) =>
      tx.query<{ owner_id: string }>(`select owner_id from checkins where client_id = $1`, [
        client1,
      ]),
    );
    expect(c!.owner_id).toBe(D);
  });

  it('diary: nutrition is computed from the food database, never taken from the client', async () => {
    const [meal] = await asC1((tx) =>
      tx.query<{ id: string }>(
        `insert into diary_meals (client_id, eaten_on, slot) values ($1, current_date, 'breakfast') returning id`,
        [client1],
      ),
    );
    await asC1((tx) =>
      tx.query(
        `insert into diary_items (meal_id, food_id, name, unit_key, unit_qty, kcal, protein_g) values ($1, $2, 'Yumurta', 'piece', 2, 9999, 9999)`,
        [meal!.id, foodEgg],
      ),
    );
    await asC1((tx) =>
      tx.query(
        `insert into diary_items (meal_id, name, kcal) values ($1, 'Ev yapımı börek', 5000)`,
        [meal!.id],
      ),
    );
    const items = await asD((tx) =>
      tx.query<{
        name: string;
        grams: number | null;
        kcal: number | null;
        protein_g: number | null;
      }>(`select name, grams, kcal, protein_g from diary_items order by position, created_at`),
    );
    const egg = items.find((i) => i.name === 'Yumurta')!;
    expect(egg.grams).toBe(100);
    expect(egg.kcal).toBe(143);
    expect(egg.protein_g).toBeCloseTo(12.6, 1);
    expect(items.find((i) => i.name === 'Ev yapımı börek')!.kcal).toBeNull();

    // recipes: servings × per-serving values of the dietitian's recipe
    const [r] = await asD((tx) =>
      tx.query<{ id: string }>(
        `insert into recipes (published, servings) values (false, 1) returning id`,
      ),
    );
    await asD((tx) =>
      tx.query(`insert into recipe_ingredients (recipe_id, food_id, grams) values ($1, $2, 100)`, [
        r!.id,
        foodEgg,
      ]),
    );
    await asC1((tx) =>
      tx.query(
        `insert into diary_items (meal_id, recipe_id, name, servings, kcal) values ($1, $2, 'Menemen', 2, 1)`,
        [meal!.id, r!.id],
      ),
    );
    const [rec] = await asD((tx) =>
      tx.query<{ kcal: number }>(`select kcal from diary_items where recipe_id = $1`, [r!.id]),
    );
    expect(rec!.kcal).toBe(286);
  });

  it("a client cannot touch another client's diary", async () => {
    const [m] = await asC2((tx) =>
      tx.query<{ id: string }>(
        `insert into diary_meals (client_id, eaten_on, slot) values ($1, current_date, 'lunch') returning id`,
        [client2],
      ),
    );
    meal2 = m!.id;
    await expect(
      asC1((tx) => tx.query(`insert into diary_items (meal_id, name) values ($1, 'x')`, [meal2])),
    ).rejects.toThrow(/row-level security/);
    const seen = await asC1((tx) => tx.query(`select id from diary_meals where id = $1`, [meal2]));
    expect(seen).toHaveLength(0);
    const updated = await asC1((tx) =>
      tx.query(`update diary_meals set note = 'hacked' where id = $1 returning id`, [meal2]),
    );
    expect(updated).toHaveLength(0);
  });

  it('photos: only inside the own folder', async () => {
    await asC1((tx) =>
      tx.query(`insert into storage.objects (bucket_id, name) values ('diary-photos', $1)`, [
        `${D}/${client1}/a.jpg`,
      ]),
    );
    await expect(
      asC1((tx) =>
        tx.query(`insert into storage.objects (bucket_id, name) values ('diary-photos', $1)`, [
          `${D}/${client2}/b.jpg`,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asC1((tx) =>
        tx.query(`update diary_meals set photo_path = $2 where client_id = $1`, [
          client1,
          `${D}/${client2}/b.jpg`,
        ]),
      ),
    ).rejects.toThrow(/outside the client folder/);
    const dietitianSees = await asD((tx) =>
      tx.query(`select name from storage.objects where bucket_id = 'diary-photos'`),
    );
    expect(dietitianSees).toHaveLength(1);
    const c2Sees = await asC2((tx) =>
      tx.query(`select name from storage.objects where bucket_id = 'diary-photos'`),
    );
    expect(c2Sees).toHaveLength(0);
  });
});

describe('messages', () => {
  it('each side writes as itself; nobody edits; read receipts via the portal function', async () => {
    await asC1((tx) =>
      tx.query(`insert into messages (client_id, author, body) values ($1, 'client', 'Merhaba')`, [
        client1,
      ]),
    );
    await expect(
      asC1((tx) =>
        tx.query(
          `insert into messages (client_id, author, body) values ($1, 'dietitian', 'fake')`,
          [client1],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asC1((tx) =>
        tx.query(`insert into messages (client_id, author, body) values ($1, 'client', 'x')`, [
          client2,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    await asD((tx) =>
      tx.query(
        `insert into messages (client_id, author, body) values ($1, 'dietitian', 'Harika gidiyorsun')`,
        [client1],
      ),
    );
    await expect(
      asD((tx) =>
        tx.query(`insert into messages (client_id, author, body) values ($1, 'client', 'fake')`, [
          client1,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(asC1((tx) => tx.query(`update messages set body = 'edited'`))).rejects.toThrow(
      /permission denied/,
    );
    const [n] = await asC1((tx) => tx.query<{ n: number }>(`select portal_mark_read() as n`));
    expect(n!.n).toBe(1);
    const c2 = await asC2((tx) => tx.query(`select id from messages`));
    expect(c2).toHaveLength(0);
  });
});

describe('dietitian view', () => {
  it('sees all client-written data of the practice', async () => {
    const [row] = await asD((tx) =>
      tx.query<{ c: number; m: number; msg: number }>(
        `select (select count(*)::int from checkins) as c, (select count(*)::int from diary_meals) as m, (select count(*)::int from messages) as msg`,
      ),
    );
    expect(row).toEqual({ c: 1, m: 2, msg: 2 });
  });
});

describe('withdrawing consent', () => {
  it('stops all portal access at once', async () => {
    await asC2((tx) => tx.query(`select portal_withdraw_consent()`));
    const rows = await asC2((tx) => tx.query(`select id from diary_meals`));
    expect(rows).toHaveLength(0);
    const [p] = await asC2((tx) => tx.query<{ p: unknown }>(`select portal_program() as p`));
    expect(p!.p).toBeNull();
  });
});
