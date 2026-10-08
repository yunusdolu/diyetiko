import 'server-only';
import { cache } from 'react';
import { asAnon } from '@/lib/db';
import type { Locale } from '@/lib/i18n/config';
import type { MealSlot } from '@/types/admin';

/** Exactly what get_shared_program() returns — nothing else about the client ever leaves the DB. */
export interface SharedProgram {
  title: string;
  language: Locale;
  startsOn: string | null;
  updatedAt: string;
  expiresAt: string | null;
  allowPdf: boolean;
  clientFirstName: string | null;
  notes: string | null;
  hydration: string | null;
  targets: { kcal: number | null; protein: number | null; carb: number | null; fat: number | null };
  days: {
    position: number;
    label: string | null;
    meals: {
      slot: MealSlot;
      time: string | null;
      note: string | null;
      items: {
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
      }[];
    }[];
  }[];
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{43,128}$/;

/** Resolved once per request (layout + page share it); counts one view. */
export const resolveShare = cache(async (token: string): Promise<SharedProgram | null> => {
  if (!TOKEN_RE.test(token)) return null;
  const [row] = await asAnon((tx) =>
    tx.query<{ dto: SharedProgram | null }>(`select public.get_shared_program($1, true) as dto`, [
      token,
    ]),
  );
  return row?.dto ?? null;
});
