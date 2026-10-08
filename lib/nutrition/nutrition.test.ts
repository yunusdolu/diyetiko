import { describe, expect, it } from 'vitest';
import {
  bmi,
  bmiCategory,
  bmr,
  energyShares,
  exampleMacros,
  isValidInput,
  targetRange,
  tdee,
} from './energy';
import { deriveTags } from './tags';
import { add, dayTotals, forGrams, progress, round, sum } from './totals';
import { aggregate, fridgeMatch, niceQuantity, scaleLine } from './quantities';

describe('Mifflin-St Jeor', () => {
  it('matches the published equation for women and men', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
    expect(bmr({ sex: 'female', age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(1320.25, 2);
    // 10*80 + 6.25*180 - 5*40 + 5 = 1730
    expect(bmr({ sex: 'male', age: 40, heightCm: 180, weightKg: 80 })).toBeCloseTo(1730, 2);
  });

  it('applies activity factors', () => {
    expect(
      tdee({ sex: 'male', age: 40, heightCm: 180, weightKg: 80, activity: 'moderate' }),
    ).toBeCloseTo(1730 * 1.55, 2);
  });

  it('validates adult ranges only', () => {
    expect(
      isValidInput({ sex: 'female', age: 17, heightCm: 160, weightKg: 55, activity: 'light' }),
    ).toBe(false);
    expect(
      isValidInput({ sex: 'female', age: 30, heightCm: 160, weightKg: 55, activity: 'light' }),
    ).toBe(true);
    expect(
      isValidInput({
        sex: 'female',
        age: 30,
        heightCm: Number.NaN,
        weightKg: 55,
        activity: 'light',
      }),
    ).toBe(false);
  });
});

describe('target ranges are conservative', () => {
  const small = {
    sex: 'female' as const,
    age: 60,
    heightCm: 150,
    weightKg: 45,
    activity: 'sedentary' as const,
  };

  it('never goes below BMR, even for weight loss', () => {
    const r = targetRange(small, 'lose');
    expect(r.min).toBeGreaterThanOrEqual(Math.round(bmr(small) / 10) * 10);
    expect(r.max).toBeGreaterThanOrEqual(r.min);
  });

  it('keeps every range at or above BMR across the whole valid input grid', () => {
    for (const sex of ['female', 'male'] as const)
      for (const age of [18, 40, 70, 100])
        for (const heightCm of [120, 160, 200, 230])
          for (const weightKg of [35, 70, 150, 300])
            for (const activity of [
              'sedentary',
              'light',
              'moderate',
              'active',
              'very_active',
            ] as const)
              for (const goal of ['lose', 'maintain', 'gain'] as const) {
                const input = { sex, age, heightCm, weightKg, activity };
                const floor = bmr(input);
                if (floor <= 0) continue;
                const r = targetRange(input, goal);
                expect(r.min).toBeGreaterThanOrEqual(Math.round(floor / 10) * 10);
                expect(r.max).toBeGreaterThanOrEqual(r.min);
              }
  });

  it('uses a modest deficit (≤15%) for loss', () => {
    const input = {
      sex: 'male' as const,
      age: 35,
      heightCm: 180,
      weightKg: 85,
      activity: 'active' as const,
    };
    const r = targetRange(input, 'lose');
    expect(r.min).toBeGreaterThanOrEqual(Math.floor((tdee(input) * 0.85) / 10) * 10);
  });

  it('gain and maintain bracket TDEE sensibly', () => {
    const input = {
      sex: 'female' as const,
      age: 28,
      heightCm: 168,
      weightKg: 62,
      activity: 'moderate' as const,
    };
    const t = tdee(input);
    const m = targetRange(input, 'maintain');
    expect(m.min).toBeLessThanOrEqual(t);
    expect(m.max).toBeGreaterThanOrEqual(t - 10);
    expect(targetRange(input, 'gain').min).toBeGreaterThan(t);
  });
});

describe('macros & BMI', () => {
  it('example split adds back up to the energy target', () => {
    const m = exampleMacros(2000, 70);
    const kcal = m.protein * 4 + m.carb * 4 + m.fat * 9;
    expect(Math.abs(kcal - 2000)).toBeLessThan(15);
    expect(m.protein).toBe(84); // 1.2 g/kg
  });

  it('caps protein at 30% of energy', () => {
    const m = exampleMacros(1200, 120);
    expect(m.protein * 4).toBeLessThanOrEqual(1200 * 0.3 + 2);
  });

  it('energy shares sum to 1', () => {
    const s = energyShares({ protein: 30, carb: 50, fat: 20 });
    expect(s.protein + s.carb + s.fat).toBeCloseTo(1, 5);
    expect(energyShares({ protein: 0, carb: 0, fat: 0 })).toEqual({ protein: 0, carb: 0, fat: 0 });
  });

  it('BMI uses WHO cut-offs', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2);
    expect(bmiCategory(18.4)).toBe('under');
    expect(bmiCategory(18.5)).toBe('normal');
    expect(bmiCategory(25)).toBe('over');
    expect(bmiCategory(30)).toBe('obese');
  });
});

