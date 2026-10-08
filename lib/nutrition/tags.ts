/**
 * Factual recipe tags, derived from data with documented thresholds (see README → "Recipe tags").
 * No health claims: these describe composition, not effects.
 */
export type DerivedTag = 'high_protein' | 'high_fiber' | 'under_400' | 'quick';
export type DietFlag = 'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free';
export type RecipeTag = DerivedTag | DietFlag;

export const THRESHOLDS = {
  /** protein ≥ 20% of energy AND ≥ 15 g per serving */
  highProtein: { energyShare: 0.2, minGrams: 15 },
  /** ≥ 6 g fibre per serving */
  highFiber: { minGrams: 6 },
  /** ≤ 400 kcal per serving */
  under400: { maxKcal: 400 },
  /** prep + cook ≤ 20 minutes */
  quick: { maxMinutes: 20 },
} as const;

export interface TaggableRecipe {
  kcal: number;
  protein: number;
  fiber: number;
  prepMin: number;
  cookMin: number;
  dietFlags: readonly string[];
}

export function deriveTags(r: TaggableRecipe): RecipeTag[] {
  const tags: RecipeTag[] = [];
  const proteinShare = r.kcal > 0 ? (r.protein * 4) / r.kcal : 0;
  if (
    proteinShare >= THRESHOLDS.highProtein.energyShare &&
    r.protein >= THRESHOLDS.highProtein.minGrams
  ) {
    tags.push('high_protein');
  }
  if (r.fiber >= THRESHOLDS.highFiber.minGrams) tags.push('high_fiber');
  if (r.kcal > 0 && r.kcal <= THRESHOLDS.under400.maxKcal) tags.push('under_400');
  if (r.prepMin + r.cookMin <= THRESHOLDS.quick.maxMinutes) tags.push('quick');
  for (const f of ['vegetarian', 'vegan', 'gluten_free', 'dairy_free'] as const) {
    if (r.dietFlags.includes(f)) tags.push(f);
  }
  return tags;
}
