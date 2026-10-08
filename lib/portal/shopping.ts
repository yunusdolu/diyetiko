import type { PortalProgram } from '@/types/portal';

export interface ShoppingLine {
  /** stable within a programme: the name, lower-cased */
  key: string;
  name: string;
  /** how many times it appears in the plan */
  times: number;
  /** total grams when every appearance has a weight; otherwise null */
  grams: number | null;
}

/**
 * The foods of a programme as one list: each name once, with how often it appears and — when every
 * appearance has a weight — the total. Recipes stay as their own line (their ingredients are on the
 * recipe page). Sorted by name in the given locale.
 */
export function shoppingList(
  program: Pick<PortalProgram, 'days'>,
  locale: string,
  /** which days to include (indexes); all when omitted */
  days?: number[],
): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine & { weighed: boolean }>();
  program.days.forEach((d, i) => {
    if (days && !days.includes(i)) return;
    for (const meal of d.meals)
      for (const it of meal.items) {
        const name = it.name.trim();
        if (!name) continue;
        const key = name.toLocaleLowerCase(locale);
        const line = lines.get(key) ?? { key, name, times: 0, grams: 0, weighed: true };
        line.times += 1;
        if (it.grams != null && line.weighed) line.grams = (line.grams ?? 0) + it.grams;
        else {
          line.weighed = false;
          line.grams = null;
        }
        lines.set(key, line);
      }
  });
  return [...lines.values()]
    .map(({ key, name, times, grams }) => ({
      key,
      name,
      times,
      grams: grams == null ? null : Math.round(grams),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