describe('recipe tags follow documented thresholds', () => {
  const base = {
    kcal: 300,
    protein: 10,
    fiber: 2,
    prepMin: 10,
    cookMin: 20,
    dietFlags: [] as string[],
  };

  it('high protein needs ≥20% energy AND ≥15 g', () => {
    expect(deriveTags({ ...base, protein: 16, kcal: 300 })).toContain('high_protein'); // 21%
    expect(deriveTags({ ...base, protein: 14, kcal: 200 })).not.toContain('high_protein'); // 28% but <15 g
    expect(deriveTags({ ...base, protein: 20, kcal: 500 })).not.toContain('high_protein'); // 16%
  });

  it('fibre, energy, time and diet flags', () => {
    const tags = deriveTags({
      ...base,
      fiber: 6,
      kcal: 400,
      prepMin: 5,
      cookMin: 15,
      dietFlags: ['vegan', 'gluten_free'],
    });
    expect(tags).toEqual(
      expect.arrayContaining(['high_fiber', 'under_400', 'quick', 'vegan', 'gluten_free']),
    );
    expect(deriveTags({ ...base, kcal: 401 })).not.toContain('under_400');
    expect(deriveTags({ ...base, prepMin: 10, cookMin: 11 })).not.toContain('quick');
  });
});

describe('program totals', () => {
  const egg = { kcal: 143, protein: 12.6, carb: 0.7, fat: 9.5, fiber: 0 };

  it('scales per-100 g values', () => {
    expect(round(forGrams(egg, 50))).toEqual({
      kcal: 72,
      protein: 6.3,
      carb: 0.4,
      fat: 4.8,
      fiber: 0,
    });
  });

  it('sums meals and days', () => {
    const items = [
      { mealId: 'a', ...forGrams(egg, 100) },
      { mealId: 'a', ...forGrams(egg, 50) },
      { mealId: 'b', kcal: 100, protein: 1, carb: 20, fat: 1, fiber: 3 },
    ];
    const { byMeal, day } = dayTotals(items);
    expect(Math.round(byMeal.get('a')!.kcal)).toBe(215);
    expect(Math.round(day.kcal)).toBe(315);
    expect(sum([])).toEqual({ kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 });
    expect(add(egg, egg).kcal).toBe(286);
  });

  it('reports progress against targets', () => {
    const p = progress(
      { kcal: 1500, protein: 75, carb: 150, fat: 50, fiber: 20 },
      { kcal: 2000, protein: null },
    );
    expect(p.kcal.ratio).toBe(0.75);
    expect(p.protein.ratio).toBeNull();
  });
});

describe('quantities', () => {
  it('scales ingredient lines with servings', () => {
    const line = { foodKey: 'egg', name: 'Yumurta', grams: 150, unitKey: 'piece', unitQty: 3 };
    expect(scaleLine(line, 2, 3)).toMatchObject({ grams: 225, unitQty: 4.5 });
  });

  it('formats friendly quantities', () => {
    expect(niceQuantity(0.5, 'unit')).toBe('½');
    expect(niceQuantity(1.25, 'unit')).toBe('1¼');
    expect(niceQuantity(2.98, 'unit')).toBe('3');
    expect(niceQuantity(4.5, 'unit')).toBe('4½');
    expect(niceQuantity(7.3, 'grams')).toBe('7.5');
    expect(niceQuantity(233, 'grams')).toBe('235');
  });

  it('aggregates a shopping list across recipes', () => {
    const list = aggregate([
      {
        title: 'A',
        servings: 2,
        baseServings: 2,
        lines: [{ foodKey: 'egg', name: 'Yumurta', grams: 100, unitKey: null, unitQty: null }],
      },
      {
        title: 'B',
        servings: 4,
        baseServings: 2,
        lines: [
          { foodKey: 'egg', name: 'Yumurta', grams: 50, unitKey: null, unitQty: null },
          { foodKey: 'honey', name: 'Bal', grams: 7, unitKey: null, unitQty: null, optional: true },
        ],
      },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ foodKey: 'egg', grams: 200, recipes: ['A', 'B'] });
  });

  it('scores fridge matches', () => {
    expect(fridgeMatch(['egg', 'tomato', 'pepper'], new Set(['egg', 'tomato']))).toMatchObject({
      have: 2,
      total: 3,
      missing: ['pepper'],
    });
  });
});
