import { goalJourney as sharedJourney } from '@/lib/admin/signals';
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

/**
 * From the first weight to the goal: how far along, the recent pace, and the day that pace
 * arrives. The very same reading as the dietitian's panel (`goalJourney` in lib/admin/signals:
 * one weight per day with the clinic scale first, the trend over the six weeks before the latest
 * weigh-in, no date beyond two years or when the weight moves away) — so the client and the
 * dietitian never see two different forecasts.
 */
export function goalJourney(
  points: (WeightEntry & { source?: 'self' | 'clinic' })[],
  goal: number | null,
  today: string,
): GoalJourney | null {
  const j = sharedJourney(
    points.map((p) => ({ day: p.day, kg: p.kg, source: p.source ?? 'self' })),
    goal,
  );
  if (!j) return null;
  return {
    start: j.start.kg,
    now: j.current.kg,
    goal: j.goal,
    share: j.progress,
    pace: j.trend ? Math.round(j.trend.perWeek * 100) / 100 : null,
    eta: j.etaDays != null ? addDays(today, j.etaDays) : null,
  };
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
