import { addDays, todayISO } from '@/lib/portal/logic';

/**
 * The date filter of the panel's lists: one set of ranges everywhere, counted in the practice's
 * calendar (Istanbul) — "today" is the calendar day, a month is the same day one month back.
 */
export const DATE_RANGES = ['all', '1d', '7d', '1m', '3m', '1y'] as const;
export type DateRange = (typeof DATE_RANGES)[number];

/** `iso` moved back by whole months, clamped to the month's last day (31 Mar − 1 month = 28/29 Feb). */
export function monthsBack(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

/** First day (inclusive) a range covers; `null` for all time. */
export function rangeStart(range: DateRange, today: string): string | null {
  switch (range) {
    case 'all':
      return null;
    case '1d':
      return today;
    case '7d':
      return addDays(today, -6);
    case '1m':
      return monthsBack(today, 1);
    case '3m':
      return monthsBack(today, 3);
    case '1y':
      return monthsBack(today, 12);
  }
}

/** The practice's calendar day of a value: a plain day stays as it is, a timestamp is converted. */
export function dayOf(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayISO(new Date(value));
}

/** Is `value` (a day or a timestamp) inside the range that ends today? Later days never match. */
export function inRange(
  value: string | Date | null | undefined,
  range: DateRange,
  today: string,
): boolean {
  if (range === 'all') return true;
  if (!value) return false;
  const day = dayOf(value);
  return day >= rangeStart(range, today)! && day <= today;
}
