/** Macro arithmetic shared by recipes, the program builder and the share page. */
export interface Macros {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
}

export const ZERO: Macros = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 };

export function add(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carb: a.carb + b.carb,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

export function sum(items: readonly Macros[]): Macros {
  return items.reduce(add, ZERO);
}

export function scale(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    carb: m.carb * factor,
    fat: m.fat * factor,
    fiber: m.fiber * factor,
  };
}

/** Food values are per 100 g. */
export function forGrams(per100: Macros, grams: number): Macros {
  return scale(per100, grams / 100);
}

export function round(m: Macros, digits = 1): Macros {
  const f = 10 ** digits;
  const r = (v: number) => Math.round(v * f) / f;
  return {
    kcal: Math.round(m.kcal),
    protein: r(m.protein),
    carb: r(m.carb),
    fat: r(m.fat),
    fiber: r(m.fiber),
  };
}

export interface Targets {
  kcal?: number | null;
  protein?: number | null;
  carb?: number | null;
  fat?: number | null;
}

export type Progress = { value: number; target: number | null; ratio: number | null };

/** Ratio of actual to target (null when no target). Used for the animated bars. */
export function progress(
  actual: Macros,
  targets: Targets,
): Record<'kcal' | 'protein' | 'carb' | 'fat', Progress> {
  const one = (value: number, target: number | null | undefined): Progress => ({
    value,
    target: target ?? null,
    ratio: target && target > 0 ? value / target : null,
  });
  return {
    kcal: one(actual.kcal, targets.kcal),
    protein: one(actual.protein, targets.protein),
    carb: one(actual.carb, targets.carb),
    fat: one(actual.fat, targets.fat),
  };
}

export interface ProgramItemLike extends Macros {
  mealId: string;
}

/** Per-meal and per-day totals for a program day. */
export function dayTotals<T extends ProgramItemLike>(
  items: readonly T[],
): { byMeal: Map<string, Macros>; day: Macros } {
  const byMeal = new Map<string, Macros>();
  for (const it of items) byMeal.set(it.mealId, add(byMeal.get(it.mealId) ?? ZERO, it));
  return { byMeal, day: sum(items) };
}
