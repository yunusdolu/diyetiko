import 'server-only';
import { activityCols, messageFileCols, schemaFeatures } from '@/lib/db/features';
import { asUser } from '@/lib/db';
import type { Checkin, DiaryItem, DiaryMeal, Habit, Message } from '@/types/portal';
import { audit } from './clients';

/**
 * Dietitian side of the client portal. Every query runs as the dietitian (RLS: own practice);
 * clients' own rows are read-only here except habits (dietitian-managed) and message read marks.
 */

export type PortalState = 'none' | 'invited' | 'noConsent' | 'active';

export interface PortalAccess {
  state: PortalState;
  linked: boolean;
  consentAt: string | null;
  consentVersion: string | null;
  invite: { purpose: 'invite' | 'reset'; expiresAt: string; createdAt: string } | null;
  lastActivity: string | null;
}

export async function getPortalAccess(uid: string, clientId: string): Promise<PortalAccess | null> {
  return asUser(uid, async (tx) => {
    // three independent reads, pipelined in one round trip
    const [[c], [invite], [act]] = await Promise.all([
      tx.query<{
        user_id: string | null;
        portal_consent_at: string | null;
        portal_consent_version: string | null;
      }>(`select user_id, portal_consent_at, portal_consent_version from clients where id = $1`, [
        clientId,
      ]),
      tx.query<{
        purpose: 'invite' | 'reset';
        expires_at: string;
        created_at: string;
      }>(
        `select purpose, expires_at, created_at from client_invites
          where client_id = $1 and used_at is null and expires_at > now() order by created_at desc limit 1`,
        [clientId],
      ),
      tx.query<{ at: string | null }>(
        `select greatest(
           (select max(updated_at) from checkins where client_id = $1),
           (select max(updated_at) from diary_meals where client_id = $1),
           (select max(created_at) from messages where client_id = $1 and author = 'client')
         ) as at`,
        [clientId],
      ),
    ]);
    if (!c) return null;
    const linked = Boolean(c.user_id);
    const state: PortalState = linked
      ? c.portal_consent_at
        ? 'active'
        : 'noConsent'
      : invite
        ? 'invited'
        : 'none';
    return {
      state,
      linked,
      consentAt: c.portal_consent_at,
      consentVersion: c.portal_consent_version,
      invite: invite
        ? { purpose: invite.purpose, expiresAt: invite.expires_at, createdAt: invite.created_at }
        : null,
      lastActivity: act?.at ?? null,
    };
  });
}

/** Closes open invite links; returns the linked account id (to delete) if there is one. */
export async function closePortalAccess(
  uid: string,
  clientId: string,
): Promise<{ userId: string | null } | null> {
  return asUser(uid, async (tx) => {
    const [c] = await tx.query<{ user_id: string | null }>(
      `select user_id from clients where id = $1`,
      [clientId],
    );
    if (!c) return null;
    await tx.query(`delete from client_invites where client_id = $1 and used_at is null`, [
      clientId,
    ]);
    await audit(tx, uid, 'client.portal_revoke', 'client', clientId);
    return { userId: c.user_id };
  });
}

// --- habits ---------------------------------------------------------------------------------

export interface HabitRow extends Habit {
  active: boolean;
  position: number;
}

export async function listHabits(uid: string, clientId: string): Promise<HabitRow[]> {
  return asUser(uid, (tx) =>
    tx.query<HabitRow>(
      `select id, label, active, position from client_habits where client_id = $1 order by position, created_at`,
      [clientId],
    ),
  );
}

export async function addHabit(uid: string, clientId: string, label: string): Promise<void> {
  await asUser(uid, (tx) =>
    tx.query(
      `insert into client_habits (client_id, label, position)
       values ($1, $2, (select coalesce(max(position) + 1, 0) from client_habits where client_id = $1))`,
      [clientId, label],
    ),
  );
}

export async function updateHabit(
  uid: string,
  id: string,
  patch: { label?: string; active?: boolean },
): Promise<void> {
  await asUser(uid, async (tx) => {
    if (patch.label !== undefined)
      await tx.query(`update client_habits set label = $2, updated_at = now() where id = $1`, [
        id,
        patch.label,
      ]);
    if (patch.active !== undefined)
      await tx.query(`update client_habits set active = $2, updated_at = now() where id = $1`, [
        id,
        patch.active,
      ]);
  });
}

