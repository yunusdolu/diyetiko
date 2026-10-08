/**
 * Practice logic behind the dashboard and the client overview: weight trend, goal journey,
 * "needs attention" signals, clinical indicators, WhatsApp numbers. Pure functions — no I/O,
 * nothing leaves the server or the browser — unit-tested in signals.test.ts.
 *
 * These are prompts for the dietitian's own judgement, never diagnoses: every number shown has a
 * plain source (a formula or a dated record) and the UI says where it comes from.
 */
import {
  ACTIVITY_FACTORS,
  bmi as bmiOf,
  bmiCategory,
  calculate,
  isValidInput,
  type Activity,
  type BmiCategory,
  type Goal,
  type MacroGrams,
  type TargetRange,
} from '@/lib/nutrition/energy';
import { addDays, daysBetween } from '@/lib/portal/logic';

export interface WeightSample {
  day: string;
  kg: number;
  /** self = the client's check-in scale, clinic = a measurement taken in the practice */
  source: 'self' | 'clinic';
}

/** One value per day; on a day with both, the clinic scale wins (it is the more reliable one). */
export function dailyWeights(samples: WeightSample[]): WeightSample[] {
  const byDay = new Map<string, WeightSample>();
  for (const s of samples) {
    if (!Number.isFinite(s.kg)) continue;
    const cur = byDay.get(s.day);
    if (!cur || (cur.source === 'self' && s.source === 'clinic')) byDay.set(s.day, s);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// ---- trend ------------------------------------------------------------------------------------

export interface WeightTrend {
  /** least-squares slope, kg per week (negative = losing) */
  perWeek: number;
  from: string;
  to: string;
  samples: number;
}

/**
 * Slope of the weights in the last `windowDays` before the latest one. Needs at least 3 days of
 * data spanning a week — fewer points are noise (water, a heavy dinner), not a trend.
 */
export function weightTrend(samples: WeightSample[], windowDays = 42): WeightTrend | null {
  const all = dailyWeights(samples);
  const last = all.at(-1);
  if (!last) return null;
  const from = addDays(last.day, -windowDays);
  const pts = all.filter((s) => s.day >= from);
  if (pts.length < 3 || daysBetween(pts[0]!.day, last.day) < 7) return null;
  const xs = pts.map((p) => daysBetween(pts[0]!.day, p.day));
  const ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;
  return { perWeek: (num / den) * 7, from: pts[0]!.day, to: last.day, samples: pts.length };
}

// ---- goal journey -----------------------------------------------------------------------------

export type Direction = 'lose' | 'gain' | 'maintain';

/** Which way the goal lies from where the client started (within ±0.5 kg: keep the weight). */
export function goalDirection(start: number, goal: number): Direction {
  if (goal < start - 0.5) return 'lose';
  if (goal > start + 0.5) return 'gain';
  return 'maintain';
}

export interface GoalJourney {
  start: { day: string; kg: number };
  current: { day: string; kg: number };
  goal: number;
  direction: Direction;
  /** share of the distance covered, 0…1 (going the wrong way reads 0, overshooting reads 1) */
  progress: number;
  /** kg change since the start (signed) */
  change: number;
  /** kg still to go toward the goal (0 when reached) */
  remaining: number;
  reached: boolean;
  trend: WeightTrend | null;
  /** days to the goal at the current trend — only when the trend points at the goal and the
   *  estimate is within two years; otherwise null (no promise is better than a wild one) */
  etaDays: number | null;
}

export const MIN_TREND_KG_PER_WEEK = 0.05;
export const MAX_ETA_DAYS = 730;

export function goalJourney(samples: WeightSample[], goal: number | null): GoalJourney | null {
  const days = dailyWeights(samples);
  if (goal == null || days.length === 0) return null;
  const start = days[0]!;
  const current = days.at(-1)!;
  const direction = goalDirection(start.kg, goal);
  const change = round1(current.kg - start.kg);
  let progress: number;
  let remaining: number;
  let reached: boolean;
  if (direction === 'maintain') {
    remaining = round1(Math.abs(current.kg - goal));
    reached = remaining <= 1;
    progress = reached ? 1 : 0;
  } else {
    const total = start.kg - goal;
    progress = clamp01((start.kg - current.kg) / total);
    reached = direction === 'lose' ? current.kg <= goal : current.kg >= goal;
    remaining = reached ? 0 : round1(Math.abs(current.kg - goal));
  }
  const trend = weightTrend(samples);
  let etaDays: number | null = null;
  if (trend && !reached && direction !== 'maintain') {
    const toward =
      direction === 'lose'
        ? trend.perWeek <= -MIN_TREND_KG_PER_WEEK
        : trend.perWeek >= MIN_TREND_KG_PER_WEEK;
    if (toward) {
      const d = Math.round((remaining / Math.abs(trend.perWeek)) * 7);
      etaDays = d <= MAX_ETA_DAYS ? d : null;
    }
  }
  return {
    start: { day: start.day, kg: start.kg },
    current: { day: current.day, kg: current.kg },
    goal,
    direction,
    progress,
    change,
    remaining,
    reached,
    trend,
    etaDays,
  };
}

// ---- needs attention --------------------------------------------------------------------------

export type ReasonKind =
  'unread' | 'driftAway' | 'quiet' | 'noConsent' | 'overdueTasks' | 'measureDue' | 'noAppointment';

export interface Reason {
  kind: ReasonKind;
  /** count, days or kg — depends on the kind (null: "never") */
  value: number | null;
  /** client profile tab that resolves it */
  tab: 'messages' | 'tracking' | 'general' | 'overview' | 'measurements' | 'appointments';
}

export interface ClientFacts {
  id: string;
  full_name: string;
  /** ISO day the client record was created */
  since: string;
  goal_weight_kg: number | null;
  kvkk: boolean;
  /** has a portal account and gave portal consent */
  onPortal: boolean;
  unread: number;
  /** ISO day of the latest check-in, diary entry or message by the client */
  lastActivity: string | null;
  /** ISO day of the latest clinic measurement */
  lastMeasured: string | null;
  /** a scheduled appointment exists in the future */
  hasNextAppointment: boolean;
  /** ISO day of the latest appointment that took place */
  lastAppointment: string | null;
  overdueTasks: number;
  weights: WeightSample[];
}

/** Thresholds, in one place (documented in DESIGN.md and shown in the panel's hint). */
export const ATTENTION = {
  quietDays: 4,
  quietLongDays: 7,
  measureDays: 21,
  measureLongDays: 35,
  appointmentGapDays: 28,
  /** a new client gets a week before "no measurement / no appointment" counts */
  graceDays: 7,
  driftWindowDays: 21,
  driftKg: 1,
} as const;

const WEIGHT: Record<ReasonKind, number> = {
  unread: 4,
  driftAway: 3,
  quiet: 2,
  noConsent: 2,
  overdueTasks: 2,
  measureDue: 1,
  noAppointment: 1,
};

export interface AttentionRow {
  id: string;
  full_name: string;
  score: number;
  reasons: Reason[];
}

/** kg the latest weight has moved AWAY from the goal within the window (0 if it has not). */
export function driftAway(samples: WeightSample[], goal: number, today: string): number {
  const days = dailyWeights(samples);
  if (days.length < 2) return 0;
  const direction = goalDirection(days[0]!.kg, goal);
  if (direction === 'maintain') return 0;
  const recent = days.filter((d) => d.day >= addDays(today, -ATTENTION.driftWindowDays));
  if (recent.length < 2) return 0;
  const latest = recent.at(-1)!.kg;
  const best =
    direction === 'lose'
      ? Math.min(...recent.map((d) => d.kg))
      : Math.max(...recent.map((d) => d.kg));
  return round1(Math.abs(latest - best));
}

export function attention(facts: ClientFacts[], today: string): AttentionRow[] {
  const rows: AttentionRow[] = [];
  for (const f of facts) {
    const reasons: Reason[] = [];
    const settled = daysBetween(f.since, today) >= ATTENTION.graceDays;
    if (f.unread > 0) reasons.push({ kind: 'unread', value: f.unread, tab: 'messages' });
    if (f.goal_weight_kg != null) {
      const drift = driftAway(f.weights, f.goal_weight_kg, today);
      if (drift >= ATTENTION.driftKg)
        reasons.push({ kind: 'driftAway', value: drift, tab: 'tracking' });
    }
    if (f.onPortal && f.lastActivity) {
      const quiet = daysBetween(f.lastActivity, today);
      if (quiet >= ATTENTION.quietDays)
        reasons.push({ kind: 'quiet', value: quiet, tab: 'tracking' });
    }
    if (!f.kvkk) reasons.push({ kind: 'noConsent', value: null, tab: 'general' });
    if (f.overdueTasks > 0)
      reasons.push({ kind: 'overdueTasks', value: f.overdueTasks, tab: 'overview' });
    if (f.lastMeasured) {
      const gap = daysBetween(f.lastMeasured, today);
      if (gap >= ATTENTION.measureDays)
        reasons.push({ kind: 'measureDue', value: gap, tab: 'measurements' });
    } else if (settled) {
      reasons.push({ kind: 'measureDue', value: null, tab: 'measurements' });
    }
    if (!f.hasNextAppointment && settled) {
      const gap = f.lastAppointment ? daysBetween(f.lastAppointment, today) : null;
      if (gap == null || gap >= ATTENTION.appointmentGapDays)
        reasons.push({ kind: 'noAppointment', value: gap, tab: 'appointments' });
    }
    if (!reasons.length) continue;
    const score = reasons.reduce((s, r) => {
      let w = WEIGHT[r.kind];
      if (r.kind === 'unread') w += Math.min(r.value ?? 0, 5);
      if (r.kind === 'quiet' && (r.value ?? 0) >= ATTENTION.quietLongDays) w += 1;
      if (r.kind === 'measureDue' && (r.value ?? 0) >= ATTENTION.measureLongDays) w += 1;
      return s + w;
    }, 0);
    // strongest reason first: it decides where the row's link goes
    reasons.sort((a, b) => WEIGHT[b.kind] - WEIGHT[a.kind]);
    rows.push({ id: f.id, full_name: f.full_name, score, reasons });
  }
  return rows.sort((a, b) => b.score - a.score || a.full_name.localeCompare(b.full_name, 'tr'));
}

// ---- clinical indicators ----------------------------------------------------------------------

export interface ClinicalInput {
  sex: 'female' | 'male' | 'other' | null;
  birth_date: string | null;
  height_cm: number | null;
  activity_level: Activity | null;
  goal_weight_kg: number | null;
}

export interface Clinical {
  age: number | null;
  bmi: number | null;
  bmiCategory: BmiCategory | null;
  /** body weight for BMI 18.5 … 24.9 at this height (kg, one decimal) */
  healthyRange: [number, number] | null;
  /** waist-to-height ratio; ≥ 0.5 raised, ≥ 0.6 high (Ashwell & Hsieh) */
  whtr: number | null;
  whtrBand: 'ok' | 'raised' | 'high' | null;
  /** waist-to-hip ratio; WHO 2008: substantially increased risk ≥ 0.90 (men) / ≥ 0.85 (women) */
  whr: number | null;
  whrBand: 'ok' | 'raised' | null;
  energy: {
    bmr: number;
    tdee: number;
    goal: Goal;
    range: TargetRange;
    macros: MacroGrams;
    activity: Activity;
  } | null;
  /** what is missing to show the rest */
  missing: ('height' | 'weight' | 'sex' | 'birthDate' | 'activity' | 'waist' | 'hip')[];
}

export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export function clinical(
  c: ClinicalInput,
  latest: { weight_kg: number | null; waist_cm: number | null; hip_cm: number | null },
  today: string,
): Clinical {
  const missing: Clinical['missing'] = [];
  const h = c.height_cm;
  const w = latest.weight_kg;
  if (h == null) missing.push('height');
  if (w == null) missing.push('weight');
  const age = c.birth_date ? ageOn(c.birth_date, today) : null;

  const shownBmi = h != null && w != null ? Math.round(bmiOf(w, h) * 10) / 10 : null;
  const m2 = h != null ? (h / 100) ** 2 : null;
  const healthyRange: [number, number] | null =
    m2 != null ? [round1(18.5 * m2), round1(24.9 * m2)] : null;

  let whtr: number | null = null;
  let whtrBand: Clinical['whtrBand'] = null;
  if (latest.waist_cm != null && h != null) {
    whtr = Math.round((latest.waist_cm / h) * 100) / 100;
    whtrBand = whtr >= 0.6 ? 'high' : whtr >= 0.5 ? 'raised' : 'ok';
  } else if (latest.waist_cm == null) missing.push('waist');

  let whr: number | null = null;
  let whrBand: Clinical['whrBand'] = null;
  if (latest.waist_cm != null && latest.hip_cm != null) {
    whr = Math.round((latest.waist_cm / latest.hip_cm) * 100) / 100;
    if (c.sex === 'female' || c.sex === 'male')
      whrBand = whr >= (c.sex === 'male' ? 0.9 : 0.85) ? 'raised' : 'ok';
  } else if (latest.hip_cm == null) missing.push('hip');

  let energy: Clinical['energy'] = null;
  if (c.sex !== 'female' && c.sex !== 'male') missing.push('sex');
  if (age == null) missing.push('birthDate');
  if (!c.activity_level || !(c.activity_level in ACTIVITY_FACTORS)) missing.push('activity');
  const input = {
    sex: c.sex === 'female' || c.sex === 'male' ? c.sex : undefined,
    age: age ?? undefined,
    heightCm: h ?? undefined,
    weightKg: w ?? undefined,
    activity: c.activity_level ?? undefined,
  };
  if (isValidInput(input)) {
    const direction =
      c.goal_weight_kg != null ? goalDirection(input.weightKg, c.goal_weight_kg) : 'maintain';
    const goal: Goal = direction;
    const r = calculate(input, goal);
    energy = {
      bmr: r.bmr,
      tdee: r.tdee,
      goal,
      range: r.range,
      macros: r.macros,
      activity: input.activity,
    };
  }

  return {
    age,
    bmi: shownBmi,
    bmiCategory: shownBmi != null ? bmiCategory(shownBmi) : null,
    healthyRange,
    whtr,
    whtrBand,
    whr,
    whrBand,
    energy,
    missing,
  };
}

// ---- adherence --------------------------------------------------------------------------------

export interface DayMark {
  day: string;
  /** a check-in exists that day */
  logged: boolean;
  /** share of the client's active habits ticked that day (null: no check-in or no habits) */
  habits: number | null;
}

/** The last `n` days ending today, oldest first — for the 4-week strip. */
export function adherenceDays(
  checkins: { day: string; habits: string[] }[],
  activeHabitIds: string[],
  today: string,
  n = 28,
): DayMark[] {
  const byDay = new Map(checkins.map((c) => [c.day, c]));
  const active = new Set(activeHabitIds);
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    const c = byDay.get(day);
    const done = c ? c.habits.filter((h) => active.has(h)).length : 0;
    return {
      day,
      logged: Boolean(c),
      habits: c && active.size ? done / active.size : null,
    };
  });
}

// ---- WhatsApp ---------------------------------------------------------------------------------

/**
 * Digits for wa.me (country code, no "+"). Turkish numbers written the local way ("0555 …",
 * "555 …") get the 90 prefix; anything that cannot be a full international number is refused.
 */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('00')) d = d.slice(2);
  else if (/^0\d{10}$/.test(d))
    d = `9${d}`; // 0555 123 45 67 → 90555…
  else if (/^5\d{9}$/.test(d)) d = `90${d}`; // 555 123 45 67 → 90555…
  return d.length >= 10 && d.length <= 15 && !d.startsWith('0') ? d : null;
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

// ---- birthdays ----------------------------------------------------------------------------------

/**
 * Days until the next birthday (0 = today) and the age it brings. People born on 29 February
 * celebrate on 28 February in common years.
 */
export function nextBirthday(birthDate: string, today: string): { days: number; turns: number } {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [ty] = today.split('-').map(Number) as [number];
  const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const on = (y: number) => {
    const day = bm === 2 && bd === 29 && !leap(y) ? 28 : bd;
    return `${y}-${String(bm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  let year = ty;
  if (on(year) < today) year += 1;
  return { days: daysBetween(today, on(year)), turns: year - by };
}
