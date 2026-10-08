/**
 * The energy & macro calculator, checked against an independent reference written straight from
 * the published formulas (nothing below imports the implementation's helpers), over the whole
 * input space the sliders allow, plus hand-computed cases.
 */
import { describe, expect, it } from 'vitest';
import { calculate, gaugeScaleMax, type Activity, type EnergyInput, type Goal } from './energy';

// ---- reference --------------------------------------------------------------------------------
const FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};
const r10 = (v: number) => Math.round(v / 10) * 10;
function reference(i: EnergyInput, goal: Goal) {
  // Mifflin MD, St Jeor ST et al., Am J Clin Nutr 1990: 10·kg + 6.25·cm − 5·age + 5 (men) / − 161 (women)
  const bmr = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + (i.sex === 'male' ? 5 : -161);
  const tdee = bmr * FACTOR[i.activity];
  const [lo, hi] = goal === 'lose' ? [0.85, 0.9] : goal === 'gain' ? [1.05, 1.1] : [0.95, 1.05];
  const min = r10(Math.max(bmr, tdee * lo));
  const max = r10(Math.max(bmr, tdee * lo, tdee * hi));
  const kcal = goal === 'maintain' ? tdee : r10((min + max) / 2);
  const proteinKcal = Math.min(1.2 * i.weightKg * 4, kcal * 0.3);
  const fatKcal = kcal * 0.3;
  const bmi = Math.round((i.weightKg / (i.heightCm / 100) ** 2) * 10) / 10;
  return {
    bmr,
    tdee,
    min,
    max,
    kcal: Math.round(kcal),
    protein: Math.round(proteinKcal / 4),
    fat: Math.round(fatKcal / 9),
    carb: Math.round((kcal - proteinKcal - fatKcal) / 4),
    bmi,
    cat: bmi < 18.5 ? 'under' : bmi < 25 ? 'normal' : bmi < 30 ? 'over' : 'obese',
  };
}

const SEXES = ['female', 'male'] as const;
const ACTIVITIES = Object.keys(FACTOR) as Activity[];
const GOALS: Goal[] = ['maintain', 'lose', 'gain'];
// slider ranges of the calculator: age 18–90, height 120–220, weight 35–200
const AGES = [18, 19, 25, 32, 45, 60, 75, 90];
const HEIGHTS = [120, 135, 150, 158, 165, 171, 180, 195, 220];
const WEIGHTS = [35, 40, 48, 53, 60, 66, 73, 85, 92, 110, 150, 200];

function* grid() {
  for (const sex of SEXES)
    for (const age of AGES)
      for (const heightCm of HEIGHTS)
        for (const weightKg of WEIGHTS)
          for (const activity of ACTIVITIES)
            for (const goal of GOALS)
              yield [{ sex, age, heightCm, weightKg, activity }, goal] as const;
}

