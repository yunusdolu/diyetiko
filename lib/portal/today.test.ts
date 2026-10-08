import { describe, expect, it } from 'vitest';
import { appointmentIcs, dayScore, planAdherence, weekDigest } from './logic';

describe('dayScore', () => {
  const base = { habitCount: 0, activity: false, plannedMeals: 0, loggedMeals: 0 };

  it('is empty before anything is recorded', () => {
    const s = dayScore({ ...base, checkin: null });
    expect(s.score).toBe(0);
    expect(s.parts.map((p) => p.key)).toEqual(['water', 'energy']);
  });

  it('counts only what can be done today', () => {
    const checkin = { water_ml: 1000, habits: ['a'], energy: 4, activity_min: 30 };
    // no habits set, no movement field, no planned meals: water (half) + energy (done)
    expect(dayScore({ ...base, checkin }).score).toBeCloseTo(0.75);
    // with two habits (one ticked), movement, and 4 planned meals of which 1 is logged
    const full = dayScore({
      checkin,
      habitCount: 2,
      activity: true,
      plannedMeals: 4,
      loggedMeals: 1,
    });
    expect(full.parts.map((p) => p.key)).toEqual([
      'water',
      'energy',
      'habits',
      'activity',
      'meals',
    ]);
    expect(full.score).toBeCloseTo((0.5 + 1 + 0.5 + 1 + 0.25) / 5);
  });

  it('never goes past full', () => {
    const s = dayScore({
      checkin: { water_ml: 9000, habits: ['a', 'b', 'c'], energy: 5, activity_min: 90 },
      habitCount: 2,
      activity: true,
      plannedMeals: 3,
      loggedMeals: 5,
    });
    expect(s.score).toBe(1);
  });
});

describe('weekDigest', () => {
  const today = '2026-10-06';
  const c = (
    day: string,
    over: Partial<{ water_ml: number; weight_kg: number; activity_min: number }>,
  ) => ({
    day,
    water_ml: null,
    weight_kg: null,
    activity_min: null,
    ...over,
  });

  it('sums the last seven days and nothing older', () => {
    const d = weekDigest(
      [
        c('2026-09-29', { water_ml: 3000, activity_min: 60, weight_kg: 80 }), // 8 days ago: out
        c('2026-09-30', { water_ml: 2000, weight_kg: 71 }),
        c('2026-10-02', { water_ml: 1000, activity_min: 30 }),
        c('2026-10-06', { activity_min: 45, weight_kg: 70.4 }),
      ],
      today,
    );
    expect(d.from).toBe('2026-09-30');
    expect(d.days).toBe(3);
    expect(d.waterAvg).toBe(1500);
    expect(d.activityMin).toBe(75);
    expect(d.activeDays).toBe(2);
    expect([d.weightFrom, d.weightTo]).toEqual([71, 70.4]);
  });

  it('has no averages without data', () => {
    const d = weekDigest([], today);
    expect(d).toMatchObject({ days: 0, waterAvg: null, activityMin: 0, weightFrom: null });
  });
});

describe('appointmentIcs', () => {
  it('writes UTC start and end and escapes text', () => {
    const ics = appointmentIcs({
      startsAt: '2026-10-06T07:00:00.000Z',
      durationMin: 45,
      title: 'Görüşme; online, 45 dk',
    });
    expect(ics).toContain('DTSTART:20261006T070000Z');
    expect(ics).toContain('DTEND:20261006T074500Z');
    expect(ics).toContain('SUMMARY:Görüşme\\; online\\, 45 dk');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
  });
});

describe('planAdherence', () => {
  const meal = (slot: string, n = 1) => ({ slot, items: Array.from({ length: n }, () => ({})) });
  // a two-day programme starting on 5 Oct: day A has three meals, day B two (one of them empty)
  const program = {
    startsOn: '2026-10-05',
    days: [
      { meals: [meal('breakfast'), meal('lunch'), meal('dinner')] },
      { meals: [meal('breakfast'), meal('lunch', 0), meal('dinner')] },
    ],
  };

  it('counts planned meals that were logged, day by day', () => {
    const a = planAdherence(
      program,
      [
        { eaten_on: '2026-10-05', slot: 'breakfast', items: [{}] },
        { eaten_on: '2026-10-05', slot: 'snack', items: [{}] }, // not planned: not counted
        { eaten_on: '2026-10-06', slot: 'dinner', items: [{}] },
        { eaten_on: '2026-10-06', slot: 'breakfast', items: [] }, // opened, nothing in it
      ],
      '2026-10-06',
      2,
    );
    expect(a.days).toEqual([
      { day: '2026-10-05', planned: 3, logged: 1 },
      { day: '2026-10-06', planned: 2, logged: 1 },
    ]);
    expect([a.planned, a.logged]).toEqual([5, 2]);
  });

  it('is empty without a programme day', () => {
    const a = planAdherence({ startsOn: null, days: [] }, [], '2026-10-06');
    expect([a.planned, a.logged, a.days.length]).toEqual([0, 0, 7]);
  });
});
