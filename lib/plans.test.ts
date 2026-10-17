import { describe, expect, it } from 'vitest';
import { addMonths, currentPlan, planEndsOn, planProgress, planTerm } from './plans';

describe('plan terms', () => {
  it('ends the day before the same date N months later', () => {
    expect(planEndsOn('2026-10-17', 3)).toBe('2027-01-16');
    expect(planEndsOn('2026-10-17', 6)).toBe('2027-04-16');
    expect(planEndsOn('2026-10-17', 12)).toBe('2027-10-16');
    // month ends: 31 Jan + 1 month is the end of February
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(planEndsOn('2026-11-30', 3)).toBe('2027-02-27');
  });
  it('reads the term back from the two days', () => {
    expect(planTerm('2026-10-17', '2027-01-16')).toBe(3);
    expect(planTerm('2026-10-17', '2027-04-16')).toBe(6);
    expect(planTerm('2026-10-17', '2027-10-16')).toBe(12);
    expect(planTerm('2026-09-11', '2026-10-11')).toBeNull();
  });
});

describe('plan progress', () => {
  const start = '2026-10-17';
  const end = planEndsOn(start, 3); // 2027-01-16: 92 days

  it('counts the first day as day 1, by day, week and month', () => {
    const p = planProgress(start, end, start);
    expect(p).toMatchObject({
      state: 'running',
      term: 3,
      totalDays: 92,
      day: 1,
      week: 1,
      month: 1,
    });
    expect(p.daysLeft).toBe(91);
    expect(p.weeks).toBe(14);
    expect(p.months).toBe(3);
  });
  it('moves into week 2 on day 8 and month 2 on the monthly anniversary', () => {
    expect(planProgress(start, end, '2026-10-24')).toMatchObject({ day: 8, week: 2, month: 1 });
    expect(planProgress(start, end, '2026-11-16').month).toBe(1);
    expect(planProgress(start, end, '2026-11-17').month).toBe(2);
    expect(planProgress(start, end, '2027-01-16')).toMatchObject({
      day: 92,
      daysLeft: 0,
      share: 1,
      month: 3,
    });
  });
  it('before the start and after the end', () => {
    expect(planProgress(start, end, '2026-10-10')).toMatchObject({
      state: 'upcoming',
      day: 0,
      startsIn: 7,
      share: 0,
      week: 0,
      month: 0,
    });
    expect(planProgress(start, end, '2027-02-01')).toMatchObject({
      state: 'ended',
      share: 1,
      daysLeft: 0,
      month: 3,
    });
  });
  it('a period that is not a term still has its months', () => {
    const p = planProgress('2026-09-11', '2026-10-11', '2026-10-01');
    expect(p.term).toBeNull();
    expect(p.months).toBe(1);
    expect(p.totalDays).toBe(31);
  });
});

describe('the plan to show', () => {
  const pkg = (id: string, startsOn: string, endsOn: string | null, closed = false) => ({
    id,
    name: id,
    startsOn,
    endsOn,
    closed,
  });
  const today = '2026-10-17';
  it('prefers the one running, then the next, then one that just ended', () => {
    const list = [
      pkg('old', '2026-01-01', '2026-03-31'),
      pkg('sessions', '2026-10-01', null),
      pkg('running', '2026-10-01', '2027-03-31'),
      pkg('next', '2027-04-01', '2027-09-30'),
    ];
    expect(currentPlan(list, today)?.id).toBe('running');
    expect(
      currentPlan(
        list.filter((p) => p.id !== 'running'),
        today,
      )?.id,
    ).toBe('next');
    expect(currentPlan([pkg('ended', '2026-07-01', '2026-10-10')], today)?.id).toBe('ended');
    expect(currentPlan([pkg('long-gone', '2026-01-01', '2026-03-31')], today)).toBeNull();
  });
  it('skips packages closed by hand and those without a last day', () => {
    expect(currentPlan([pkg('closed', '2026-10-01', '2027-03-31', true)], today)).toBeNull();
    expect(currentPlan([pkg('sessions', '2026-10-01', null)], today)).toBeNull();
  });
});
