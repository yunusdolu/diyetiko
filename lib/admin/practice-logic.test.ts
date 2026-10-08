import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  homaIr,
  labFlag,
  labSeries,
  packageMoney,
  parseDecimal,
  packageState,
  sessionsUsed,
  sumByCurrency,
  type LabSample,
  type PackageBase,
} from './practice-logic';

const pkg = (over: Partial<PackageBase> & { id: string }): PackageBase => ({
  sessions_total: 8,
  starts_on: '2026-09-01',
  ends_on: null,
  price: 1000,
  currency: 'TRY',
  closed_at: null,
  ...over,
});

describe('sessionsUsed', () => {
  it('counts attended days into the package they fall in, once each', () => {
    const a = pkg({ id: 'a', starts_on: '2026-08-01' });
    const b = pkg({ id: 'b', starts_on: '2026-09-15' });
    const used = sessionsUsed(
      [b, a],
      ['2026-07-20', '2026-08-05', '2026-09-01', '2026-09-15', '2026-09-22'],
    );
    expect(used.get('a')).toBe(2); // 07-20 is before any package
    expect(used.get('b')).toBe(2);
  });

  it('does not count days after a package ended (and before the next one)', () => {
    const a = pkg({ id: 'a', starts_on: '2026-08-01', ends_on: '2026-08-31' });
    expect(sessionsUsed([a], ['2026-08-31', '2026-09-02']).get('a')).toBe(1);
  });

  it('gives every package a count, zero included', () => {
    expect(sessionsUsed([pkg({ id: 'a' })], []).get('a')).toBe(0);
  });
});

describe('packageMoney', () => {
  it('sums the payments made against the package in its own currency', () => {
    const p = pkg({ id: 'a', price: 1000 });
    const m = packageMoney(p, [
      { package_id: 'a', amount: 400, currency: 'TRY' },
      { package_id: 'a', amount: 100.5, currency: 'TRY' },
      { package_id: 'a', amount: 50, currency: 'EUR' }, // other currency: not mixed in
      { package_id: null, amount: 999, currency: 'TRY' },
    ]);
    expect(m).toEqual({ paid: 500.5, due: 499.5 });
  });

  it('never owes a negative amount; no price → nothing due', () => {
    expect(
      packageMoney(pkg({ id: 'a', price: 100 }), [
        { package_id: 'a', amount: 150, currency: 'TRY' },
      ]).due,
    ).toBe(0);
    expect(packageMoney(pkg({ id: 'a', price: null }), []).due).toBeNull();
  });
});

describe('packageState', () => {
  const today = '2026-10-02';
  it('reads closed, upcoming, used up and expired as expected', () => {
    expect(packageState(pkg({ id: 'a', closed_at: '2026-09-30T10:00:00Z' }), 0, today)).toBe(
      'done',
    );
    expect(packageState(pkg({ id: 'a', starts_on: '2026-10-10' }), 0, today)).toBe('upcoming');
    expect(packageState(pkg({ id: 'a', sessions_total: 4 }), 4, today)).toBe('done');
    expect(packageState(pkg({ id: 'a', ends_on: '2026-10-01' }), 0, today)).toBe('done');
  });
  it('flags the last session and the last week', () => {
    expect(packageState(pkg({ id: 'a', sessions_total: 4 }), 3, today)).toBe('ending');
    expect(
      packageState(pkg({ id: 'a', sessions_total: null, ends_on: '2026-10-09' }), 0, today),
    ).toBe('ending');
    expect(
      packageState(pkg({ id: 'a', sessions_total: null, ends_on: '2026-10-10' }), 0, today),
    ).toBe('active');
    expect(packageState(pkg({ id: 'a', sessions_total: 8 }), 2, today)).toBe('active');
  });
});

it('daysBetween counts calendar days', () => {
  expect(daysBetween('2026-10-02', '2026-10-09')).toBe(7);
  expect(daysBetween('2026-10-02', '2026-09-30')).toBe(-2);
  expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
});

it('sumByCurrency keeps currencies apart, in a fixed order', () => {
  expect(
    sumByCurrency([
      { amount: 10, currency: 'EUR' },
      { amount: 100.1, currency: 'TRY' },
      { amount: 0.2, currency: 'TRY' },
    ]),
  ).toEqual([
    { currency: 'TRY', amount: 100.3 },
    { currency: 'EUR', amount: 10 },
  ]);
});

describe('labs', () => {
  const s = (test: string, taken_on: string, value: number, extra: Partial<LabSample> = {}) => ({
    test,
    taken_on,
    value,
    unit: 'mg/dL',
    ref_low: null,
    ref_high: null,
    ...extra,
  });

  it('flags against the range on the report only', () => {
    expect(labFlag(5, null, null)).toBeNull();
    expect(labFlag(5, 6, null)).toBe('low');
    expect(labFlag(12, null, 10)).toBe('high');
    expect(labFlag(10, 6, 10)).toBe('ok'); // bounds are inside the range
  });

  it('groups by test: app tests in list order, own tests after; newest is "latest"', () => {
    const series = labSeries([
      s('Homosistein', '2026-09-01', 9),
      s('ldl', '2026-06-01', 150, { ref_high: 130 }),
      s('glucose_fasting', '2026-09-01', 98),
      s('ldl', '2026-09-01', 120, { ref_high: 130 }),
    ]);
    expect(series.map((x) => x.test)).toEqual(['glucose_fasting', 'ldl', 'Homosistein']);
    const ldl = series[1]!;
    expect(ldl.latest.value).toBe(120);
    expect(ldl.previous?.value).toBe(150);
    expect(ldl.flag).toBe('ok');
  });

  it('HOMA-IR uses the latest day with both fasting glucose and insulin', () => {
    expect(homaIr([s('glucose_fasting', '2026-09-01', 90)])).toBeNull();
    expect(
      homaIr([
        s('glucose_fasting', '2026-06-01', 100),
        s('insulin_fasting', '2026-06-01', 20, { unit: 'µIU/mL' }),
        s('glucose_fasting', '2026-09-01', 90),
        s('insulin_fasting', '2026-09-01', 9, { unit: 'µIU/mL' }),
      ]),
    ).toEqual({ value: 2, taken_on: '2026-09-01' });
    // other units are not converted silently
    expect(
      homaIr([
        s('glucose_fasting', '2026-09-01', 5, { unit: 'mmol/L' }),
        s('insulin_fasting', '2026-09-01', 9, { unit: 'µIU/mL' }),
      ]),
    ).toBeNull();
  });
});

it('parseDecimal reads numbers the way each panel language writes them', () => {
  expect(parseDecimal('1.500,50')).toBe(1500.5);
  expect(parseDecimal('1,500.50')).toBe(1500.5);
  expect(parseDecimal('1 500,5')).toBe(1500.5);
  expect(parseDecimal('1.500')).toBe(1500);
  expect(parseDecimal('12,000')).toBe(12000);
  expect(parseDecimal('98,5')).toBe(98.5);
  expect(parseDecimal('1.25')).toBe(1.25);
  expect(parseDecimal('0,125')).toBe(0.125);
  expect(parseDecimal('٢٥٠٠')).toBe(2500);
  expect(parseDecimal('2500')).toBe(2500);
  expect(parseDecimal('abc')).toBeNull();
  expect(parseDecimal('1,2,3')).toBeNull();
  expect(parseDecimal('')).toBeNull();
});
