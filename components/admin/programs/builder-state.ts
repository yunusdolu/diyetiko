import type { ProgramTreeInput } from '@/lib/validators/admin';
import type { FoodOption, MealSlot, ProgramTree, RecipeOption } from '@/types/admin';

/** Editor state = the exact payload the server validates (ProgramTreeInput). Pure reducers. */
export type Draft = ProgramTreeInput;
export type DraftItem = Draft['days'][number]['meals'][number]['items'][number];

let seq = 0;
export const tmpId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function fromTree(tree: ProgramTree): Draft {
  return {
    title: tree.title,
    client_id: tree.client_id,
    is_template: tree.is_template,
    language: tree.language,
    status: tree.status,
    starts_on: tree.starts_on,
    target_kcal: tree.target_kcal,
    target_protein_g: tree.target_protein_g,
    target_carb_g: tree.target_carb_g,
    target_fat_g: tree.target_fat_g,
    notes: tree.notes,
    hydration: tree.hydration,
    days: tree.days.map((d) => ({
      id: d.id,
      label: d.label,
      meals: d.meals.map((m) => ({
        id: m.id,
        slot: m.slot,
        time_label: m.time_label,
        note: m.note,
        items: m.items.map((i) => ({ ...i })),
      })),
    })),
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function foodItem(
  f: FoodOption,
  grams?: number,
  unit?: { key: string; grams: number } | null,
): DraftItem {
  const g = grams ?? unit?.grams ?? f.units[0]?.grams ?? 100;
  return {
    id: tmpId('i'),
    food_id: f.id,
    recipe_id: null,
    name: f.name,
    grams: g,
    unit_key: unit?.key ?? null,
    unit_qty: unit ? r1(g / unit.grams) : null,
    servings: null,
    ...macrosForGrams(f, g),
    note: null,
  };
}

export function macrosForGrams(
  f: Pick<FoodOption, 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g'>,
  g: number,
) {
  const k = g / 100;
  return {
    kcal: r1(f.kcal * k),
    protein_g: r1(f.protein_g * k),
    carb_g: r1(f.carb_g * k),
    fat_g: r1(f.fat_g * k),
    fiber_g: r1(f.fiber_g * k),
  };
}

export function recipeItem(r: RecipeOption, servings = 1): DraftItem {
  return {
    id: tmpId('i'),
    food_id: null,
    recipe_id: r.id,
    name: r.title,
    grams: null,
    unit_key: null,
    unit_qty: null,
    servings,
    kcal: r1(r.kcal * servings),
    protein_g: r1(r.protein_g * servings),
    carb_g: r1(r.carb_g * servings),
    fat_g: r1(r.fat_g * servings),
    fiber_g: r1(r.fiber_g * servings),
    note: null,
  };
}

export type Action =
  | { type: 'meta'; patch: Partial<Omit<Draft, 'days'>> }
  | { type: 'replace'; draft: Draft }
  | { type: 'addItem'; day: number; mealId: string; item: DraftItem; index?: number }
  | { type: 'updateItem'; day: number; mealId: string; itemId: string; patch: Partial<DraftItem> }
  | { type: 'removeItem'; day: number; mealId: string; itemId: string }
  | {
      type: 'moveItem';
      day: number;
      fromMeal: string;
      toMeal: string;
      itemId: string;
      toIndex: number;
    }
  | { type: 'addMeal'; day: number; slot: MealSlot }
  | {
      type: 'updateMeal';
      day: number;
      mealId: string;
      patch: { slot?: MealSlot; time_label?: string | null; note?: string | null };
    }
  | { type: 'removeMeal'; day: number; mealId: string }
  | { type: 'addDay' }
  | { type: 'copyDay'; day: number }
  | { type: 'clearDay'; day: number }
  | { type: 'removeDay'; day: number };

function mapMeals(
  d: Draft,
  day: number,
  fn: (meals: Draft['days'][number]['meals']) => Draft['days'][number]['meals'],
): Draft {
  return { ...d, days: d.days.map((x, i) => (i === day ? { ...x, meals: fn(x.meals) } : x)) };
}

export function reducer(d: Draft, a: Action): Draft {
  switch (a.type) {
    case 'meta':
      return { ...d, ...a.patch };
    case 'replace':
      return a.draft;
    case 'addItem':
      return mapMeals(d, a.day, (meals) =>
        meals.map((m) => {
          if (m.id !== a.mealId) return m;
          const items = [...m.items];
          items.splice(a.index ?? items.length, 0, a.item);
          return { ...m, items };
        }),
      );
    case 'updateItem':
      return mapMeals(d, a.day, (meals) =>
        meals.map((m) =>
          m.id !== a.mealId
            ? m
            : { ...m, items: m.items.map((i) => (i.id === a.itemId ? { ...i, ...a.patch } : i)) },
        ),
      );
    case 'removeItem':
      return mapMeals(d, a.day, (meals) =>
        meals.map((m) =>
          m.id !== a.mealId ? m : { ...m, items: m.items.filter((i) => i.id !== a.itemId) },
        ),
      );
    case 'moveItem': {
      const item = d.days[a.day]?.meals
        .find((m) => m.id === a.fromMeal)
        ?.items.find((i) => i.id === a.itemId);
      if (!item) return d;
      return mapMeals(d, a.day, (meals) =>
        meals.map((m) => {
          let items = m.id === a.fromMeal ? m.items.filter((i) => i.id !== a.itemId) : m.items;
          if (m.id === a.toMeal) {
            items = [...items];
            items.splice(Math.max(0, Math.min(a.toIndex, items.length)), 0, item);
          }
          return { ...m, items };
        }),
      );
    }
    case 'addMeal':
      return mapMeals(d, a.day, (meals) => [
        ...meals,
        { id: tmpId('m'), slot: a.slot, time_label: null, note: null, items: [] },
      ]);
    case 'updateMeal':
      return mapMeals(d, a.day, (meals) =>
        meals.map((m) => (m.id === a.mealId ? { ...m, ...a.patch } : m)),
      );
    case 'removeMeal':
      return mapMeals(d, a.day, (meals) => meals.filter((m) => m.id !== a.mealId));
    case 'addDay':
      if (d.days.length >= 14) return d;
      return {
        ...d,
        days: [
          ...d.days,
          {
            id: tmpId('d'),
            label: null,
            meals: (['breakfast', 'lunch', 'snack_pm', 'dinner'] as const).map((slot) => ({
              id: tmpId('m'),
              slot,
              time_label: null,
              note: null,
              items: [],
            })),
          },
        ],
      };
    case 'copyDay': {
      if (d.days.length >= 14) return d;
      const src = d.days[a.day];
      if (!src) return d;
      const copy = {
        id: tmpId('d'),
        label: src.label,
        meals: src.meals.map((m) => ({
          ...m,
          id: tmpId('m'),
          items: m.items.map((i) => ({ ...i, id: tmpId('i') })),
        })),
      };
      const days = [...d.days];
      days.splice(a.day + 1, 0, copy);
      return { ...d, days };
    }
    case 'clearDay':
      return mapMeals(d, a.day, (meals) => meals.map((m) => ({ ...m, items: [] })));
    case 'removeDay':
      if (d.days.length <= 1) return d;
      return { ...d, days: d.days.filter((_, i) => i !== a.day) };
  }
}
