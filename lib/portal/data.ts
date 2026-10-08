import 'server-only';
import { activityCols, messageFileCols, schemaFeatures } from '@/lib/db/features';
import { asUser, pgArray, type Tx } from '@/lib/db';
import type { Locale } from '@/lib/i18n/config';
import type {
  Appointment,
  Checkin,
  DiaryItem,
  DiaryMeal,
  FoodOption,
  Habit,
  MealSlot,
  Measurement,
  Message,
  PortalProfile,
  PortalProgram,
  PortalBilling,
  PortalTask,
} from '@/types/portal';
import { addDays } from './logic';

/**
 * Client-side data access. Every call runs AS THE CLIENT (their own auth.uid()): RLS and the
 * portal_* functions decide what exists for them. Nothing here uses the service role.
 */

async function fn<T>(tx: Tx, sql: string, params: (string | number | null)[] = []): Promise<T> {
  const [row] = await tx.query<{ v: T }>(`select ${sql} as v`, params);
  return row!.v;
}

export async function getProfile(uid: string): Promise<PortalProfile | null> {
  return asUser(uid, (tx) => fn<PortalProfile | null>(tx, 'portal_profile()'));
}

export async function getProgram(uid: string): Promise<PortalProgram | null> {
  return asUser(uid, (tx) => fn<PortalProgram | null>(tx, 'portal_program()'));
}

export async function getFoods(uid: string, locale: Locale): Promise<FoodOption[]> {
  return asUser(uid, (tx) => fn<FoodOption[]>(tx, 'portal_foods($1::locale_code)', [locale]));
}

export async function getHabits(uid: string): Promise<Habit[]> {
  return asUser(uid, (tx) =>
    tx.query<Habit>(
      `select id, label from client_habits where active order by position, created_at`,
    ),
  );
}

const CHECKIN_BASE = `day::text as day, weight_kg, water_ml, habits::text[] as habits, energy, note`;
/** the check-in's columns (movement only where the project has those columns) */
async function checkinCols(uid: string): Promise<string> {
  return `${CHECKIN_BASE}, ${activityCols(await schemaFeatures(uid))}`;
}

export async function getCheckins(uid: string, from: string, to: string): Promise<Checkin[]> {
  const CHECKIN_COLS = await checkinCols(uid);
  return asUser(uid, (tx) =>
    tx.query<Checkin>(
      `select ${CHECKIN_COLS} from checkins where day between $1 and $2 order by day`,
      [from, to],
    ),
  );
}

export async function saveCheckin(
  uid: string,
  clientId: string,
  day: string,
  patch: {
    weight_kg?: number | null;
    water_ml?: number | null;
    habits?: string[];
    energy?: number | null;
    note?: string | null;
    activity_min?: number | null;
    activity_note?: string | null;
  },
): Promise<Checkin> {
  const features = await schemaFeatures(uid);
  const CHECKIN_COLS = await checkinCols(uid);
  if (!features.activity) {
    // the project has no movement columns yet: that part of the patch is left out
    delete patch.activity_min;
    delete patch.activity_note;
  }
  return asUser(uid, async (tx) => {
    const cols = Object.keys(patch) as (keyof typeof patch)[];
    const values = cols.map((k) =>
      k === 'habits' ? pgArray(patch.habits ?? []) : (patch[k] as string | number | null),
    );
    const insertCols = ['client_id', 'day', ...cols];
    const params = [clientId, day, ...values];
    const placeholders = insertCols.map((c, i) =>
      c === 'habits' ? `$${i + 1}::uuid[]` : `$${i + 1}`,
    );
    const updates = cols.map((c) => `${c} = excluded.${c}`);
    const [row] = await tx.query<Checkin>(
      `insert into checkins (${insertCols.join(', ')}) values (${placeholders.join(', ')})
       on conflict (client_id, day) do ${updates.length ? `update set ${updates.join(', ')}` : 'nothing'}
       returning ${CHECKIN_COLS}`,
      params,
    );
    if (row) return row;
    const [existing] = await tx.query<Checkin>(
      `select ${CHECKIN_COLS} from checkins where client_id = $1 and day = $2`,
      [clientId, day],
    );
    return existing!;
  });
}

const ITEM_COLS = `id, name, food_id, recipe_id, grams, unit_key, unit_qty, servings, kcal, protein_g, carb_g, fat_g, fiber_g`;

export async function getDiary(uid: string, from: string, to: string): Promise<DiaryMeal[]> {
  return asUser(uid, async (tx) => {
    const meals = await tx.query<Omit<DiaryMeal, 'items'>>(
      `select id, eaten_on::text as eaten_on, slot::text as slot, time_label, note, left(md5(photo_path), 12) as photo_key
         from diary_meals where eaten_on between $1 and $2 order by eaten_on, slot`,
      [from, to],
    );
    if (!meals.length) return [];
    const items = await tx.query<DiaryItem & { meal_id: string }>(
      `select meal_id, ${ITEM_COLS} from diary_items where meal_id = any($1::uuid[]) order by position, created_at`,
      [pgArray(meals.map((m) => m.id))],
    );
    return meals.map((m) => ({
      ...m,
      items: items.filter((i) => i.meal_id === m.id).map(({ meal_id: _meal, ...i }) => i),
    }));
  });
}

