import 'server-only';
import { schemaFeatures } from '@/lib/db/features';
import { asUser, pgArray, type Tx } from '@/lib/db';
import type { Locale } from '@/lib/i18n/config';
import { addDays, todayISO } from '@/lib/portal/logic';
import type { Appointment } from '@/types/admin';
import {
  attention,
  goalJourney,
  nextBirthday,
  type AttentionRow,
  type ClientFacts,
  type GoalJourney,
  type WeightSample,
} from './signals';

/**
 * Dashboard data that needs more than a count: today's agenda, who needs attention, the goal
 * board, tasks. Every query runs as the dietitian (RLS); the decisions are made by the pure
 * functions in signals.ts.
 */

/** Istanbul has been UTC+3 all year since 2016 (no DST), so a calendar day starts at 00:00+03. */
export function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00+03:00`);
}

export interface AgendaItem extends Appointment {
  phone: string | null;
  language: Locale | null;
}

export interface Agenda {
  today: string;
  /** appointments of the 7 days starting today (all statuses), in time order */
  items: AgendaItem[];
  /** first scheduled appointment after those 7 days, for an empty week */
  next: AgendaItem | null;
}

const AGENDA_COLS = `a.id, a.client_id, c.full_name as client_name, c.phone, c.preferred_language::text as language, a.lead_id,
  a.title, a.starts_at, a.duration_min, a.kind::text as kind, a.status::text as status, a.note`;

export async function agenda(uid: string, today = todayISO()): Promise<Agenda> {
  return asUser(uid, async (tx) => {
    const from = dayStart(today);
    const to = dayStart(addDays(today, 7));
    // started together: pipelined in one round trip
    const [items, [next]] = await Promise.all([
      tx.query<AgendaItem>(
        `select ${AGENDA_COLS} from appointments a left join clients c on c.id = a.client_id
          where a.starts_at >= $1 and a.starts_at < $2 order by a.starts_at`,
        [from.toISOString(), to.toISOString()],
      ),
      tx.query<AgendaItem>(
        `select ${AGENDA_COLS} from appointments a left join clients c on c.id = a.client_id
          where a.starts_at >= $1 and a.status = 'scheduled' order by a.starts_at limit 1`,
        [to.toISOString()],
      ),
    ]);
    return { today, items, next: next ?? null };
  });
}

// ---- tasks --------------------------------------------------------------------------------------

export interface TaskRow {
  id: string;
  title: string;
  due_on: string | null;
  done_at: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  /** the client sees it in their portal and can tick it */
  shared: boolean;
}

/** "relation does not exist": the tasks migration (…000005_tasks.sql) is not applied yet. */
function missingTable(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '42P01';
}

/**
 * Open tasks plus the ones finished in the last day (so a tick can be undone). `null` when the
 * database does not have the tasks table yet — the panel then explains instead of failing.
 */
export async function listTasks(
  uid: string,
  opts: { clientId?: string } = {},
): Promise<TaskRow[] | null> {
  try {
    // No await before the transaction is queued: the dashboard waits for this list from inside
    // another transaction, and the local database has one connection. Reading the column through
    // to_jsonb works whether or not the project has it yet.
    return await asUser(uid, (tx) =>
      tx.query<TaskRow>(
        `select t.id, t.title, t.due_on::text as due_on, t.done_at, t.client_id, c.full_name as client_name, t.created_at,
                coalesce((to_jsonb(t) ->> 'shared')::boolean, false) as shared
           from tasks t left join clients c on c.id = t.client_id
          where (t.done_at is null or t.done_at > now() - interval '1 day')
            ${opts.clientId ? 'and t.client_id = $1' : ''}
          order by t.done_at is not null, t.due_on nulls last, t.created_at`,
        opts.clientId ? [opts.clientId] : [],
      ),
    );
  } catch (e) {
    if (missingTable(e)) return null;
    throw e;
  }
}

export async function addTask(
  uid: string,
  t: { title: string; due_on: string | null; client_id: string | null; shared?: boolean },
): Promise<void> {
  // shown to the client only when the task has one and the project knows the column
  const share = Boolean(t.shared && t.client_id) && (await schemaFeatures(uid)).care;
  await asUser(uid, (tx) =>
    share
      ? tx.query(`insert into tasks (title, due_on, client_id, shared) values ($1, $2, $3, true)`, [
          t.title,
          t.due_on,
          t.client_id,
        ])
      : tx.query(`insert into tasks (title, due_on, client_id) values ($1, $2, $3)`, [
          t.title,
          t.due_on,
          t.client_id,
        ]),
  );
}

export async function setTaskDone(uid: string, id: string, done: boolean): Promise<void> {
  await asUser(uid, (tx) =>
    tx.query(`update tasks set done_at = ${done ? 'now()' : 'null'} where id = $1`, [id]),
  );
}

export async function setTaskDue(uid: string, id: string, due: string | null): Promise<void> {
  await asUser(uid, (tx) => tx.query(`update tasks set due_on = $2 where id = $1`, [id, due]));
}

export async function deleteTask(uid: string, id: string): Promise<void> {
  await asUser(uid, (tx) => tx.query(`delete from tasks where id = $1`, [id]));
}

// ---- weights ------------------------------------------------------------------------------------

type WeightRow = WeightSample & { client_id: string };

/** Check-in (self) and clinic weights of the clients matching `where` (a condition on client_id). */
const weightsSql = (where: string) =>
  `select client_id, day::text as day, weight_kg as kg, 'self' as source
     from checkins where weight_kg is not null and ${where}
   union all
   select client_id, measured_at::text, weight_kg, 'clinic'
     from measurements where weight_kg is not null and ${where}`;

function groupWeights(rows: WeightRow[], ids: string[]): Map<string, WeightSample[]> {
  const out = new Map<string, WeightSample[]>(ids.map((id) => [id, []]));
  for (const r of rows)
    out.get(r.client_id)?.push({ day: r.day, kg: Number(r.kg), source: r.source });
  return out;
}

/** Every weight of the given clients: check-ins (self) and clinic measurements. */
async function weightsOf(tx: Tx, ids: string[]): Promise<Map<string, WeightSample[]>> {
  if (!ids.length) return groupWeights([], ids);
  const rows = await tx.query<WeightRow>(weightsSql('client_id = any($1::uuid[])'), [pgArray(ids)]);
  return groupWeights(rows, ids);
}

export async function clientWeights(uid: string, clientId: string): Promise<WeightSample[]> {
  return asUser(uid, async (tx) => (await weightsOf(tx, [clientId])).get(clientId) ?? []);
}

// ---- needs attention + goal board ---------------------------------------------------------------

export interface BirthdayRow {
  id: string;
  full_name: string;
  phone: string | null;
  language: Locale;
  /** 0 = today */
  days: number;
  turns: number;
}

export interface GoalRow {
  id: string;
  full_name: string;
  journey: GoalJourney;
}

export async function practiceSignals(
  uid: string,
  today = todayISO(),
  /** the task list, or its pending load (both then run at the same time) */
  tasksOrPending: TaskRow[] | null | Promise<TaskRow[] | null> = null,
): Promise<{ attention: AttentionRow[]; goals: GoalRow[]; birthdays: BirthdayRow[] }> {
  return asUser(uid, async (tx) => {
    const factsQuery = tx.query<{
      id: string;
      full_name: string;
      created_at: string;
      goal_weight_kg: number | null;
      kvkk: boolean;
      on_portal: boolean;
      unread: number;
      last_checkin: string | null;
      last_diary: string | null;
      last_message_at: string | null;
      last_measured: string | null;
      has_next: boolean;
      last_appointment_at: string | null;
      birth_date: string | null;
      phone: string | null;
      language: Locale;
    }>(
      `select c.id, c.full_name, c.created_at, c.goal_weight_kg, c.kvkk_consent_at is not null as kvkk,
              (c.user_id is not null and c.portal_consent_at is not null) as on_portal,
              (select count(*)::int from messages m where m.client_id = c.id and m.author = 'client' and m.read_at is null) as unread,
              (select max(k.day)::text from checkins k where k.client_id = c.id) as last_checkin,
              (select max(d.eaten_on)::text from diary_meals d where d.client_id = c.id) as last_diary,
              (select max(m.created_at) from messages m where m.client_id = c.id and m.author = 'client') as last_message_at,
              (select max(x.measured_at)::text from measurements x where x.client_id = c.id) as last_measured,
              exists (select 1 from appointments a where a.client_id = c.id and a.status = 'scheduled' and a.starts_at > now()) as has_next,
              (select max(a.starts_at) from appointments a where a.client_id = c.id and a.status = 'done') as last_appointment_at,
              c.birth_date::text as birth_date, c.phone, c.preferred_language::text as language
         from clients c
        where c.deleted_at is null and c.status = 'active'`,
    );
    // the same clients' weights, started at the same time (pipelined)
    const weightsQuery = tx.query<WeightRow>(
      weightsSql(
        `client_id in (select id from clients where deleted_at is null and status = 'active')`,
      ),
    );
    const [rows, weightRows, tasks] = await Promise.all([
      factsQuery,
      weightsQuery,
      Promise.resolve(tasksOrPending),
    ]);
    const weights = groupWeights(
      weightRows,
      rows.map((r) => r.id),
    );
    const overdue = new Map<string, number>();
    for (const t of tasks ?? [])
      if (t.client_id && !t.done_at && t.due_on && t.due_on < today)
        overdue.set(t.client_id, (overdue.get(t.client_id) ?? 0) + 1);

    const day = (ts: string | null) => (ts ? todayISO(new Date(ts)) : null);
    const latest = (...days: (string | null)[]) =>
      days
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1) ?? null;
    const facts: ClientFacts[] = rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      since: day(r.created_at)!,
      goal_weight_kg: r.goal_weight_kg == null ? null : Number(r.goal_weight_kg),
      kvkk: r.kvkk,
      onPortal: r.on_portal,
      unread: r.unread,
      lastActivity: latest(r.last_checkin, r.last_diary, day(r.last_message_at)),
      lastMeasured: r.last_measured,
      hasNextAppointment: r.has_next,
      lastAppointment: day(r.last_appointment_at),
      overdueTasks: overdue.get(r.id) ?? 0,
      weights: weights.get(r.id) ?? [],
    }));

    const goals: GoalRow[] = [];
    for (const f of facts) {
      const journey = goalJourney(f.weights, f.goal_weight_kg);
      if (journey && journey.direction !== 'maintain')
        goals.push({ id: f.id, full_name: f.full_name, journey });
    }
    goals.sort((a, b) => b.journey.progress - a.journey.progress);
    // birthdays in the coming week (active clients with a date of birth)
    const birthdays: BirthdayRow[] = rows
      .filter((r) => r.birth_date)
      .map((r) => ({
        id: r.id,
        full_name: r.full_name,
        phone: r.phone,
        language: r.language,
        ...nextBirthday(r.birth_date!, today),
      }))
      .filter((b) => b.days <= 6)
      .sort((a, b) => a.days - b.days || a.full_name.localeCompare(b.full_name, 'tr'));
    return { attention: attention(facts, today), goals, birthdays };
  });
}

// ---- pulse (KPI sparklines) ---------------------------------------------------------------------

export interface Pulse {
  /** check-ins per day, the last 14 days ending today (oldest first) */
  checkins: { day: string; count: number }[];
  /** appointments (scheduled or done) per week, the last 8 weeks ending this week */
  appointmentsByWeek: { week: string; count: number }[];
}

export async function pulse(uid: string, today = todayISO()): Promise<Pulse> {
  return asUser(uid, async (tx) => {
    const from = addDays(today, -13);
    const [rows, appointmentsByWeek] = await Promise.all([
      tx.query<{ day: string; n: number }>(
        `select day::text as day, count(*)::int as n from checkins where day between $1 and $2 group by day`,
        [from, today],
      ),
      tx.query<{ week: string; count: number }>(
        `select to_char(w, 'YYYY-MM-DD') as week,
                (select count(*)::int from appointments a
                  where a.starts_at >= w and a.starts_at < w + interval '7 days' and a.status in ('scheduled', 'done')) as count
           from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '7 days') w
          order by w`,
      ),
    ]);
    const byDay = new Map(rows.map((r) => [r.day, r.n]));
    const checkins = Array.from({ length: 14 }, (_, i) => {
      const day = addDays(from, i);
      return { day, count: byDay.get(day) ?? 0 };
    });
    return { checkins, appointmentsByWeek };
  });
}