/** Deleting keeps past check-ins intact (they store habit ids; unknown ids are simply ignored). */
export async function deleteHabit(uid: string, id: string): Promise<void> {
  await asUser(uid, (tx) => tx.query(`delete from client_habits where id = $1`, [id]));
}

// --- check-ins + diary ------------------------------------------------------------------------

export async function listCheckins(
  uid: string,
  clientId: string,
  from: string,
  to: string,
): Promise<Checkin[]> {
  const activity = activityCols(await schemaFeatures(uid));
  return asUser(uid, (tx) =>
    tx.query<Checkin>(
      `select day::text as day, weight_kg, water_ml, habits::text[] as habits, energy, note, ${activity}
         from checkins where client_id = $1 and day between $2 and $3 order by day`,
      [clientId, from, to],
    ),
  );
}

export async function listDiary(
  uid: string,
  clientId: string,
  from: string,
  to: string,
): Promise<DiaryMeal[]> {
  return asUser(uid, async (tx) => {
    // the meals and their items selected by the same range: two reads, one round trip
    const [meals, items] = await Promise.all([
      tx.query<Omit<DiaryMeal, 'items'>>(
        `select id, eaten_on::text as eaten_on, slot::text as slot, time_label, note, left(md5(photo_path), 12) as photo_key
           from diary_meals where client_id = $1 and eaten_on between $2 and $3 order by eaten_on, slot`,
        [clientId, from, to],
      ),
      tx.query<DiaryItem & { meal_id: string }>(
        `select i.meal_id, i.id, i.name, i.food_id, i.recipe_id, i.grams, i.unit_key, i.unit_qty, i.servings,
                i.kcal, i.protein_g, i.carb_g, i.fat_g, i.fiber_g
           from diary_items i join diary_meals m on m.id = i.meal_id
          where m.client_id = $1 and m.eaten_on between $2 and $3
          order by i.position, i.created_at`,
        [clientId, from, to],
      ),
    ]);
    if (!meals.length) return [];
    return meals.map((m) => ({
      ...m,
      items: items.filter((i) => i.meal_id === m.id).map(({ meal_id: _m, ...i }) => i),
    }));
  });
}

export async function getDiaryPhotoPath(uid: string, mealId: string): Promise<string | null> {
  const [row] = await asUser(uid, (tx) =>
    tx.query<{ photo_path: string | null }>(`select photo_path from diary_meals where id = $1`, [
      mealId,
    ]),
  );
  return row?.photo_path ?? null;
}

/** Storage paths of every diary photo of a client (for hard delete). */
export async function diaryPhotoPaths(uid: string, clientId: string): Promise<string[]> {
  const rows = await asUser(uid, (tx) =>
    tx.query<{ photo_path: string }>(
      `select photo_path from diary_meals where client_id = $1 and photo_path is not null`,
      [clientId],
    ),
  );
  return rows.map((r) => r.photo_path);
}

// --- messages -------------------------------------------------------------------------------

export async function listMessages(uid: string, clientId: string, limit = 300): Promise<Message[]> {
  const files = messageFileCols(await schemaFeatures(uid));
  return asUser(uid, (tx) =>
    tx.query<Message>(
      `select * from (
         select m.id, m.author, m.body, m.diary_meal_id, d.slot::text as meal_slot, d.eaten_on::text as meal_day, m.read_at, m.created_at,
                ${files}
           from messages m left join diary_meals d on d.id = m.diary_meal_id
          where m.client_id = $1 order by m.created_at desc limit $2
       ) x order by created_at`,
      [clientId, limit],
    ),
  );
}

export async function sendMessage(
  uid: string,
  clientId: string,
  body: string,
  file?: { path: string; name: string; mime: string; size: number } | null,
): Promise<void> {
  if (!file) {
    // plain text: the statement every project understands
    await asUser(uid, (tx) =>
      tx.query(`insert into messages (client_id, author, body) values ($1, 'dietitian', $2)`, [
        clientId,
        body,
      ]),
    );
    return;
  }
  await asUser(uid, (tx) =>
    tx.query(
      `insert into messages (client_id, author, body, file_path, file_name, file_mime, file_size)
       values ($1, 'dietitian', $2, $3, $4, $5, $6)`,
      [
        clientId,
        body,
        file?.path ?? null,
        file?.name ?? null,
        file?.mime ?? null,
        file?.size ?? null,
      ],
    ),
  );
}

