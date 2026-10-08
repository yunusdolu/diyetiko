import { z } from 'zod';
import { MEAL_SLOTS } from '@/types/portal';

export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const mealSlot = z
  .enum(MEAL_SLOTS as [string, ...string[]])
  .transform((v) => v as (typeof MEAL_SLOTS)[number]);
const uuid = z.uuid();

export const password = z.string().min(10).max(200);

export const checkinPatch = z
  .object({
    weight_kg: z.number().min(20).max(400).nullable().optional(),
    water_ml: z.number().int().min(0).max(10000).nullable().optional(),
    habits: z.array(uuid).max(30).optional(),
    energy: z.number().int().min(1).max(5).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
    activity_min: z.number().int().min(0).max(600).nullable().optional(),
    activity_note: z.string().trim().max(200).nullable().optional(),
  })
  .strict()
  .refine((p) => Object.keys(p).length > 0);

export const diaryItem = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('food'),
    foodId: uuid,
    name: z.string().trim().min(1).max(160),
    unitKey: z.string().max(32).nullable(),
    unitQty: z.number().positive().max(100).nullable(),
    grams: z.number().positive().max(5000).nullable(),
  }),
  z.object({
    kind: z.literal('recipe'),
    recipeId: uuid,
    name: z.string().trim().min(1).max(160),
    servings: z.number().positive().max(20),
  }),
  z.object({ kind: z.literal('free'), name: z.string().trim().min(1).max(160) }),
]);

export const diaryAdd = z.object({
  day: isoDay,
  slot: mealSlot,
  items: z.array(diaryItem).min(1).max(30),
});

export const mealPatch = z.object({
  day: isoDay,
  slot: mealSlot,
  note: z.string().trim().max(1000).nullable().optional(),
  time_label: z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
    .nullable()
    .optional(),
});

export const messageInput = z.object({
  body: z.string().trim().min(1).max(2000),
  diaryMealId: uuid.nullable(),
});
