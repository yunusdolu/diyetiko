/** Pure helpers for the client portal (no I/O — unit tested in logic.test.ts). */
import type { Checkin, DiaryMeal, PortalProgram, Totals } from '@/types/portal';

/** The practice works in Istanbul time; a client's "today" follows it. */
export const PORTAL_TZ = 'Europe/Istanbul';

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO(now: Date = new Date(), timeZone = PORTAL_TZ): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
}

/** A valid ISO day not in the future and not older than a year; otherwise today. */
export function clampDay(value: string | undefined | null, today: string): string {
  if (!value || !ISO_DAY.test(value) || Number.isNaN(Date.parse(value))) return today;
  const diff = daysBetween(value, today);
  if (diff < 0 || diff > 366) return today;
  return value;
}

/**
 * Which program day applies on `day`: counted from starts_on when set, otherwise by weekday
 * (Monday = day 1). Wraps around the number of days in the program.
 */
export function programDayIndex(
  program: Pick<PortalProgram, 'startsOn' | 'days'>,
  day: string,
): number {
  const n = program.days.length;
  if (n === 0) return -1;
  if (program.startsOn && ISO_DAY.test(program.startsOn)) {
    const offset = daysBetween(program.startsOn, day);
    return ((offset % n) + n) % n;
  }
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return weekday % n;
}

export function diaryTotals(meals: Pick<DiaryMeal, 'items'>[]): Totals {
  const t: Totals = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0, unknown: 0 };
  for (const m of meals) {
    for (const i of m.items) {
      if (i.kcal == null) {
        t.unknown += 1;
        continue;
      }
      t.kcal += i.kcal;
      t.protein += i.protein_g ?? 0;
      t.carb += i.carb_g ?? 0;
      t.fat += i.fat_g ?? 0;
      t.fiber += i.fiber_g ?? 0;
    }
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    kcal: Math.round(t.kcal),
    protein: r(t.protein),
    carb: r(t.carb),
    fat: r(t.fat),
    fiber: r(t.fiber),
    unknown: t.unknown,
  };
}

