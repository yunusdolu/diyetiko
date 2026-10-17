/**
 * Plans: the 3, 6 and 12-month terms a client signs up for (pure, unit-tested in plans.test.ts).
 *
 * A plan is a package with a first and a last day (client_packages: starts_on / ends_on). Whether
 * it is a 3, 6 or 12-month plan is read from those two days, so a package that runs for a term
 * is that plan in every language without a column of its own. Days are calendar days
 * ('YYYY-MM-DD', Istanbul), the last day included.
 */

export const PLAN_TERMS = [3, 6, 12] as const;
export type PlanTerm = (typeof PLAN_TERMS)[number];
export const isPlanTerm = (n: unknown): n is PlanTerm => PLAN_TERMS.includes(n as PlanTerm);

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parts = (day: string) => day.split('-').map(Number) as [number, number, number];
const utc = (day: string) => Date.parse(`${day}T12:00:00Z`);
const daysFrom = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 864e5);

/** The same day `months` later (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = parts(day);
  const total = m - 1 + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(ty, tm, Math.min(d, last), 12)));
}

/** The last day of a plan of `months` that starts on `start`: 17 Oct + 3 months → 16 Jan. */
export function planEndsOn(start: string, months: number): string {
  const next = new Date(`${addMonths(start, months)}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() - 1);
  return iso(next);
}

/** 3, 6 or 12 when the two days are exactly such a term; otherwise null. */
export function planTerm(startsOn: string, endsOn: string): PlanTerm | null {
  return PLAN_TERMS.find((m) => planEndsOn(startsOn, m) === endsOn) ?? null;
}

/** Whole calendar months from `a` to `b` (17 Oct → 16 Nov is 0, → 17 Nov is 1). */
function monthsBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  let n = (by - ay) * 12 + (bm - am);
  // the anniversary day this month (clamped to the month's length) not reached yet
  const last = new Date(Date.UTC(by, bm, 0)).getUTCDate();
  if (bd < Math.min(ad, last)) n--;
  return n;
}

export interface PlanProgress {
  state: 'upcoming' | 'running' | 'ended';
  term: PlanTerm | null;
  /** days in the plan, first and last included */
  totalDays: number;
  /** the day of the plan today, 1 … totalDays (0 before it starts, totalDays after it ends) */
  day: number;
  /** days still to come after today */
  daysLeft: number;
  /** before the start: days until the first day */
  startsIn: number;
  /** day / totalDays */
  share: number;
  weeks: number;
  /** this week of the plan, 1 … weeks (0 before the start) */
  week: number;
  months: number;
  /** this month of the plan, 1 … months (0 before the start) */
  month: number;
}

/** Where a client is in a plan, by day, week and month. */
export function planProgress(startsOn: string, endsOn: string, today: string): PlanProgress {
  const term = planTerm(startsOn, endsOn);
  const totalDays = Math.max(1, daysFrom(startsOn, endsOn) + 1);
  const weeks = Math.ceil(totalDays / 7);
  const months = term ?? Math.max(1, monthsBetween(startsOn, addDays(endsOn, 1)));
  const state = today < startsOn ? 'upcoming' : today > endsOn ? 'ended' : 'running';
  const day =
    state === 'upcoming' ? 0 : state === 'ended' ? totalDays : daysFrom(startsOn, today) + 1;
  return {
    state,
    term,
    totalDays,
    day,
    daysLeft: totalDays - day,
    startsIn: state === 'upcoming' ? daysFrom(today, startsOn) : 0,
    share: day / totalDays,
    weeks,
    week: day === 0 ? 0 : Math.min(weeks, Math.ceil(day / 7)),
    months,
    month:
      state === 'upcoming'
        ? 0
        : state === 'ended'
          ? months
          : Math.min(months, monthsBetween(startsOn, today) + 1),
  };
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export interface PlanCandidate {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string | null;
  closed: boolean;
}

/** An ended plan stays in view this long, so a renewal can be talked about. */
export const ENDED_PLAN_DAYS = 45;

/**
 * The plan to show for a client: the one running today (the latest started, if two overlap),
 * else the next one to start, else one that ended in the last few weeks. Packages without a last
 * day (counted in sessions only) and packages closed by hand are not plans.
 */
export function currentPlan<T extends PlanCandidate>(
  packages: T[],
  today: string,
): (T & { endsOn: string; progress: PlanProgress }) | null {
  const timed = packages.filter(
    (p): p is T & { endsOn: string } => !p.closed && p.endsOn != null && p.endsOn >= p.startsOn,
  );
  const running = timed
    .filter((p) => p.startsOn <= today && p.endsOn >= today)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
  const upcoming = timed
    .filter((p) => p.startsOn > today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
  const ended = timed
    .filter((p) => p.endsOn < today && daysFrom(p.endsOn, today) <= ENDED_PLAN_DAYS)
    .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0];
  const pick = running ?? upcoming ?? ended;
  return pick ? { ...pick, progress: planProgress(pick.startsOn, pick.endsOn, today) } : null;
}

/** The same, from the dietitian panel's package rows (snake_case, `closed_at`). */
export function planOfPackages(
  packages: {
    id: string;
    name: string;
    starts_on: string;
    ends_on: string | null;
    closed_at: string | null;
  }[],
  today: string,
) {
  return currentPlan(
    packages.map((p) => ({
      id: p.id,
      name: p.name,
      startsOn: p.starts_on,
      endsOn: p.ends_on,
      closed: p.closed_at != null,
    })),
    today,
  );
}
