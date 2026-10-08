import { describe, expect, it } from 'vitest';
import { shoppingList } from './shopping';

const item = (name: string, grams: number | null) => ({
  name,
  grams,
  unitKey: null,
  unitQty: null,
  servings: null,
  kcal: 0,
  protein: 0,
  carb: 0,
  fat: 0,
  fiber: 0,
  note: null,
});
const day = (...items: ReturnType<typeof item>[]) => ({
  position: 0,
  label: null,
  meals: [{ slot: 'breakfast' as const, time: null, note: null, items }],
});

describe('shoppingList', () => {
  const program = {
    days: [
      day(item('Yumurta', 100), item('Tam buğday ekmeği', 60)),
      day(item('yumurta', 50), item('Menemen', null)),
      day(item('Menemen', 200), item(' ', 10)),
    ],
  };

  it('lists each food once, with its count and total weight', () => {
    expect(shoppingList(program, 'tr')).toEqual([
      // one appearance without a weight: no total
      { key: 'menemen', name: 'Menemen', times: 2, grams: null },
      { key: 'tam buğday ekmeği', name: 'Tam buğday ekmeği', times: 1, grams: 60 },
      { key: 'yumurta', name: 'Yumurta', times: 2, grams: 150 },
    ]);
  });

  it('can be limited to some days', () => {
    expect(shoppingList(program, 'tr', [0]).map((l) => l.key)).toEqual([
      'tam buğday ekmeği',
      'yumurta',
    ]);
  });

  it('is empty for an empty programme', () => {
    expect(shoppingList({ days: [] }, 'tr')).toEqual([]);
  });
});
