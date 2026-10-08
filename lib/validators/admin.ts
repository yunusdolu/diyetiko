import { z } from 'zod';
import { locales } from '@/lib/i18n/config';

/** Admin input schemas. Empty strings from forms become null. */
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optText = (max: number) => z.preprocess(blank, z.string().trim().max(max).nullable());
const optNum = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().min(min).max(max).nullable(),
  );
const optDate = z.preprocess(blank, z.iso.date().nullable());

export const clientInput = z.object({
  full_name: z.string().trim().min(1).max(160),
  email: z.preprocess(blank, z.email().max(254).nullable()),
  phone: z.preprocess(
    blank,
    z
      .string()
      .trim()
      .max(32)
      .regex(/^\+?[0-9 ()-]{7,20}$/)
      .nullable(),
  ),
  birth_date: optDate,
  sex: z.preprocess(blank, z.enum(['female', 'male', 'other']).nullable()),
  height_cm: optNum(50, 260),
  goal: optText(2000),
  goal_weight_kg: optNum(20, 400),
  activity_level: z.preprocess(
    blank,
    z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).nullable(),
  ),
  allergies: optText(2000),
  medical_notes: optText(10000),
  preferred_language: z.enum(locales),
  status: z.enum(['active', 'paused', 'completed', 'archived']),
  tags: z.preprocess(
    (v) =>
      typeof v === 'string'
        ? v
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        : v,
    z.array(z.string().max(40)).max(20),
  ),
  source: optText(120),
  record_consent: z
    .preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean())
    .optional(),
});
export type ClientInput = z.infer<typeof clientInput>;

export const quickClientInput = clientInput.pick({
  full_name: true,
  email: true,
  phone: true,
  preferred_language: true,
});

export const measurementInput = z.object({
  measured_at: z.iso.date(),
  weight_kg: optNum(20, 400),
  body_fat_pct: optNum(2, 75),
  muscle_kg: optNum(5, 150),
  waist_cm: optNum(30, 250),
  hip_cm: optNum(30, 250),
  chest_cm: optNum(30, 250),
  arm_cm: optNum(10, 100),
  thigh_cm: optNum(20, 150),
  note: optText(1000),
});

export const appointmentInput = z.object({
  client_id: z.preprocess(blank, z.uuid().nullable()),
  title: optText(160),
  starts_at: z.string().min(10),
  duration_min: z.coerce.number().int().min(5).max(480),
  kind: z.enum(['in_person', 'online', 'phone']),
  status: z.enum(['scheduled', 'done', 'cancelled', 'no_show']),
  note: optText(2000),
});

const itemSchema = z.object({
  id: z.string(),
  food_id: z.uuid().nullable(),
  recipe_id: z.uuid().nullable(),
  name: z.string().trim().min(1).max(160),
  grams: z.number().positive().max(5000).nullable(),
  unit_key: z.string().max(20).nullable(),
  unit_qty: z.number().positive().max(100).nullable(),
  servings: z.number().positive().max(20).nullable(),
  kcal: z.number().min(0).max(10000),
  protein_g: z.number().min(0).max(1000),
  carb_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(1000),
  fiber_g: z.number().min(0).max(1000),
  note: z.string().max(500).nullable(),
});

export const programTreeInput = z.object({
  title: z.string().trim().min(1).max(160),
  client_id: z.uuid().nullable(),
  is_template: z.boolean(),
  language: z.enum(locales),
  status: z.enum(['draft', 'active', 'archived']),
  starts_on: z.iso.date().nullable(),
  target_kcal: z.number().min(800).max(6000).nullable(),
  target_protein_g: z.number().min(0).max(500).nullable(),
  target_carb_g: z.number().min(0).max(900).nullable(),
  target_fat_g: z.number().min(0).max(400).nullable(),
  notes: z.string().max(4000).nullable(),
  hydration: z.string().max(2000).nullable(),
  days: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().max(60).nullable(),
        meals: z
          .array(
            z.object({
              id: z.string(),
              slot: z.enum(['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'snack_late']),
              time_label: z.string().max(20).nullable(),
              note: z.string().max(500).nullable(),
              items: z.array(itemSchema).max(40),
            }),
          )
          .max(8),
      }),
    )
    .min(1)
    .max(14),
});
export type ProgramTreeInput = z.infer<typeof programTreeInput>;

export const shareInput = z.object({
  programId: z.uuid(),
  expiry: z.enum(['d7', 'd30', 'd90', 'never']),
  show_client_name: z.boolean(),
  allow_pdf: z.boolean(),
});

const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const tStatus = z.enum(['draft', 'needs_review', 'reviewed']);

export const recipeInput = z.object({
  published: z.boolean(),
  illustration: z.string().max(30),
  cover_path: z.string().max(300).nullable(),
  prep_min: z.number().int().min(0).max(1440),
  cook_min: z.number().int().min(0).max(1440),
  servings: z.number().int().min(1).max(24),
  meal_types: z.array(z.enum(['breakfast', 'lunch', 'dinner', 'snack'])).max(4),
  translations: z
    .array(
      z.object({
        locale: z.enum(locales),
        slug,
        title: z.string().trim().min(1).max(160),
        summary: z.string().max(1000),
        steps: z.array(z.string().trim().min(1).max(2000)).max(40),
        tips: z.string().max(2000).nullable(),
        translation_status: tStatus,
      }),
    )
    .min(1),
  ingredients: z
    .array(
      z.object({
        food_id: z.uuid(),
        grams: z.number().positive().max(5000),
        unit_key: z.string().max(20).nullable(),
        unit_qty: z.number().positive().max(100).nullable(),
        optional: z.boolean(),
      }),
    )
    .max(40),
});
export type RecipeInput = z.infer<typeof recipeInput>;

export const articleInput = z.object({
  published: z.boolean(),
  illustration: z.string().max(30),
  cover_path: z.string().max(300).nullable(),
  category: z.enum(['basics', 'habits', 'labels', 'kitchen']),
  reading_min: z.number().int().min(1).max(60),
  sources: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        publisher: z.string().max(200),
        url: z.url().optional(),
      }),
    )
    .max(20),
  translations: z
    .array(
      z.object({
        locale: z.enum(locales),
        slug,
        title: z.string().trim().min(1).max(200),
        excerpt: z.string().max(600),
        body: z.string().max(40000),
        translation_status: tStatus,
      }),
    )
    .min(1),
});
export type ArticleInput = z.infer<typeof articleInput>;

export const foodInput = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9_]+$/)
    .max(60),
  category: z.enum([
    'grains',
    'legumes',
    'dairy_egg',
    'meat_fish',
    'vegetables',
    'fruits',
    'nuts_seeds',
    'fats',
    'other',
  ]),
  kcal: z.number().min(0).max(900),
  protein_g: z.number().min(0).max(100),
  carb_g: z.number().min(0).max(100),
  fat_g: z.number().min(0).max(100),
  fiber_g: z.number().min(0).max(100),
  flags: z.array(z.enum(['meat', 'fish', 'dairy', 'egg', 'gluten', 'honey'])),
  units: z
    .array(z.object({ key: z.string().max(20), grams: z.number().positive().max(2000) }))
    .max(10),
  review_status: z.enum(['needs_review', 'verified']),
  source: z.string().max(300).nullable(),
  names: z.object({
    tr: z.string().min(1).max(120),
    en: z.string().max(120),
    fr: z.string().max(120),
    ar: z.string().max(120),
  }),
});
export type FoodInput = z.infer<typeof foodInput>;
