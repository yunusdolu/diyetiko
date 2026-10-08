import { addDays, WATER_GOAL_ML } from './logic';

/*
 * What the client's own entries add up to (DESIGN.md v1.38): the way to the goal weight and a
 * handful of milestones. Everything here is read from recorded values — nothing is estimated
 * beyond a straight line through the recent weights, and that is labelled as a direction.
 */

export interface WeightEntry {
  day: string;
  kg: number;
}

export interface GoalJourney {
  start: number;
  now: number;
  goal: number;
  share: number;
  pace: number | null;
  eta: string | null;
}

const dayNumber = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 864e5;

/** Least-squares slope of weight over time, in kg per week; null with fewer than 3 entries. */
export function weeklyPace(points: WeightEntry[], today: string, windowDays = 42): number | null {
  const from = addDays(today, -windowDays);
  const xs = points.filter((p) => p.day >= from && p.day <= today);
  if (xs.length < 3) return null;
  const t0 = dayNumber(xs[0]!.day);
  const n = xs.length;
  const mx = xs.reduce((a, p) => a + (dayNumber(p.day) - t0), 0) / n;
  const my = xs.reduce((a, p) => a + p.kg, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of xs) {
    const dx = dayNumber(p.day) - t0 - mx;
    num += dx * (p.kg - my);
    den += dx * dx;
  }
  if (!den) return null;
  return Math.round((num / den) * 7 * 100) / 100;
}

/**
 * From the first weight to the goal: how far along, the recent pace, and the day that pace
 * arrives — only when the weight is moving toward the goal and would get there within two years.
 */
export function goalJourney(
  points: WeightEntry[],
  goal: number | null,
  today: string,
): GoalJourney | null {
  if (goal == null || !points.length) return null;
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const start = sorted[0]!.kg;
  const now = sorted[sorted.length - 1]!.kg;
  const span = start - goal;
  const share = span === 0 ? 1 : Math.max(0, Math.min(1, (start - now) / span));
  const pace = weeklyPace(sorted, today);
  let eta: string | null = null;
  const left = goal - now;
  if (pace != null && Math.abs(pace) >= 0.05 && left !== 0 && Math.sign(pace) === Math.sign(left)) {
    const days = Math.ceil((left / pace) * 7);
    if (days > 0 && days <= 730) eta = addDays(today, days);
  }
  return { start, now, goal, share, pace, eta };
}

export interface BadgeState {
  key: 'first' | 'streak7' | 'streak30' | 'water7' | 'move150' | 'kilo1' | 'half' | 'goal';
  earned: boolean;
  progress: number;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** The longest run of consecutive recorded days. */
export function longestStreak(days: string[]): number {
  const set = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of set) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Milestones, each with how far along it is. */
export function milestones(input: {
  checkins: { day: string; water_ml: number | null; activity_min: number | null }[];
  journey: GoalJourney | null;
  today: string;
}): BadgeState[] {
  const { checkins, journey, today } = input;
  const streak = longestStreak(checkins.map((c) => c.day));
  const waterDays = checkins.filter((c) => (c.water_ml ?? 0) >= WATER_GOAL_ML).length;
  const weekFrom = addDays(today, -6);
  const moved = checkins
    .filter((c) => c.day >= weekFrom && c.day <= today)
    .reduce((a, c) => a + (c.activity_min ?? 0), 0);
  const toward = journey ? Math.abs(journey.start - journey.now) : 0;
  const right = journey
    ? Math.sign(journey.start - journey.now) === Math.sign(journey.start - journey.goal)
    : false;
  const mk = (key: BadgeState['key'], v: number): BadgeState => ({
    key,
    earned: v >= 1,
    progress: clamp(v),
  });
  return [
    mk('first', checkins.length ? 1 : 0),
    mk('streak7', streak / 7),
    mk('streak30', streak / 30),
    mk('water7', waterDays / 7),
    mk('move150', moved / 150),
    mk('kilo1', right ? toward / 1 : 0),
    mk('half', journey ? journey.share / 0.5 : 0),
    mk('goal', journey ? journey.share : 0),
  ];
}
