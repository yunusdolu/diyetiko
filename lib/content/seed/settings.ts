/**
 * Seed site settings. Only facts the client supplied are filled in (phone/WhatsApp/Instagram).
 * Everything else (bio, credentials, address, e-mail, images) is intentionally empty so the
 * site shows clearly marked placeholders until the dietitian adds them in /admin/settings.
 */
export const seedSettings = {
  contact: {
    phoneE164: '+905370506733',
    phoneDisplay: '0537 050 67 33',
    whatsapp: '905370506733',
    instagram: 'muzahim_k',
    email: null as string | null,
    address: null as string | null,
  },
  images: {
    portrait: null as string | null,
    logo: null as string | null,
    og: null as string | null,
  },
  seo: { twitter: null as string | null },
  numbers: { arabicDigits: 'latn' as 'latn' | 'arab' },
};

/**
 * Example week for the home page. Meals reference seed recipes; extras reference foods.
 * Energy is computed from the food database at render time — never typed by hand.
 * Shown with a clear "example, portions are personal" caption.
 */
export const exampleWeek: {
  meals: {
    slot: 'breakfast' | 'lunch' | 'snack' | 'dinner';
    recipe: string;
    extras?: { food: string; grams: number }[];
  }[];
}[] = [
  {
    meals: [
      { slot: 'breakfast', recipe: 'overnight_oats' },
      { slot: 'lunch', recipe: 'quinoa_salad', extras: [{ food: 'bread_whole', grams: 30 }] },
      { slot: 'snack', recipe: 'apple_yogurt' },
      { slot: 'dinner', recipe: 'salmon_zucchini', extras: [{ food: 'bulgur', grams: 50 }] },
    ],
  },
  {
    meals: [
      {
        slot: 'breakfast',
        recipe: 'menemen',
        extras: [
          { food: 'bread_whole', grams: 60 },
          { food: 'feta', grams: 30 },
        ],
      },
      {
        slot: 'lunch',
        recipe: 'lentil_soup',
        extras: [
          { food: 'bread_whole', grams: 30 },
          { food: 'yogurt', grams: 150 },
        ],
      },
      { slot: 'snack', recipe: 'roasted_chickpeas', extras: [{ food: 'apple', grams: 180 }] },
      { slot: 'dinner', recipe: 'chicken_saute', extras: [{ food: 'rice_white', grams: 50 }] },
    ],
  },
  {
    meals: [
      { slot: 'breakfast', recipe: 'cilbir', extras: [{ food: 'bread_whole', grams: 60 }] },
      { slot: 'lunch', recipe: 'tuna_piyaz' },
      { slot: 'snack', recipe: 'apple_yogurt' },
      {
        slot: 'dinner',
        recipe: 'green_beans',
        extras: [
          { food: 'yogurt', grams: 150 },
          { food: 'bulgur', grams: 50 },
        ],
      },
    ],
  },
  {
    meals: [
      { slot: 'breakfast', recipe: 'overnight_oats', extras: [{ food: 'banana', grams: 120 }] },
      { slot: 'lunch', recipe: 'lentil_kofte', extras: [{ food: 'ayran', grams: 200 }] },
      { slot: 'snack', recipe: 'roasted_chickpeas' },
      { slot: 'dinner', recipe: 'salmon_zucchini', extras: [{ food: 'potato', grams: 170 }] },
    ],
  },
  {
    meals: [
      { slot: 'breakfast', recipe: 'menemen', extras: [{ food: 'bread_whole', grams: 60 }] },
      { slot: 'lunch', recipe: 'bulgur_pilaf', extras: [{ food: 'yogurt', grams: 150 }] },
      { slot: 'snack', recipe: 'apple_yogurt' },
      {
        slot: 'dinner',
        recipe: 'lentil_soup',
        extras: [
          { food: 'bread_whole', grams: 30 },
          { food: 'feta', grams: 30 },
        ],
      },
    ],
  },
  {
    meals: [
      {
        slot: 'breakfast',
        recipe: 'cilbir',
        extras: [
          { food: 'bread_whole', grams: 60 },
          { food: 'tomato', grams: 120 },
        ],
      },
      { slot: 'lunch', recipe: 'quinoa_salad' },
      { slot: 'snack', recipe: 'roasted_chickpeas', extras: [{ food: 'orange', grams: 150 }] },
      { slot: 'dinner', recipe: 'chicken_saute', extras: [{ food: 'bulgur', grams: 60 }] },
    ],
  },
  {
    meals: [
      { slot: 'breakfast', recipe: 'overnight_oats' },
      {
        slot: 'lunch',
        recipe: 'green_beans',
        extras: [
          { food: 'bread_whole', grams: 60 },
          { food: 'yogurt', grams: 150 },
        ],
      },
      { slot: 'snack', recipe: 'apple_yogurt' },
      { slot: 'dinner', recipe: 'tuna_piyaz', extras: [{ food: 'bread_whole', grams: 30 }] },
    ],
  },
];
