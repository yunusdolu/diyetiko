import type { Locale } from '@/lib/i18n/config';

export type ClientStatus = 'active' | 'paused' | 'completed' | 'archived';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface ClientRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  sex: 'female' | 'male' | 'other' | null;
  height_cm: number | null;
  goal: string | null;
  goal_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  allergies: string | null;
  medical_notes: string | null;
  preferred_language: Locale;
  status: ClientStatus;
  tags: string[];
  source: string | null;
  kvkk_consent_at: string | null;
  kvkk_consent_version: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientListItem extends Pick<
  ClientRow,
  | 'id'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'status'
  | 'tags'
  | 'preferred_language'
  | 'goal'
  | 'goal_weight_kg'
  | 'deleted_at'
  | 'created_at'
  | 'kvkk_consent_at'
> {
  last_measured_at: string | null;
  last_weight: number | null;
  first_weight: number | null;
  next_appointment: string | null;
  /** last eight weights, oldest first */
  weights: number[];
  on_portal: boolean;
  /** client messages not yet read */
  unread: number;
}

export interface Measurement {
  id: string;
  client_id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  note: string | null;
}

export interface ClientNote {
  id: string;
  body: string;
  pinned: boolean;
  created_at: string;
}

export interface ClientFile {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string | null;
  client_name: string | null;
  lead_id: string | null;
  title: string | null;
  starts_at: string;
  duration_min: number;
  kind: 'in_person' | 'online' | 'phone';
  status: 'scheduled' | 'done' | 'cancelled' | 'no_show';
  note: string | null;
}

export interface Lead {
  id: string;
  kind: 'contact' | 'wizard' | 'professional' | 'application';
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  locale: Locale;
  consent_at: string;
  consent_version: string;
  status: 'new' | 'contacted' | 'converted' | 'archived';
  converted_client_id: string | null;
  created_at: string;
}

export type MealSlot = 'breakfast' | 'snack_am' | 'lunch' | 'snack_pm' | 'dinner' | 'snack_late';

export interface ProgramItem {
  id: string;
  food_id: string | null;
  recipe_id: string | null;
  name: string;
  grams: number | null;
  unit_key: string | null;
  unit_qty: number | null;
  servings: number | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  note: string | null;
}

export interface ProgramMeal {
  id: string;
  slot: MealSlot;
  time_label: string | null;
  note: string | null;
  items: ProgramItem[];
}

export interface ProgramDay {
  id: string;
  label: string | null;
  meals: ProgramMeal[];
}

export interface ProgramMeta {
  id: string;
  client_id: string | null;
  client_name: string | null;
  is_template: boolean;
  title: string;
  language: Locale;
  status: 'draft' | 'active' | 'archived';
  starts_on: string | null;
  target_kcal: number | null;
  target_protein_g: number | null;
  target_carb_g: number | null;
  target_fat_g: number | null;
  notes: string | null;
  hydration: string | null;
  updated_at: string;
}

export interface ProgramTree extends ProgramMeta {
  days: ProgramDay[];
}

export interface ShareLink {
  id: string;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  show_client_name: boolean;
  allow_pdf: boolean;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

export interface FoodOption {
  id: string;
  key: string;
  name: string;
  category: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  units: { key: string; grams: number }[];
  review_status: 'needs_review' | 'verified';
}

export interface RecipeOption {
  id: string;
  title: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  illustration: string;
}