describe('calculator — hand-computed cases', () => {
  it('woman, 32 y, 165 cm, 66 kg, lightly active, maintain (the default on the page)', () => {
    const c = calculate(
      { sex: 'female', age: 32, heightCm: 165, weightKg: 66, activity: 'light' },
      'maintain',
    );
    // 660 + 1031.25 − 160 − 161 = 1370.25 ; × 1.375 = 1884.09
    expect(c.bmr).toBeCloseTo(1370.25, 5);
    expect(c.tdee).toBeCloseTo(1884.09375, 5);
    expect(c.range).toMatchObject({ min: 1790, max: 1980 }); // ±5 %, to the nearest 10
    // protein 1.2 g/kg = 79.2 g; fat 30 % = 565.2 kcal = 62.8 g; carbs = the rest = 250.5 g
    expect(c.macros).toEqual({ kcal: 1884, protein: 79, fat: 63, carb: 251 });
    expect(c.bmi).toBe(24.2);
    expect(c.bmiCategory).toBe('normal');
    expect(c.gaugeMax).toBe(4000);
  });

  it('man, 45 y, 180 cm, 92 kg, active, lose', () => {
    const c = calculate(
      { sex: 'male', age: 45, heightCm: 180, weightKg: 92, activity: 'active' },
      'lose',
    );
    // 920 + 1125 − 225 + 5 = 1825 ; × 1.725 = 3148.125 ; −15 % … −10 % = 2675.9 … 2833.3
    expect(c.bmr).toBe(1825);
    expect(c.tdee).toBeCloseTo(3148.125, 5);
    expect(c.range).toMatchObject({ min: 2680, max: 2830, flooredAtBmr: false });
    expect(c.exampleKcal).toBe(2760); // middle of the range, rounded to 10 (2755 → 2760)
    // protein 110.4 g (441.6 kcal, under the 30 % cap); fat 828 kcal = 92 g; carbs 1490.4 kcal = 372.6 g
    expect(c.macros).toEqual({ kcal: 2760, protein: 110, fat: 92, carb: 373 });
    expect(c.bmi).toBe(28.4);
    expect(c.bmiCategory).toBe('over');
  });

  it('the largest input stays on a bigger gauge scale', () => {
    const c = calculate(
      { sex: 'male', age: 18, heightCm: 220, weightKg: 200, activity: 'very_active' },
      'gain',
    );
    // 2000 + 1375 − 90 + 5 = 3290 ; × 1.9 = 6251 ; +5 % … +10 % = 6563.55 … 6876.1
    expect(c.bmr).toBe(3290);
    expect(c.tdee).toBeCloseTo(6251, 5);
    expect(c.range).toMatchObject({ min: 6560, max: 6880 });
    expect(c.gaugeMax).toBe(8000);
    // protein capped? 1.2 × 200 × 4 = 960 kcal < 30 % of 6720 → not capped
    expect(c.macros).toEqual({ kcal: 6720, protein: 240, fat: 224, carb: 936 });
  });

  it('a small, older body: protein is capped at 30 % of energy', () => {
    const c = calculate(
      { sex: 'female', age: 90, heightCm: 150, weightKg: 40, activity: 'sedentary' },
      'lose',
    );
    // 400 + 937.5 − 450 − 161 = 726.5 ; × 1.2 = 871.8 ; −15 % … −10 % = 741.03 … 784.62
    expect(c.bmr).toBeCloseTo(726.5, 5);
    expect(c.range).toMatchObject({ min: 740, max: 780 });
    expect(c.range.min).toBeGreaterThanOrEqual(Math.floor(c.bmr / 10) * 10);
    // 1.2 g/kg would be 48 g = 192 kcal; 30 % of 760 = 228 kcal → 48 g stands
    expect(c.macros.protein).toBe(48);
  });

  it('labels the BMI that is displayed, not the unrounded one', () => {
    // 73 / 1.71² = 24.965 → shown "25.0" → overweight range
    const edge = calculate(
      { sex: 'male', age: 60, heightCm: 171, weightKg: 73, activity: 'light' },
      'maintain',
    );
    expect(edge.bmi).toBe(25);
    expect(edge.bmiCategory).toBe('over');
    // 53 / 1.70² = 18.34 → "18.3" → underweight
    const low = calculate(
      { sex: 'female', age: 25, heightCm: 170, weightKg: 53, activity: 'light' },
      'maintain',
    );
    expect([low.bmi, low.bmiCategory]).toEqual([18.3, 'under']);
    // 95 / 1.75² = 31.02 → obese
    expect(
      calculate(
        { sex: 'male', age: 35, heightCm: 175, weightKg: 95, activity: 'light' },
        'maintain',
      ).bmiCategory,
    ).toBe('obese');
  });
});

