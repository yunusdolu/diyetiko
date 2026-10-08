import type { Locale } from '@/lib/i18n/config';

export type MealSlot = 'breakfast' | 'snack_am' | 'lunch' | 'snack_pm' | 'dinner' | 'snack_late';
export const MEAL_SLOTS: MealSlot[] = [
  'breakfast',
  'snack_am',
  'lunch',
  'snack_pm',
  'dinner',
  'snack_late',
];

export interface PortalProfile {
  fullName: string;
  firstName: string;
  email: string | null;
  locale: Locale;
  heightCm: number | null;
  goal: string | null;
  goalWeightKg: number | null;
  dietitianName: string | null;
}

export interface ProgramItem {
  name: string;
  grams: number | null;
  unitKey: string | null;
  unitQty: number | null;
  servings: number | null;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  note: string | null;
  foodId?: string | null;
  recipeId?: string | null;
}
export interface ProgramMeal {
  slot: MealSlot;
  time: string | null;
  note: string | null;
  items: ProgramItem[];
}
export interface ProgramDay {
  position: number;
  label: string | null;
  meals: ProgramMeal[];
}
export interface PortalProgram {
  id: string;
  title: string;
  language: Locale;
  startsOn: string | null;
  updatedAt: string;
  notes: string | null;
  hydration: string | null;
  targets: { kcal: number | null; protein: number | null; carb: number | null; fat: number | null };
  days: ProgramDay[];
}

export interface Habit {
  id: string;
  label: string;
}

export interface Checkin {
  day: string;
  weight_kg: number | null;
  water_ml: number | null;
  habits: string[];
  energy: number | null;
  note: string | null;
  /** minutes of movement that day, and what it was ("yürüyüş") */
  activity_min: number | null;
  activity_note: string | null;
}

export interface DiaryItem {
  id: string;
  name: string;
  food_id: string | null;
  recipe_id: string | null;
  grams: number | null;
  unit_key: string | null;
  unit_qty: number | null;
  servings: number | null;
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
}
export interface DiaryMeal {
  id: string;
  eaten_on: string;
  slot: MealSlot;
  time_label: string | null;
  note: string | null;
  /** Changes whenever the photo changes (cache-busting key for the image URL); null = no photo. */
  photo_key: string | null;
  items: DiaryItem[];
}

export interface Message {
  id: string;
  author: 'client' | 'dietitian';
  body: string;
  diary_meal_id: string | null;
  meal_slot: MealSlot | null;
  meal_day: string | null;
  read_at: string | null;
  created_at: string;
  /** a file sent with the message (served by an auth-checked route, by message id) */
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
}

export interface FoodOption {
  id: string;
  key: string;
  category: string;
  name: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  units: { key: string; grams: number }[];
}

export interface Measurement {
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

export interface Appointment {
  startsAt: string;
  durationMin: number;
  kind: 'in_person' | 'online' | 'phone';
  status: 'scheduled' | 'done' | 'cancelled' | 'no_show';
}

export interface Totals {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  /** items without nutrition values (free text) */
  unknown: number;
}

/** A task the dietitian shared with the client; the client ticks it. */
export interface PortalTask {
  id: string;
  title: string;
  dueOn: string | null;
  doneAt: string | null;
}

/** The client's own packages and payments, as the dietitian recorded them. */
export interface PortalBilling {
  packages: {
    id: string;
    name: string;
    sessionsTotal: number | null;
    startsOn: string;
    endsOn: string | null;
    price: number | null;
    currency: 'TRY' | 'EUR' | 'USD';
    closed: boolean;
    paid: number;
    used: number;
  }[];
  payments: {
    id: string;
    amount: number;
    currency: 'TRY' | 'EUR' | 'USD';
    paidOn: string;
    method: 'transfer' | 'card' | 'cash' | 'other';
    packageId: string | null;
  }[];
}