async function ensureMeal(tx: Tx, clientId: string, day: string, slot: MealSlot): Promise<string> {
  const [row] = await tx.query<{ id: string }>(
    `insert into diary_meals (client_id, eaten_on, slot) values ($1, $2, $3)
     on conflict (client_id, eaten_on, slot) do update set updated_at = now()
     returning id`,
    [clientId, day, slot],
  );
  return row!.id;
}

export type NewDiaryItem =
  | {
      kind: 'food';
      foodId: string;
      name: string;
      unitKey: string | null;
      unitQty: number | null;
      grams: number | null;
    }
  | { kind: 'recipe'; recipeId: string; name: string; servings: number }
  | { kind: 'free'; name: string };

export async function addDiaryItems(
  uid: string,
  clientId: string,
  day: string,
  slot: MealSlot,
  items: NewDiaryItem[],
): Promise<string> {
  return asUser(uid, async (tx) => {
    const mealId = await ensureMeal(tx, clientId, day, slot);
    const [pos] = await tx.query<{ n: number }>(
      `select coalesce(max(position) + 1, 0)::int as n from diary_items where meal_id = $1`,
      [mealId],
    );
    let position = pos!.n;
    for (const item of items) {
      if (item.kind === 'food') {
        await tx.query(
          `insert into diary_items (meal_id, food_id, name, unit_key, unit_qty, grams, position) values ($1, $2, $3, $4, $5, $6, $7)`,
          [mealId, item.foodId, item.name, item.unitKey, item.unitQty, item.grams, position++],
        );
      } else if (item.kind === 'recipe') {
        await tx.query(
          `insert into diary_items (meal_id, recipe_id, name, servings, position) values ($1, $2, $3, $4, $5)`,
          [mealId, item.recipeId, item.name, item.servings, position++],
        );
      } else {
        await tx.query(`insert into diary_items (meal_id, name, position) values ($1, $2, $3)`, [
          mealId,
          item.name,
          position++,
        ]);
      }
    }
    return mealId;
  });
}

/** Removes an item; an emptied meal without note/photo disappears too. Returns a photo path to delete, if any. */
export async function removeDiaryItem(uid: string, itemId: string): Promise<void> {
  await asUser(uid, async (tx) => {
    const [row] = await tx.query<{ meal_id: string }>(
      `delete from diary_items where id = $1 returning meal_id`,
      [itemId],
    );
    if (!row) return;
    await tx.query(
      `delete from diary_meals m where m.id = $1 and m.note is null and m.photo_path is null
         and not exists (select 1 from diary_items i where i.meal_id = m.id)`,
      [row.meal_id],
    );
  });
}

export async function updateMeal(
  uid: string,
  clientId: string,
  day: string,
  slot: MealSlot,
  patch: { note?: string | null; time_label?: string | null },
): Promise<string> {
  return asUser(uid, async (tx) => {
    const mealId = await ensureMeal(tx, clientId, day, slot);
    if ('note' in patch)
      await tx.query(`update diary_meals set note = $2 where id = $1`, [
        mealId,
        patch.note ?? null,
      ]);
    if ('time_label' in patch)
      await tx.query(`update diary_meals set time_label = $2 where id = $1`, [
        mealId,
        patch.time_label ?? null,
      ]);
    return mealId;
  });
}

/** Folder the client may upload into ("<dietitian>/<client>/"), enforced again by storage RLS. */
export async function photoPrefix(uid: string): Promise<string | null> {
  return asUser(uid, (tx) => fn<string | null>(tx, 'my_photo_prefix()'));
}

export async function setMealPhoto(
  uid: string,
  clientId: string,
  day: string,
  slot: MealSlot,
  path: string | null,
): Promise<{ mealId: string; previous: string | null }> {
  return asUser(uid, async (tx) => {
    const mealId = await ensureMeal(tx, clientId, day, slot);
    const [prev] = await tx.query<{ photo_path: string | null }>(
      `select photo_path from diary_meals where id = $1`,
      [mealId],
    );
    await tx.query(`update diary_meals set photo_path = $2 where id = $1`, [mealId, path]);
    return { mealId, previous: prev?.photo_path ?? null };
  });
}

export async function getMealPhotoPath(uid: string, mealId: string): Promise<string | null> {
  const [row] = await asUser(uid, (tx) =>
    tx.query<{ photo_path: string | null }>(`select photo_path from diary_meals where id = $1`, [
      mealId,
    ]),
  );
  return row?.photo_path ?? null;
}

export async function getMessages(uid: string, limit = 200): Promise<Message[]> {
  const files = messageFileCols(await schemaFeatures(uid));
  return asUser(uid, (tx) =>
    tx.query<Message>(
      `select * from (
         select m.id, m.author, m.body, m.diary_meal_id, d.slot::text as meal_slot, d.eaten_on::text as meal_day, m.read_at, m.created_at,
                ${files}
           from messages m left join diary_meals d on d.id = m.diary_meal_id
          order by m.created_at desc limit $1
       ) x order by created_at`,
      [limit],
    ),
  );
}