/** The file of a message in one of the dietitian's threads (RLS: own clients only). */
export async function getMessageFile(
  uid: string,
  messageId: string,
): Promise<{ path: string; name: string; mime: string; size: number } | null> {
  if (!(await schemaFeatures(uid)).uploads) return null;
  const [row] = await asUser(uid, (tx) =>
    tx.query<{ path: string; name: string; mime: string; size: number }>(
      `select file_path as path, file_name as name, file_mime as mime, file_size as size
         from messages where id = $1 and file_path is not null`,
      [messageId],
    ),
  );
  return row ?? null;
}

export interface SharedFile {
  /** the message that carries it */
  id: string;
  author: 'client' | 'dietitian';
  name: string;
  mime: string;
  size: number;
  body: string;
  created_at: string;
}

/** Every file exchanged with a client through messages, newest first. */
export async function listSharedFiles(uid: string, clientId: string): Promise<SharedFile[]> {
  if (!(await schemaFeatures(uid)).uploads) return [];
  return asUser(uid, (tx) =>
    tx.query<SharedFile>(
      `select id, author, file_name as name, file_mime as mime, file_size as size, body, created_at
         from messages where client_id = $1 and file_path is not null order by created_at desc`,
      [clientId],
    ),
  );
}

export async function markRead(uid: string, clientId: string): Promise<void> {
  await asUser(uid, (tx) =>
    tx.query(
      `update messages set read_at = now() where client_id = $1 and author = 'client' and read_at is null`,
      [clientId],
    ),
  );
}

export async function unreadTotal(uid: string): Promise<number> {
  const [row] = await asUser(uid, (tx) =>
    tx.query<{ n: number }>(
      `select count(*)::int as n from messages where author = 'client' and read_at is null`,
    ),
  );
  return row?.n ?? 0;
}

export interface InboxRow {
  client_id: string;
  full_name: string;
  unread: number;
  last_body: string;
  last_author: 'client' | 'dietitian';
  last_at: string;
  last_has_file: boolean;
}

/** One row per client with messages: newest first, unread counts for the dietitian. */
export async function inbox(uid: string): Promise<InboxRow[]> {
  const hasFile = (await schemaFeatures(uid)).uploads ? 'm.file_name is not null' : 'false';
  return asUser(uid, (tx) =>
    tx
      .query<InboxRow>(
        `select distinct on (m.client_id)
              m.client_id, c.full_name, m.body as last_body, m.author as last_author, m.created_at as last_at,
              ${hasFile} as last_has_file,
              (select count(*)::int from messages u where u.client_id = m.client_id and u.author = 'client' and u.read_at is null) as unread
         from messages m join clients c on c.id = m.client_id
        where c.deleted_at is null
        order by m.client_id, m.created_at desc`,
      )
      .then((rows) =>
        rows.sort((a, b) => b.unread - a.unread || Date.parse(b.last_at) - Date.parse(a.last_at)),
      ),
  );
}

/** Dashboard: what clients logged recently. */
export interface ActivityRow {
  client_id: string;
  full_name: string;
  kind: 'checkin' | 'diary' | 'message';
  at: string;
}

export async function recentActivity(uid: string, limit = 8): Promise<ActivityRow[]> {
  return asUser(uid, (tx) =>
    tx.query<ActivityRow>(
      // latest event per client and kind, newest first
      `select * from (
         select distinct on (a.client_id, a.kind) a.client_id, c.full_name, a.kind, a.at from (
           select client_id, 'checkin' as kind, updated_at as at from checkins
           union all select client_id, 'diary', updated_at from diary_meals
           union all select client_id, 'message', created_at from messages where author = 'client'
         ) a join clients c on c.id = a.client_id
         where c.deleted_at is null
         order by a.client_id, a.kind, a.at desc
       ) x order by at desc limit $1`,
      [limit],
    ),
  );
}

/** kcal target of the client's current (active) program, for the diary day totals. */
export async function activeTargetKcal(uid: string, clientId: string): Promise<number | null> {
  const [row] = await asUser(uid, (tx) =>
    tx.query<{ target_kcal: number | null }>(
      `select target_kcal from programs where client_id = $1 and status = 'active' and not is_template order by updated_at desc limit 1`,
      [clientId],
    ),
  );
  return row?.target_kcal ?? null;
}
