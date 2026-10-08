/**
 * Energy estimates — deliberately conservative (DESIGN.md / brief):
 *  - Mifflin-St Jeor for resting energy (BMR).
 *  - Suggested ranges NEVER go below BMR, and weight-loss ranges use a modest deficit only.
 *  - BMI is always presented with its limitations.
 */
export type Sex = 'female' | 'male';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'maintain' | 'lose' | 'gain';

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 300 },
} as const;

export interface EnergyInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
}

export function isValidInput(i: Partial<EnergyInput>): i is EnergyInput {
  const ok = (v: unknown, { min, max }: { min: number; max: number }) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  return (
    (i.sex === 'female' || i.sex === 'male') &&
    ok(i.age, LIMITS.age) &&
    ok(i.heightCm, LIMITS.heightCm) &&
    ok(i.weightKg, LIMITS.weightKg) &&
    typeof i.activity === 'string' &&
    i.activity in ACTIVITY_FACTORS
  );
}

/** Mifflin-St Jeor (1990): 10·kg + 6.25·cm − 5·age + (5 | −161) */
export function bmr({ sex, age, heightCm, weightKg }: Omit<EnergyInput, 'activity'>): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function tdee(input: EnergyInput): number {
  return bmr(input) * ACTIVITY_FACTORS[input.activity];
}

export interface TargetRange {
  min: number;
  max: number;
  /** true when the range was raised to stay at or above BMR */
  flooredAtBmr: boolean;
}

/**
 * Suggested daily range for a goal.
 *  maintain: TDEE ±5%
 *  lose:     TDEE −15% … −10% (modest deficit), floored at BMR
 *  gain:     TDEE +5% … +10%
 * Values are rounded to the nearest 10 kcal.
 */
export function targetRange(input: EnergyInput, goal: Goal): TargetRange {
  const base = tdee(input);
  const restingFloor = bmr(input);
  let min: number;
  let max: number;
  if (goal === 'lose') {
    min = base * 0.85;
    max = base * 0.9;
  } else if (goal === 'gain') {
    min = base * 1.05;
    max = base * 1.1;
  } else {
    min = base * 0.95;
    max = base * 1.05;
  }
  let flooredAtBmr = false;
  if (min < restingFloor) {
    min = restingFloor;
    flooredAtBmr = true;
  }
  if (max < min) {
    max = min;
    flooredAtBmr = true;
  }
  return { min: round10(min), max: round10(max), flooredAtBmr };
}

export interface MacroGrams {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

/**
 * Example split (not a prescription): protein ≈1.2 g/kg, fat ≈30% of energy, carbs = remainder.
 * Protein is capped at 30% of energy so small bodies with low targets stay sensible.
 */
export function exampleMacros(kcal: number, weightKg: number): MacroGrams {
  const proteinKcal = Math.min(1.2 * weightKg * 4, kcal * 0.3);
  const fatKcal = kcal * 0.3;
  const carbKcal = Math.max(0, kcal - proteinKcal - fatKcal);
  return {
    kcal: Math.round(kcal),
    protein: Math.round(proteinKcal / 4),
    fat: Math.round(fatKcal / 9),
    carb: Math.round(carbKcal / 4),
  };
}

/** Share of energy per macro, 0..1 each (for rings/donuts). Uses 4/4/9 kcal per gram. */
export function energyShares(m: { protein: number; carb: number; fat: number }) {
  const p = m.protein * 4;
  const c = m.carb * 4;
  const f = m.fat * 9;
  const total = p + c + f;
  if (total <= 0) return { protein: 0, carb: 0, fat: 0 };
  return { protein: p / total, carb: c / total, fat: f / total };
}

export type BmiCategory = 'under' | 'normal' | 'over' | 'obese';

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** WHO adult cut-offs. */
export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'under';
  if (value < 25) return 'normal';
  if (value < 30) return 'over';
  return 'obese';
}

function round10(v: number) {
  return Math.round(v / 10) * 10;
}

/**
 * Gauge scale end (kcal). 0–4.000 covers most adults; a larger daily need or range switches to
 * 0–6.000 or 0–8.000 (the largest valid input gives a range up to ≈6.900), so the needle and the
 * band always sit ON the scale instead of being pinned at its end.
 */
export function gaugeScaleMax(top: number): number {
  return top <= 4000 ? 4000 : top <= 6000 ? 6000 : 8000;
}

export interface CalculatorResult {
  bmr: number;
  tdee: number;
  range: TargetRange;
  /** energy the example split is made for */
  exampleKcal: number;
  macros: MacroGrams;
  /** BMI rounded to the one decimal that is displayed */
  bmi: number;
  /** category of the DISPLAYED value (24.96 reads "25.0" → overweight range, not normal) */
  bmiCategory: BmiCategory;
  gaugeMax: number;
}

/** Everything the energy & macro calculator displays, for one valid input and goal. */
export function calculate(input: EnergyInput, goal: Goal): CalculatorResult {
  const resting = bmr(input);
  const daily = tdee(input);
  const range = targetRange(input, goal);
  // Example split: for "maintain" exactly the daily need (so the two numbers match on screen);
  // otherwise the middle of the suggested range, rounded to 10 kcal.
  const exampleKcal = goal === 'maintain' ? daily : round10((range.min + range.max) / 2);
  const shownBmi = Math.round(bmi(input.weightKg, input.heightCm) * 10) / 10;
  return {
    bmr: resting,
    tdee: daily,
    range,
    exampleKcal,
    macros: exampleMacros(exampleKcal, input.weightKg),
    bmi: shownBmi,
    bmiCategory: bmiCategory(shownBmi),
    gaugeMax: gaugeScaleMax(Math.max(daily, range.max)),
  };
}