/** A diary meal the client wants to ask about (RLS: only their own). */
export async function getMealRef(
  uid: string,
  mealId: string,
): Promise<{ id: string; slot: MealSlot; day: string } | null> {
  const [row] = await asUser(uid, (tx) =>
    tx.query<{ id: string; slot: MealSlot; day: string }>(
      `select id, slot::text as slot, eaten_on::text as day from diary_meals where id = $1`,
      [mealId],
    ),
  );
  return row ?? null;
}

export async function sendMessage(
  uid: string,
  clientId: string,
  body: string,
  diaryMealId: string | null,
  file?: MessageFile | null,
): Promise<void> {
  if (!file) {
    // plain text: the statement every project understands
    await asUser(uid, (tx) =>
      tx.query(
        `insert into messages (client_id, author, body, diary_meal_id) values ($1, 'client', $2, $3)`,
        [clientId, body, diaryMealId],
      ),
    );
    return;
  }
  await asUser(uid, (tx) =>
    tx.query(
      `insert into messages (client_id, author, body, diary_meal_id, file_path, file_name, file_mime, file_size)
       values ($1, 'client', $2, $3, $4, $5, $6, $7)`,
      [
        clientId,
        body,
        diaryMealId,
        file?.path ?? null,
        file?.name ?? null,
        file?.mime ?? null,
        file?.size ?? null,
      ],
    ),
  );
}

export interface MessageFile {
  path: string;
  name: string;
  mime: string;
  size: number;
}

/** The file of one of the client's own messages (RLS: only their own thread resolves). */
export async function getMessageFile(uid: string, messageId: string): Promise<MessageFile | null> {
  if (!(await schemaFeatures(uid)).uploads) return null;
  const [row] = await asUser(uid, (tx) =>
    tx.query<MessageFile>(
      `select file_path as path, file_name as name, file_mime as mime, file_size as size
         from messages where id = $1 and file_path is not null`,
      [messageId],
    ),
  );
  return row ?? null;
}

export async function markMessagesRead(uid: string): Promise<void> {
  await asUser(uid, (tx) => tx.query(`select portal_mark_read()`));
}

export async function unreadCount(uid: string): Promise<number> {
  const [row] = await asUser(uid, (tx) =>
    tx.query<{ n: number }>(
      `select count(*)::int as n from messages where author = 'dietitian' and read_at is null`,
    ),
  );
  return row?.n ?? 0;
}

export async function getMeasurements(uid: string): Promise<Measurement[]> {
  return asUser(uid, (tx) => fn<Measurement[]>(tx, 'portal_measurements()'));
}

export async function getAppointments(uid: string): Promise<Appointment[]> {
  return asUser(uid, (tx) => fn<Appointment[]>(tx, 'portal_appointments()'));
}

export async function giveConsent(uid: string, version: string): Promise<boolean> {
  return asUser(uid, (tx) => fn<boolean>(tx, 'portal_give_consent($1)', [version]));
}

export async function withdrawConsent(uid: string): Promise<boolean> {
  return asUser(uid, (tx) => fn<boolean>(tx, 'portal_withdraw_consent()'));
}

/** Everything the client wrote + what the portal shows them (KVKK right of access). */
export async function exportOwnData(uid: string, today: string) {
  const [profile, program, measurements, appointments, messages] = await Promise.all([
    getProfile(uid),
    getProgram(uid),
    getMeasurements(uid),
    getAppointments(uid),
    getMessages(uid, 10000),
  ]);
  const from = addDays(today, -3650);
  const [checkins, diary, habits] = await Promise.all([
    getCheckins(uid, from, today),
    getDiary(uid, from, today),
    getHabits(uid),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile,
    program,
    measurements,
    appointments,
    habits,
    checkins,
    diary,
    messages,
  };
}

export const PORTAL_CONSENT_VERSION = 'portal-2026-01';

// ---- shared tasks + own billing (migration …000010_client_care.sql) --------------------------------

export async function getTasks(uid: string): Promise<PortalTask[]> {
  if (!(await schemaFeatures(uid)).care) return [];
  return asUser(uid, (tx) => fn<PortalTask[]>(tx, 'portal_tasks()'));
}

export async function setTaskDone(uid: string, id: string, done: boolean): Promise<boolean> {
  if (!(await schemaFeatures(uid)).care) return false;
  return asUser(uid, (tx) =>
    fn<boolean>(tx, 'portal_task_done($1, $2::boolean)', [id, done ? 'true' : 'false']),
  );
}

/** `null`: the project does not have the billing tables / function yet. */
export async function getBilling(uid: string): Promise<PortalBilling | null> {
  if (!(await schemaFeatures(uid)).care) return null;
  return asUser(uid, (tx) => fn<PortalBilling>(tx, 'portal_billing()')).catch(() => null);
}
