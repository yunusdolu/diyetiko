import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/portal/logic';
import {
  adherenceDays,
  ageOn,
  attention,
  clinical,
  dailyWeights,
  driftAway,
  goalDirection,
  goalJourney,
  waNumber,
  weightTrend,
  type ClientFacts,
  type WeightSample,
} from './signals';

const TODAY = '2026-10-01';
/** n samples, one every `step` days ending today, starting at `kg0` and moving `perDay` a day */
function line(
  n: number,
  step: number,
  kg0: number,
  perDay: number,
  source: WeightSample['source'] = 'self',
) {
  return Array.from({ length: n }, (_, i) => {
    const back = (n - 1 - i) * step;
    return {
      day: addDays(TODAY, -back),
      kg: Math.round((kg0 + perDay * i * step) * 10) / 10,
      source,
    };
  });
}

describe('daily weights', () => {
  it('keeps one value per day and prefers the clinic scale', () => {
    const d = dailyWeights([
      { day: '2026-09-02', kg: 70.4, source: 'self' },
      { day: '2026-09-01', kg: 71, source: 'self' },
      { day: '2026-09-02', kg: 70.1, source: 'clinic' },
      { day: '2026-09-02', kg: 70.9, source: 'self' },
    ]);
    expect(d).toEqual([
      { day: '2026-09-01', kg: 71, source: 'self' },
      { day: '2026-09-02', kg: 70.1, source: 'clinic' },
    ]);
  });
});

describe('weight trend', () => {
  it('is the least-squares slope in kg per week', () => {
    // −0.1 kg a day for 4 weeks → −0.7 kg / week
    const t = weightTrend(line(15, 2, 80, -0.1));
    expect(t!.perWeek).toBeCloseTo(-0.7, 1);
    expect(t!.samples).toBe(15);
  });
  it('needs three days spanning a week — fewer points are noise, not a trend', () => {
    expect(weightTrend(line(2, 7, 80, -0.1))).toBeNull();
    expect(weightTrend(line(3, 2, 80, -0.1))).toBeNull(); // only 4 days
    expect(weightTrend(line(3, 4, 80, -0.1))).not.toBeNull(); // 8 days
  });
  it('only looks at the window before the latest weight', () => {
    // gained long ago, losing in the last six weeks
    const old = line(5, 7, 70, 0.2).map((s) => ({ ...s, day: addDays(s.day, -120) }));
    const recent = line(10, 4, 78, -0.05);
    expect(weightTrend([...old, ...recent])!.perWeek).toBeLessThan(0);
  });
});

describe('goal journey', () => {
  it('direction: lose / gain / keep within ±0.5 kg', () => {
    expect(goalDirection(80, 70)).toBe('lose');
    expect(goalDirection(55, 60)).toBe('gain');
    expect(goalDirection(64.6, 65)).toBe('maintain');
  });

  it('covers distance, remaining kg and an estimate at the current pace', () => {
    // 80 → 76 over 40 days (−0.7 kg/week), goal 70
    const j = goalJourney(line(21, 2, 80, -0.1), 70)!;
    expect(j.direction).toBe('lose');
    expect(j.start.kg).toBe(80);
    expect(j.current.kg).toBe(76);
    expect(j.change).toBe(-4);
    expect(j.progress).toBeCloseTo(0.4, 5);
    expect(j.remaining).toBe(6);
    expect(j.reached).toBe(false);
    // 6 kg at 0.7 kg / week ≈ 60 days
    expect(j.etaDays).toBeGreaterThan(55);
    expect(j.etaDays).toBeLessThan(65);
  });

  it('no estimate when the trend points away from the goal, is flat, or is years away', () => {
    expect(goalJourney(line(21, 2, 76, 0.05), 70)!.etaDays).toBeNull(); // gaining, goal is to lose
    expect(goalJourney(line(21, 2, 76, 0), 70)!.etaDays).toBeNull(); // flat
    expect(goalJourney(line(21, 2, 120, -0.008), 70)!.etaDays).toBeNull(); // ~0.06 kg/wk, >2 years
  });

  it('wrong way reads 0 %, overshooting reads 100 % and reached', () => {
    const away = goalJourney(
      [
        { day: '2026-09-01', kg: 80, source: 'clinic' },
        { day: '2026-09-20', kg: 81.5, source: 'clinic' },
      ],
      70,
    )!;
    expect(away.progress).toBe(0);
    expect(away.remaining).toBe(11.5);
    const past = goalJourney(
      [
        { day: '2026-06-01', kg: 60, source: 'clinic' },
        { day: '2026-09-20', kg: 63.2, source: 'clinic' },
      ],
      62,
    )!;
    expect([past.direction, past.progress, past.reached, past.remaining]).toEqual([
      'gain',
      1,
      true,
      0,
    ]);
  });

  it('keeping a weight: reached within 1 kg', () => {
    const j = goalJourney(
      [
        { day: '2026-09-01', kg: 65.2, source: 'clinic' },
        { day: '2026-09-20', kg: 65.8, source: 'clinic' },
      ],
      65,
    )!;
    expect([j.direction, j.reached, j.progress]).toEqual(['maintain', true, 1]);
  });

  it('nothing without a goal or a weight', () => {
    expect(goalJourney([], 70)).toBeNull();
    expect(goalJourney(line(3, 7, 80, 0), null)).toBeNull();
  });
});