describe('calculator — every combination the sliders allow', () => {
  it('matches the reference formulas everywhere', () => {
    let n = 0;
    for (const [input, goal] of grid()) {
      const c = calculate(input, goal);
      const r = reference(input, goal);
      const where = JSON.stringify({ ...input, goal });
      expect(c.bmr, where).toBeCloseTo(r.bmr, 6);
      expect(c.tdee, where).toBeCloseTo(r.tdee, 6);
      expect([c.range.min, c.range.max], where).toEqual([r.min, r.max]);
      expect(c.macros, where).toEqual({
        kcal: r.kcal,
        protein: r.protein,
        fat: r.fat,
        carb: r.carb,
      });
      expect([c.bmi, c.bmiCategory], where).toEqual([r.bmi, r.cat]);
      n++;
    }
    expect(n).toBe(2 * AGES.length * HEIGHTS.length * WEIGHTS.length * 5 * 3); // 25 920
  });

  it('keeps the promises the page makes', () => {
    for (const [input, goal] of grid()) {
      const c = calculate(input, goal);
      const where = JSON.stringify({ ...input, goal });
      // never below resting energy (to the nearest 10), never a crash deficit
      expect(c.range.min, where).toBeGreaterThanOrEqual(r10(c.bmr));
      expect(c.range.min, where).toBeGreaterThanOrEqual(r10(c.tdee * 0.85) - 10);
      expect(c.range.max, where).toBeGreaterThanOrEqual(c.range.min);
      // the range sits where the goal says, relative to the daily need
      if (goal === 'lose') expect(c.range.max, where).toBeLessThan(c.tdee);
      if (goal === 'gain') expect(c.range.min, where).toBeGreaterThan(c.tdee);
      if (goal === 'maintain') {
        expect(c.range.min, where).toBeLessThanOrEqual(c.tdee);
        expect(c.range.max, where).toBeGreaterThanOrEqual(c.tdee);
      }
      // the example split belongs to the range and adds back up to its energy
      expect(c.exampleKcal, where).toBeGreaterThanOrEqual(c.range.min - 5);
      expect(c.exampleKcal, where).toBeLessThanOrEqual(c.range.max + 5);
      const fromGrams = c.macros.protein * 4 + c.macros.carb * 4 + c.macros.fat * 9;
      expect(Math.abs(fromGrams - c.macros.kcal), where).toBeLessThanOrEqual(9); // gram rounding only
      expect(c.macros.protein * 4, where).toBeLessThanOrEqual(c.exampleKcal * 0.3 + 2);
      expect(c.macros.carb, where).toBeGreaterThan(0);
      // the gauge: needle, tick and band are all on the scale
      expect(c.tdee, where).toBeLessThanOrEqual(c.gaugeMax);
      expect(c.range.max, where).toBeLessThanOrEqual(c.gaugeMax);
      expect(c.bmr, where).toBeGreaterThan(0);
    }
  });

  it('more activity never lowers the need; a heavier or taller body never lowers it; age lowers it', () => {
    const base: EnergyInput = {
      sex: 'female',
      age: 40,
      heightCm: 165,
      weightKg: 70,
      activity: 'light',
    };
    const need = (patch: Partial<EnergyInput>) => calculate({ ...base, ...patch }, 'maintain').tdee;
    const byActivity = ACTIVITIES.map((activity) => need({ activity }));
    expect([...byActivity].sort((a, b) => a - b)).toEqual(byActivity);
    expect(need({ weightKg: 80 })).toBeGreaterThan(need({ weightKg: 70 }));
    expect(need({ heightCm: 180 })).toBeGreaterThan(need({ heightCm: 165 }));
    expect(need({ age: 60 })).toBeLessThan(need({ age: 40 }));
    // the equation's sex constant: +5 vs −161 → 166 kcal of resting energy
    const man = calculate({ ...base, sex: 'male' }, 'maintain').bmr;
    expect(man - calculate(base, 'maintain').bmr).toBeCloseTo(166, 6);
  });
});

describe('gauge scale', () => {
  it('steps 4.000 → 6.000 → 8.000', () => {
    expect([0, 1884, 4000].map(gaugeScaleMax)).toEqual([4000, 4000, 4000]);
    expect([4001, 5999, 6000].map(gaugeScaleMax)).toEqual([6000, 6000, 6000]);
    expect([6001, 6880].map(gaugeScaleMax)).toEqual([8000, 8000]);
  });
});
