import { describe, expect, it } from 'vitest';
import {
  addDays,
  checkinStreak,
  clampDay,
  diaryTotals,
  habitRate,
  niceTicks,
  programDayIndex,
  todayISO,
  weightSummary,
} from './logic';

describe('dates', () => {
  it('today follows Istanbul time, not UTC', () => {
    // 22:30 UTC on 30 Sep is already 1 Oct in Istanbul (UTC+3)
    expect(todayISO(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01');
    expect(todayISO(new Date('2026-09-30T20:30:00Z'))).toBe('2026-09-30');
  });
  it('adds days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('clamps day parameters to the past year', () => {
    expect(clampDay('2026-09-29', '2026-09-30')).toBe('2026-09-29');
    expect(clampDay('2026-10-05', '2026-09-30')).toBe('2026-09-30'); // future
    expect(clampDay('2024-01-01', '2026-09-30')).toBe('2026-09-30'); // too old
    expect(clampDay('garbage', '2026-09-30')).toBe('2026-09-30');
    expect(clampDay(undefined, '2026-09-30')).toBe('2026-09-30');
  });
});

describe('program day', () => {
  const days = Array.from({ length: 7 }, (_, i) => ({ position: i, label: null, meals: [] }));
  it('counts from the start date and wraps', () => {
    expect(programDayIndex({ startsOn: '2026-09-28', days }, '2026-09-28')).toBe(0);
    expect(programDayIndex({ startsOn: '2026-09-28', days }, '2026-10-06')).toBe(1);
    expect(programDayIndex({ startsOn: '2026-10-01', days }, '2026-09-30')).toBe(6); // before start
  });
  it('uses the weekday without a start date (Monday = day 1)', () => {
    expect(programDayIndex({ startsOn: null, days }, '2026-09-28')).toBe(0); // Monday
    expect(programDayIndex({ startsOn: null, days }, '2026-10-04')).toBe(6); // Sunday
    expect(programDayIndex({ startsOn: null, days: days.slice(0, 3) }, '2026-10-01')).toBe(0); // Thursday = 3 → 3 % 3
  });
  it('is -1 for an empty program', () => {
    expect(programDayIndex({ startsOn: null, days: [] }, '2026-10-01')).toBe(-1);
  });
});

describe('totals', () => {
  it('sums known values and counts free-text items separately', () => {
    const item = (kcal: number | null, p = 0) => ({
      id: 'x',
      name: 'x',
      food_id: null,
      recipe_id: null,
      grams: null,
      unit_key: null,
      unit_qty: null,
      servings: null,
      kcal,
      protein_g: kcal == null ? null : p,
      carb_g: kcal == null ? null : 1,
      fat_g: kcal == null ? null : 1,
      fiber_g: kcal == null ? null : 0.5,
    });
    const t = diaryTotals([
      { items: [item(143.4, 12.6), item(null)] },
      { items: [item(200.2, 3)] },
    ]);
    expect(t).toEqual({ kcal: 344, protein: 15.6, carb: 2, fat: 2, fiber: 1, unknown: 1 });
  });
});

describe('habits', () => {
  it('streak counts back from today or yesterday', () => {
    const c = ['2026-09-27', '2026-09-28', '2026-09-29'].map((day) => ({ day }));
    expect(checkinStreak(c, '2026-09-30')).toBe(3); // today not filled yet
    expect(checkinStreak([...c, { day: '2026-09-30' }], '2026-09-30')).toBe(4);
    expect(checkinStreak(c, '2026-10-02')).toBe(0);
  });
  it('rate over days with a check-in', () => {
    expect(
      habitRate(
        [{ habits: ['a'] }, { habits: [] }, { habits: ['a', 'b'] }, { habits: ['b'] }],
        'a',
      ),
    ).toBe(0.5);
    expect(habitRate([], 'a')).toBe(0);
  });
});

describe('weightSummary', () => {
  it('returns null without data', () => {
    expect(weightSummary([])).toBeNull();
  });
  it('prefers the clinic value on a shared day and computes the change', () => {
    const s = weightSummary([
      { day: '2026-09-10', kg: 80.4, source: 'self' },
      { day: '2026-09-01', kg: 82, source: 'self' },
      { day: '2026-09-01', kg: 81.6, source: 'clinic' },
      { day: '2026-09-10', kg: 80.1, source: 'clinic' },
    ])!;
    expect(s.first).toEqual({ day: '2026-09-01', kg: 81.6, source: 'clinic' });
    expect(s.latest).toEqual({ day: '2026-09-10', kg: 80.1, source: 'clinic' });
    expect(s.change).toBe(-1.5);
  });
});

describe('niceTicks', () => {
  it('covers the range with round steps', () => {
    const t = niceTicks(71.3, 76.8);
    expect(t[0]).toBeLessThanOrEqual(71.3);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(76.8);
    expect(t.length).toBeGreaterThanOrEqual(3);
    expect(t.length).toBeLessThanOrEqual(6);
    const steps = t.slice(1).map((v, i) => Math.round((v - t[i]!) * 100) / 100);
    expect(new Set(steps).size).toBe(1);
  });
  it('handles a single value', () => {
    expect(niceTicks(70, 70).length).toBeGreaterThanOrEqual(2);
  });
});

describe('niceTicks (integer)', () => {
  it('keeps whole steps for counts', () => {
    const t = niceTicks(0, 8.05, 4, true);
    expect(t.every((v) => Number.isInteger(v))).toBe(true);
    expect(t[0]).toBe(0);
    expect(t.at(-1)).toBeGreaterThanOrEqual(8.05);
  });
  it('never uses a fractional step on tiny ranges', () => {
    const t = niceTicks(0, 1.2, 4, true);
    expect(t.every((v) => Number.isInteger(v))).toBe(true);
  });
});
