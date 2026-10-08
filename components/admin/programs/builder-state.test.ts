import { describe, expect, it } from 'vitest';
import { foodItem, reducer, recipeItem, type Draft } from './builder-state';

const egg = {
  id: '11111111-1111-4111-8111-111111111111',
  key: 'egg',
  name: 'Yumurta',
  category: 'dairy_egg',
  kcal: 143,
  protein_g: 12.6,
  carb_g: 0.7,
  fat_g: 9.5,
  fiber_g: 0,
  units: [{ key: 'piece', grams: 50 }],
  review_status: 'needs_review' as const,
};

const base: Draft = {
  title: 'T',
  client_id: null,
  is_template: false,
  language: 'tr',
  status: 'draft',
  starts_on: null,
  target_kcal: 1800,
  target_protein_g: null,
  target_carb_g: null,
  target_fat_g: null,
  notes: null,
  hydration: null,
  days: [
    {
      id: 'd0',
      label: null,
      meals: [
        { id: 'm0', slot: 'breakfast', time_label: null, note: null, items: [] },
        { id: 'm1', slot: 'lunch', time_label: null, note: null, items: [] },
      ],
    },
  ],
};

describe('program builder reducer', () => {
  it('adds a food with macros for its default unit', () => {
    const item = foodItem(egg);
    expect(item.grams).toBe(50);
    expect(item.kcal).toBeCloseTo(71.5, 1);
    const d = reducer(base, { type: 'addItem', day: 0, mealId: 'm0', item });
    expect(d.days[0]!.meals[0]!.items).toHaveLength(1);
  });

  it('moves an item between meals at an index', () => {
    let d = reducer(base, {
      type: 'addItem',
      day: 0,
      mealId: 'm0',
      item: { ...foodItem(egg), id: 'a' },
    });
    d = reducer(d, { type: 'addItem', day: 0, mealId: 'm1', item: { ...foodItem(egg), id: 'b' } });
    d = reducer(d, {
      type: 'moveItem',
      day: 0,
      fromMeal: 'm0',
      toMeal: 'm1',
      itemId: 'a',
      toIndex: 0,
    });
    expect(d.days[0]!.meals[0]!.items).toHaveLength(0);
    expect(d.days[0]!.meals[1]!.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('copies a day with fresh ids and caps at 14 days', () => {
    let d = reducer(base, {
      type: 'addItem',
      day: 0,
      mealId: 'm0',
      item: { ...foodItem(egg), id: 'a' },
    });
    d = reducer(d, { type: 'copyDay', day: 0 });
    expect(d.days).toHaveLength(2);
    expect(d.days[1]!.meals[0]!.items[0]!.id).not.toBe('a');
    for (let i = 0; i < 20; i++) d = reducer(d, { type: 'addDay' });
    expect(d.days).toHaveLength(14);
  });

  it('scales recipe items by servings', () => {
    const r = recipeItem(
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'X',
        kcal: 300,
        protein_g: 20,
        carb_g: 30,
        fat_g: 10,
        fiber_g: 5,
        illustration: 'egg',
      },
      1.5,
    );
    expect(r.kcal).toBe(450);
    expect(r.protein_g).toBe(30);
  });

  it('never removes the last day', () => {
    expect(reducer(base, { type: 'removeDay', day: 0 }).days).toHaveLength(1);
  });
});
