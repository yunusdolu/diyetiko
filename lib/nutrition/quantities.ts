/** Servings scaling and shopping-list aggregation. Pure functions, unit-tested. */

export interface IngredientLine {
  foodKey: string;
  name: string;
  grams: number;
  unitKey: string | null;
  unitQty: number | null;
  optional?: boolean;
}

/** Scale an ingredient from the recipe's base servings to `servings`. */
export function scaleLine(
  line: IngredientLine,
  baseServings: number,
  servings: number,
): IngredientLine {
  const f = servings / baseServings;
  return {
    ...line,
    grams: line.grams * f,
    unitQty: line.unitQty == null ? null : line.unitQty * f,
  };
}

/**
 * Human-friendly quantity: halves and quarters for units (½, ¼, ¾), sensible rounding for grams.
 * Returns the numeric string only; the unit label is localized by the caller.
 */
export function niceQuantity(value: number, kind: 'unit' | 'grams'): string {
  if (kind === 'grams') {
    if (value < 10) return String(Math.round(value * 2) / 2);
    if (value < 100) return String(Math.round(value));
    return String(Math.round(value / 5) * 5);
  }
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  const quarters = Math.round(frac * 4);
  const glyph = ['', '¼', '½', '¾', ''][quarters] ?? '';
  const w = quarters === 4 ? whole + 1 : whole;
  if (w === 0 && glyph) return glyph;
  return glyph ? `${w}${glyph}` : String(w);
}

export interface ShoppingItem {
  foodKey: string;
  name: string;
  grams: number;
  /** recipes that need it */
  recipes: string[];
}

/** Merge ingredient lines from several recipes by food, summing grams. Optional lines are skipped. */
export function aggregate(
  recipes: readonly {
    title: string;
    servings: number;
    baseServings: number;
    lines: readonly IngredientLine[];
  }[],
): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const r of recipes) {
    for (const raw of r.lines) {
      if (raw.optional) continue;
      const line = scaleLine(raw, r.baseServings, r.servings);
      const prev = map.get(line.foodKey);
      if (prev) {
        prev.grams += line.grams;
        if (!prev.recipes.includes(r.title)) prev.recipes.push(r.title);
      } else {
        map.set(line.foodKey, {
          foodKey: line.foodKey,
          name: line.name,
          grams: line.grams,
          recipes: [r.title],
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Fridge finder score: share of (non-optional) ingredients the user has. */
export function fridgeMatch(ingredientKeys: readonly string[], have: ReadonlySet<string>) {
  const total = ingredientKeys.length;
  const owned = ingredientKeys.filter((k) => have.has(k)).length;
  return {
    have: owned,
    total,
    ratio: total ? owned / total : 0,
    missing: ingredientKeys.filter((k) => !have.has(k)),
  };
}
