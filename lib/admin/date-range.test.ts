import { describe, expect, it } from 'vitest';
import { dayOf, inRange, monthsBack, rangeStart } from './date-range';

describe('date range', () => {
  const today = '2026-10-04';

  it('starts each range on the right day', () => {
    expect(rangeStart('all', today)).toBeNull();
    expect(rangeStart('1d', today)).toBe('2026-10-04');
    expect(rangeStart('7d', today)).toBe('2026-09-28');
    expect(rangeStart('1m', today)).toBe('2026-09-04');
    expect(rangeStart('3m', today)).toBe('2026-07-04');
    expect(rangeStart('1y', today)).toBe('2025-10-04');
  });

  it('clamps to the end of a shorter month', () => {
    expect(monthsBack('2026-03-31', 1)).toBe('2026-02-28');
    expect(monthsBack('2024-03-31', 1)).toBe('2024-02-29');
    expect(monthsBack('2026-01-15', 3)).toBe('2025-10-15');
  });

  it('reads a timestamp as the Istanbul calendar day', () => {
    // 22:30 UTC is already the next day in Istanbul (UTC+3)
    expect(dayOf('2026-10-03T22:30:00Z')).toBe('2026-10-04');
    expect(dayOf('2026-10-03T20:59:00Z')).toBe('2026-10-03');
    expect(dayOf('2026-10-03')).toBe('2026-10-03');
  });

  it('keeps what is inside the range and nothing else', () => {
    expect(inRange('2020-01-01', 'all', today)).toBe(true);
    expect(inRange(null, 'all', today)).toBe(true);
    expect(inRange(null, '1m', today)).toBe(false);
    expect(inRange('2026-10-04', '1d', today)).toBe(true);
    expect(inRange('2026-10-03', '1d', today)).toBe(false);
    expect(inRange('2026-09-28', '7d', today)).toBe(true);
    expect(inRange('2026-09-27', '7d', today)).toBe(false);
    expect(inRange('2026-09-04', '1m', today)).toBe(true);
    expect(inRange('2026-09-03', '1m', today)).toBe(false);
    expect(inRange('2026-10-03T22:30:00Z', '1d', today)).toBe(true);
    // a day after today (a payment dated ahead) is not "the last month"
    expect(inRange('2026-10-09', '1m', today)).toBe(false);
  });
});