describe('needs attention', () => {
  const base: ClientFacts = {
    id: 'c1',
    full_name: 'Ayşe',
    since: addDays(TODAY, -60),
    goal_weight_kg: null,
    kvkk: true,
    onPortal: true,
    unread: 0,
    lastActivity: TODAY,
    lastMeasured: addDays(TODAY, -5),
    hasNextAppointment: true,
    lastAppointment: addDays(TODAY, -5),
    overdueTasks: 0,
    weights: [],
  };

  it('a client with nothing pending is not listed', () => {
    expect(attention([base], TODAY)).toEqual([]);
  });

  it('lists each reason with its value and the tab that resolves it, strongest first', () => {
    const [row] = attention(
      [
        {
          ...base,
          unread: 2,
          lastActivity: addDays(TODAY, -9),
          lastMeasured: addDays(TODAY, -40),
          kvkk: false,
        },
      ],
      TODAY,
    );
    expect(row!.reasons).toEqual([
      { kind: 'unread', value: 2, tab: 'messages' },
      { kind: 'quiet', value: 9, tab: 'tracking' },
      { kind: 'noConsent', value: null, tab: 'general' },
      { kind: 'measureDue', value: 40, tab: 'measurements' },
    ]);
    // unread 4 + 2, quiet 2 + 1 (a week or more), consent 2, measurement 1 + 1 (5 weeks or more)
    expect(row!.score).toBe(13);
  });

  it('quiet only counts for portal clients who have logged before', () => {
    expect(
      attention([{ ...base, onPortal: false, lastActivity: addDays(TODAY, -30) }], TODAY),
    ).toEqual([]);
    expect(attention([{ ...base, lastActivity: addDays(TODAY, -3) }], TODAY)).toEqual([]);
    expect(
      attention([{ ...base, lastActivity: addDays(TODAY, -4) }], TODAY)[0]!.reasons[0],
    ).toEqual({
      kind: 'quiet',
      value: 4,
      tab: 'tracking',
    });
  });

  it('weight drifting away from the goal: 1 kg up from the lowest of the last three weeks', () => {
    const weights: WeightSample[] = [
      { day: addDays(TODAY, -40), kg: 82, source: 'clinic' },
      { day: addDays(TODAY, -14), kg: 78.4, source: 'self' },
      { day: addDays(TODAY, -7), kg: 78.9, source: 'self' },
      { day: TODAY, kg: 79.6, source: 'self' },
    ];
    expect(driftAway(weights, 72, TODAY)).toBe(1.2);
    const [row] = attention([{ ...base, goal_weight_kg: 72, weights }], TODAY);
    expect(row!.reasons).toEqual([{ kind: 'driftAway', value: 1.2, tab: 'tracking' }]);
    // the same numbers are progress for a client who wants to GAIN
    expect(
      driftAway(
        weights.map((w) => ({ ...w, kg: 150 - w.kg })),
        80,
        TODAY,
      ),
    ).toBe(1.2);
    // 0.8 kg is within normal day-to-day swing
    expect(
      driftAway(weights.slice(0, 3).concat({ day: TODAY, kg: 79.2, source: 'self' }), 72, TODAY),
    ).toBe(0.8);
  });

  it('a new client gets a week before "no measurement" and "no appointment" count', () => {
    const fresh = {
      ...base,
      since: addDays(TODAY, -3),
      lastMeasured: null,
      hasNextAppointment: false,
      lastAppointment: null,
    };
    expect(attention([fresh], TODAY)).toEqual([]);
    const [row] = attention([{ ...fresh, since: addDays(TODAY, -8) }], TODAY);
    expect(row!.reasons.map((r) => [r.kind, r.value])).toEqual([
      ['measureDue', null],
      ['noAppointment', null],
    ]);
  });

  it('no appointment: only when nothing is booked and the last visit is four weeks old', () => {
    const noNext = { ...base, hasNextAppointment: false };
    expect(attention([{ ...noNext, lastAppointment: addDays(TODAY, -20) }], TODAY)).toEqual([]);
    expect(
      attention([{ ...noNext, lastAppointment: addDays(TODAY, -28) }], TODAY)[0]!.reasons,
    ).toEqual([{ kind: 'noAppointment', value: 28, tab: 'appointments' }]);
  });

  it('sorts by score, then name', () => {
    const rows = attention(
      [
        { ...base, id: 'a', full_name: 'Zeynep', overdueTasks: 1 },
        { ...base, id: 'b', full_name: 'Ali', unread: 1 },
        { ...base, id: 'c', full_name: 'Can', overdueTasks: 3 },
      ],
      TODAY,
    );
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('clinical indicators', () => {
  const woman = {
    sex: 'female' as const,
    birth_date: '1991-04-12',
    height_cm: 166,
    activity_level: 'light' as const,
    goal_weight_kg: 64,
  };

  it('age on a given day (birthday not reached yet)', () => {
    expect(ageOn('1991-04-12', '2026-04-11')).toBe(34);
    expect(ageOn('1991-04-12', '2026-04-12')).toBe(35);
  });

  it('BMI, healthy range, waist ratios and energy from the same formulas as the calculator', () => {
    const c = clinical(woman, { weight_kg: 66.6, waist_cm: 75.4, hip_cm: 93.4 }, TODAY);
    // 66.6 / 1.66² = 24.17
    expect([c.bmi, c.bmiCategory]).toEqual([24.2, 'normal']);
    // 18.5 × 1.66² = 50.98 … 24.9 × 1.66² = 68.61
    expect(c.healthyRange).toEqual([51, 68.6]);
    expect([c.whtr, c.whtrBand]).toEqual([0.45, 'ok']); // 75.4 / 166
    expect([c.whr, c.whrBand]).toEqual([0.81, 'ok']); // 75.4 / 93.4, women ≥ 0.85
    expect(c.age).toBe(35);
    // Mifflin: 666 + 1037.5 − 175 − 161 = 1367.5 ; × 1.375 = 1880.3 ; goal 64 < 66.6 → lose
    expect(c.energy!.bmr).toBeCloseTo(1367.5, 5);
    expect(c.energy!.tdee).toBeCloseTo(1880.3125, 4);
    expect(c.energy!.goal).toBe('lose');
    expect(c.energy!.range.max).toBeLessThan(c.energy!.tdee);
    expect(c.energy!.range.min).toBeGreaterThanOrEqual(Math.round(c.energy!.bmr / 10) * 10);
    expect(c.missing).toEqual([]);
  });

  it('waist bands: raised from 0.5 / WHO waist-hip cut-offs by sex', () => {
    const man = { ...woman, sex: 'male' as const, height_cm: 175 };
    expect(clinical(man, { weight_kg: 90, waist_cm: 92, hip_cm: 101 }, TODAY)).toMatchObject({
      whtr: 0.53,
      whtrBand: 'raised',
      whr: 0.91,
      whrBand: 'raised',
    });
    expect(clinical(man, { weight_kg: 90, waist_cm: 106, hip_cm: 110 }, TODAY).whtrBand).toBe(
      'high',
    );
    // 0.87 is raised for a woman, not for a man
    expect(clinical(woman, { weight_kg: 70, waist_cm: 87, hip_cm: 100 }, TODAY).whrBand).toBe(
      'raised',
    );
    expect(clinical(man, { weight_kg: 70, waist_cm: 87, hip_cm: 100 }, TODAY).whrBand).toBe('ok');
  });

  it('says what is missing instead of guessing', () => {
    const c = clinical(
      {
        sex: 'other',
        birth_date: null,
        height_cm: null,
        activity_level: null,
        goal_weight_kg: null,
      },
      { weight_kg: 70, waist_cm: null, hip_cm: null },
      TODAY,
    );
    expect(c.bmi).toBeNull();
    expect(c.energy).toBeNull();
    expect(c.missing.sort()).toEqual(['activity', 'birthDate', 'height', 'hip', 'sex', 'waist']);
  });

  it('keeps the weight when the goal is within half a kilo', () => {
    expect(
      clinical(
        { ...woman, goal_weight_kg: 66.4 },
        { weight_kg: 66.6, waist_cm: null, hip_cm: null },
        TODAY,
      ).energy!.goal,
    ).toBe('maintain');
  });
});

describe('adherence strip', () => {
  it('28 days ending today, with the share of active habits ticked', () => {
    const days = adherenceDays(
      [
        { day: TODAY, habits: ['h1', 'h2', 'gone'] },
        { day: addDays(TODAY, -2), habits: [] },
      ],
      ['h1', 'h2', 'h3', 'h4'],
      TODAY,
    );
    expect(days).toHaveLength(28);
    expect(days[0]!.day).toBe(addDays(TODAY, -27));
    expect(days.at(-1)).toEqual({ day: TODAY, logged: true, habits: 0.5 });
    expect(days.at(-2)).toEqual({ day: addDays(TODAY, -1), logged: false, habits: null });
    expect(days.at(-3)).toEqual({ day: addDays(TODAY, -2), logged: true, habits: 0 });
  });
});

describe('WhatsApp numbers', () => {
  it('normalises Turkish local formats and refuses partial numbers', () => {
    expect(waNumber('+90 555 000 00 01')).toBe('905550000001');
    expect(waNumber('0555 000 00 42')).toBe('905550000042');
    expect(waNumber('555 000 00 42')).toBe('905550000042');
    expect(waNumber('0049 151 2345 6789')).toBe('4915123456789');
    expect(waNumber('+33 6 12 34 56 78')).toBe('33612345678');
    expect(waNumber('12345')).toBeNull();
    expect(waNumber('')).toBeNull();
    expect(waNumber(null)).toBeNull();
  });
});

describe('birthdays', () => {
  it('days until the next one and the age it brings', async () => {
    const { nextBirthday } = await import('./signals');
    expect(nextBirthday('1991-10-01', '2026-10-01')).toEqual({ days: 0, turns: 35 });
    expect(nextBirthday('1991-10-04', '2026-10-01')).toEqual({ days: 3, turns: 35 });
    // already passed this year → next year
    expect(nextBirthday('1991-09-30', '2026-10-01')).toEqual({ days: 364, turns: 36 });
    // across the new year
    expect(nextBirthday('2000-01-02', '2026-12-30')).toEqual({ days: 3, turns: 27 });
    // 29 February: 28 February in a common year, the real day in a leap year
    expect(nextBirthday('2004-02-29', '2027-02-20')).toEqual({ days: 8, turns: 23 });
    expect(nextBirthday('2004-02-29', '2028-02-20')).toEqual({ days: 9, turns: 24 });
  });
});
