import { describe, expect, it } from 'vitest';
import { goalJourney, longestStreak, milestones, weeklyPace } from './insights';

const today = '2026-10-06';

describe('weeklyPace', () => {
  it('reads a steady loss as kg per week', () => {
    const points = [0, 7, 14, 21].map((d, i) => ({
      day: new Date(Date.parse('2026-09-15T12:00:00Z') + d * 864e5).toISOString().slice(0, 10),
      kg: 80 - i * 0.5,
    }));
    expect(weeklyPace(points, today)).toBe(-0.5);
  });
  it('needs three entries', () => {
    expect(weeklyPace([{ day: '2026-10-01', kg: 80 }], today)).toBeNull();
  });
});

describe('goalJourney', () => {
  const points = [
    { day: '2026-09-15', kg: 80 },
    { day: '2026-09-22', kg: 79.5 },
    { day: '2026-09-29', kg: 79 },
    { day: '2026-10-06', kg: 78.5 },
  ];
  it('measures the share and gives a date at the recent pace', () => {
    const j = goalJourney(points, 75, today)!;
    expect(j.start).toBe(80);
    expect(j.now).toBe(78.5);
    expect(j.share).toBeCloseTo(0.3, 5);
    expect(j.pace).toBe(-0.5);
    // 3.5 kg left at 0.5 kg a week = 49 days
    expect(j.eta).toBe('2026-11-24');
  });
  it('gives no date when the weight moves away from the goal', () => {
    const j = goalJourney(points, 85, today)!;
    expect(j.eta).toBeNull();
    expect(j.share).toBe(0);
  });
  it('is null without a goal or entries', () => {
    expect(goalJourney(points, null, today)).toBeNull();
    expect(goalJourney([], 70, today)).toBeNull();
  });
});

describe('milestones', () => {
  it('counts the longest run of days', () => {
    expect(
      longestStreak(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06']),
    ).toBe(3);
  });
  it('marks what is earned and how far the rest is', () => {
    const checkins = ['2026-10-04', '2026-10-05', '2026-10-06'].map((day, i) => ({
      day,
      water_ml: i === 0 ? 2000 : 500,
      activity_min: 30,
    }));
    const m = Object.fromEntries(
      milestones({ checkins, journey: null, today }).map((b) => [b.key, b]),
    );
    expect(m.first!.earned).toBe(true);
    expect(m.streak7!.earned).toBe(false);
    expect(m.streak7!.progress).toBeCloseTo(3 / 7, 5);
    expect(m.water7!.progress).toBeCloseTo(1 / 7, 5);
    expect(m.move150!.progress).toBeCloseTo(0.6, 5);
    expect(m.goal!.progress).toBe(0);
  });
});
