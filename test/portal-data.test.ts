/**
 * The portal data layer (lib/portal/data.ts) and the invite flow (lib/portal/invites.ts) against
 * the full demo database in memory, acting as the demo client and the dietitian.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDriverForTests } from '@/lib/db';
import {
  LOCAL_ADMIN_ID,
  LOCAL_CLIENT_ID,
  createLocalDatabase,
  pgliteDriver,
} from '@/lib/db/pglite';
import * as portal from '@/lib/portal/data';
import { createInvite, peekInvite, redeemInvite } from '@/lib/portal/invites';

let db: PGlite;
let clientId = '';
const TODAY = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  db = await createLocalDatabase(undefined);
  setDriverForTests(pgliteDriver(() => Promise.resolve(db)));
  const { rows } = await db.query<{ id: string }>(`select id from clients where user_id = $1`, [
    LOCAL_CLIENT_ID,
  ]);
  clientId = rows[0]!.id;
});

afterAll(async () => {
  await db?.close();
});

describe('check-ins', () => {
  it('saves partial updates without wiping other fields', async () => {
    const habits = await portal.getHabits(LOCAL_CLIENT_ID);
    await portal.saveCheckin(LOCAL_CLIENT_ID, clientId, TODAY, { water_ml: 750 });
    await portal.saveCheckin(LOCAL_CLIENT_ID, clientId, TODAY, { habits: [habits[0]!.id] });
    const saved = await portal.saveCheckin(LOCAL_CLIENT_ID, clientId, TODAY, { weight_kg: 70.4 });
    expect(saved).toMatchObject({
      day: TODAY,
      water_ml: 750,
      weight_kg: 70.4,
      habits: [habits[0]!.id],
    });
  });
});

describe('diary', () => {
  it('adds food, recipe and free-text items to a meal; values come from the database', async () => {
    const foods = await portal.getFoods(LOCAL_CLIENT_ID, 'tr');
    const egg = foods.find((f) => f.key === 'egg')!;
    expect(egg.name).toBe('Yumurta');
    const program = await portal.getProgram(LOCAL_CLIENT_ID);
    const recipeItem = program!.days
      .flatMap((d) => d.meals.flatMap((m) => m.items))
      .find((i) => i.recipeId)!;
    await portal.addDiaryItems(LOCAL_CLIENT_ID, clientId, TODAY, 'breakfast', [
      { kind: 'food', foodId: egg.id, name: egg.name, unitKey: 'piece', unitQty: 2, grams: null },
      { kind: 'recipe', recipeId: recipeItem.recipeId!, name: recipeItem.name, servings: 1 },
      { kind: 'free', name: 'Simit' },
    ]);
    const [meal] = (await portal.getDiary(LOCAL_CLIENT_ID, TODAY, TODAY)).filter(
      (m) => m.slot === 'breakfast',
    );
    expect(meal!.items.map((i) => i.name)).toEqual(['Yumurta', recipeItem.name, 'Simit']);
    expect(meal!.items[0]!.kcal).toBe(143);
    expect(meal!.items[1]!.kcal).toBeCloseTo(recipeItem.kcal, 0);
    expect(meal!.items[2]!.kcal).toBeNull();
  });

  it('removing the last item of an empty meal removes the meal', async () => {
    const [meal] = (await portal.getDiary(LOCAL_CLIENT_ID, TODAY, TODAY)).filter(
      (m) => m.slot === 'breakfast',
    );
    for (const item of meal!.items) await portal.removeDiaryItem(LOCAL_CLIENT_ID, item.id);
    expect(
      (await portal.getDiary(LOCAL_CLIENT_ID, TODAY, TODAY)).filter((m) => m.slot === 'breakfast'),
    ).toHaveLength(0);
  });

  it('a meal note keeps the meal alive', async () => {
    await portal.updateMeal(LOCAL_CLIENT_ID, clientId, TODAY, 'dinner', {
      note: 'Dışarıda yedim',
      time_label: '20:15',
    });
    const [meal] = (await portal.getDiary(LOCAL_CLIENT_ID, TODAY, TODAY)).filter(
      (m) => m.slot === 'dinner',
    );
    expect(meal).toMatchObject({ note: 'Dışarıda yedim', time_label: '20:15', items: [] });
  });

  it('photo paths are limited to the client folder', async () => {
    const prefix = await portal.photoPrefix(LOCAL_CLIENT_ID);
    expect(prefix).toBe(`${LOCAL_ADMIN_ID}/${clientId}/`);
    await portal.setMealPhoto(LOCAL_CLIENT_ID, clientId, TODAY, 'dinner', `${prefix}a.jpg`);
    await expect(
      portal.setMealPhoto(
        LOCAL_CLIENT_ID,
        clientId,
        TODAY,
        'dinner',
        `${LOCAL_ADMIN_ID}/other/a.jpg`,
      ),
    ).rejects.toThrow(/outside the client folder/);
  });
});

describe('messages', () => {
  it('sends, counts unread and marks read', async () => {
    await portal.sendMessage(LOCAL_CLIENT_ID, clientId, 'Test mesajı', null);
    const thread = await portal.getMessages(LOCAL_CLIENT_ID);
    expect(thread.at(-1)).toMatchObject({ author: 'client', body: 'Test mesajı' });
    expect(await portal.unreadCount(LOCAL_CLIENT_ID)).toBe(0); // demo replies are already read
    await db.query(
      `insert into messages (client_id, author, body) values ($1, 'dietitian', 'Yeni')`,
      [clientId],
    );
    expect(await portal.unreadCount(LOCAL_CLIENT_ID)).toBe(1);
    await portal.markMessagesRead(LOCAL_CLIENT_ID);
    expect(await portal.unreadCount(LOCAL_CLIENT_ID)).toBe(0);
  });
});

describe('sanitized reads', () => {
  it('profile, measurements and export contain no internal notes', async () => {
    const data = await portal.exportOwnData(LOCAL_CLIENT_ID, TODAY);
    expect(data.profile?.firstName).toBe('Deniz');
    expect(data.measurements.length).toBeGreaterThan(5);
    const text = JSON.stringify(data);
    expect(text).not.toContain('İlk görüşme'); // a private dietitian note of this client
    expect(text).not.toContain('Laktoz'); // allergies/medical notes stay internal
  });
});

describe('invites', () => {
  it('invite → account → linked; the same link cannot be used twice', async () => {
    const [other] = (
      await db.query<{ id: string; email: string }>(
        `select id, email from clients where user_id is null and email is not null and deleted_at is null limit 1`,
      )
    ).rows;
    const created = await createInvite(LOCAL_ADMIN_ID, other!.id, 'invite');
    expect(created.ok).toBe(true);
    const token = created.ok ? created.url.split('/').pop()! : '';
    const peek = await peekInvite(token);
    expect(peek).toMatchObject({ purpose: 'invite', email: other!.email });
    const redeemed = await redeemInvite(token, 'yeni-sifre-2026', peek!.firstName);
    expect(redeemed.ok).toBe(true);
    expect(await peekInvite(token)).toBeNull();
    expect((await redeemInvite(token, 'baska-sifre-2026', 'x')).ok).toBe(false);
    const [link] = (
      await db.query<{ role: string }>(
        `select p.role::text as role from clients c join profiles p on p.id = c.user_id where c.id = $1`,
        [other!.id],
      )
    ).rows;
    expect(link!.role).toBe('client');
  });

  it('refuses an invite for an already linked client, and a reset for an unlinked one', async () => {
    expect(await createInvite(LOCAL_ADMIN_ID, clientId, 'invite')).toEqual({
      ok: false,
      error: 'alreadyLinked',
    });
    const [unlinked] = (
      await db.query<{ id: string }>(
        `select id from clients where user_id is null and deleted_at is null limit 1`,
      )
    ).rows;
    expect(await createInvite(LOCAL_ADMIN_ID, unlinked!.id, 'reset')).toEqual({
      ok: false,
      error: 'notLinked',
    });
  });

  it('a client cannot create invites', async () => {
    await expect(createInvite(LOCAL_CLIENT_ID, clientId, 'reset')).resolves.toEqual({
      ok: false,
      error: 'notFound',
    });
  });
});