/** Consecutive days up to `today` (or yesterday, if today is not filled yet) with a check-in. */
export function checkinStreak(checkins: Pick<Checkin, 'day'>[], today: string): number {
  const days = new Set(checkins.map((c) => c.day));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Share of days in the window where the habit was ticked (0..1), counting only days with a check-in. */
export function habitRate(checkins: Pick<Checkin, 'habits'>[], habitId: string): number {
  if (!checkins.length) return 0;
  return checkins.filter((c) => c.habits.includes(habitId)).length / checkins.length;
}

export const WATER_GLASS_ML = 250;

export interface WeightPoint {
  day: string;
  kg: number;
  source: 'self' | 'clinic';
}

/**
 * Self-reported (check-ins) and clinic (measurements) weights on one timeline. On a day with
 * both, the clinic value wins for "first"/"latest" — it is the more reliable scale.
 */
export function weightSummary(
  points: WeightPoint[],
): { first: WeightPoint; latest: WeightPoint; change: number } | null {
  if (!points.length) return null;
  const rank = (p: WeightPoint) => (p.source === 'clinic' ? 1 : 0);
  const byDay = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const firstDay = byDay[0]!.day;
  const lastDay = byDay[byDay.length - 1]!.day;
  const pick = (day: string) =>
    byDay.filter((p) => p.day === day).sort((a, b) => rank(b) - rank(a))[0]!;
  const first = pick(firstDay);
  const latest = pick(lastDay);
  return { first, latest, change: Math.round((latest.kg - first.kg) * 10) / 10 };
}

/** "Nice" axis bounds and 3–5 ticks for a value range; `integer` keeps steps whole (counts). */
export function niceTicks(min: number, max: number, target = 4, integer = false): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((m) => m * pow)
      .filter((s) => !integer || (Number.isInteger(s) && s >= 1))
      .find((s) => s >= raw) ?? Math.max(integer ? 1 : 0, 10 * pow);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** the day's water goal the check-in card shows (eight glasses) */
export const WATER_GOAL_ML = 8 * WATER_GLASS_ML;

export interface DayScorePart {
  key: 'water' | 'habits' | 'energy' | 'activity' | 'meals';
  /** 0…1 */
  value: number;
}

/**
 * How much of today's record is filled in, 0…1 — the "ring" on the Today page. It counts only
 * what the client can actually do today: habits when the dietitian set some, movement when the
 * project records it, meals when the programme plans some. Never a judgement of the diet itself.
 */
export function dayScore(input: {
  checkin: Pick<Checkin, 'water_ml' | 'habits' | 'energy' | 'activity_min'> | null;
  habitCount: number;
  activity: boolean;
  plannedMeals: number;
  loggedMeals: number;
}): { parts: DayScorePart[]; score: number } {
  const c = input.checkin;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const parts: DayScorePart[] = [
    { key: 'water', value: clamp((c?.water_ml ?? 0) / WATER_GOAL_ML) },
    { key: 'energy', value: c?.energy != null ? 1 : 0 },
  ];
  if (input.habitCount > 0)
    parts.push({ key: 'habits', value: clamp((c?.habits.length ?? 0) / input.habitCount) });
  if (input.activity) parts.push({ key: 'activity', value: (c?.activity_min ?? 0) > 0 ? 1 : 0 });
  if (input.plannedMeals > 0)
    parts.push({ key: 'meals', value: clamp(input.loggedMeals / input.plannedMeals) });
  return { parts, score: parts.reduce((a, p) => a + p.value, 0) / parts.length };
}

export interface WeekDigest {
  from: string;
  to: string;
  /** days with a check-in, of 7 */
  days: number;
  /** average over the days that have water logged, in ml; null without any */
  waterAvg: number | null;
  /** total minutes of movement */
  activityMin: number;
  activeDays: number;
  /** first and last weight of the week, when there are any */
  weightFrom: number | null;
  weightTo: number | null;
}

/** The last seven days (ending today) in numbers — what the client can send as a weekly note. */
export function weekDigest(
  checkins: Pick<Checkin, 'day' | 'water_ml' | 'weight_kg' | 'activity_min'>[],
  today: string,
): WeekDigest {
  const from = addDays(today, -6);
  const week = checkins.filter((c) => c.day >= from && c.day <= today);
  const water = week.filter((c) => c.water_ml != null && c.water_ml > 0);
  const weights = week
    .filter((c) => c.weight_kg != null)
    .sort((a, b) => a.day.localeCompare(b.day));
  const moved = week.filter((c) => (c.activity_min ?? 0) > 0);
  return {
    from,
    to: today,
    days: week.length,
    waterAvg: water.length
      ? Math.round(water.reduce((a, c) => a + c.water_ml!, 0) / water.length)
      : null,
    activityMin: moved.reduce((a, c) => a + (c.activity_min ?? 0), 0),
    activeDays: moved.length,
    weightFrom: weights[0]?.weight_kg ?? null,
    weightTo: weights.at(-1)?.weight_kg ?? null,
  };
}

/** An appointment as an .ics file (UTC times), for the client's own calendar. */
export function appointmentIcs(input: {
  startsAt: string;
  durationMin: number;
  title: string;
  description?: string;
}): string {
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + input.durationMin * 60_000);
  // RFC 5545: backslash, semicolon and comma are escaped; a line break becomes a literal "\n"
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//diyetisyen//portal//TR',
    'BEGIN:VEVENT',
    `UID:${stamp(start)}-${input.durationMin}@portal`,
    `DTSTAMP:${stamp(start)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(input.title)}`,
    ...(input.description ? [`DESCRIPTION:${esc(input.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export interface PlanAdherence {
  /** planned meals over the window, and how many of them were logged in the diary */
  planned: number;
  logged: number;
  /** per day, oldest first */
  days: { day: string; planned: number; logged: number }[];
}

/**
 * How closely the diary followed the programme over the last `span` days: for each day, the
 * programme's meals for that day (by slot) that have something logged in the diary. It says
 * whether the planned meals were eaten and recorded — not what was eaten instead.
 */
export function planAdherence(
  program: { startsOn: string | null; days: { meals: { slot: string; items: unknown[] }[] }[] },
  diary: { eaten_on: string; slot: string; items: unknown[] }[],
  today: string,
  span = 7,
): PlanAdherence {
  const days = Array.from({ length: span }, (_, k) => {
    const day = addDays(today, k - (span - 1));
    const idx = programDayIndex(program as Pick<PortalProgram, 'startsOn' | 'days'>, day);
    const slots =
      idx < 0 ? [] : program.days[idx]!.meals.filter((m) => m.items.length).map((m) => m.slot);
    const eaten = new Set(
      diary.filter((m) => m.eaten_on === day && m.items.length).map((m) => m.slot),
    );
    return { day, planned: slots.length, logged: slots.filter((s) => eaten.has(s)).length };
  });
  return {
    planned: days.reduce((a, d) => a + d.planned, 0),
    logged: days.reduce((a, d) => a + d.logged, 0),
    days,
  };
}
