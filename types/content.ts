import type { Locale } from '@/lib/i18n/config';
import type { RecipeTag } from '@/lib/nutrition/tags';

export type TranslationStatus = 'draft' | 'needs_review' | 'reviewed';

export interface RecipeSummary {
  id: string;
  slug: string;
  /** language of the text actually shown (may be a fallback) */
  contentLocale: Locale;
  title: string;
  summary: string;
  illustration: string;
  coverUrl: string | null;
  prepMin: number;
  cookMin: number;
  servings: number;
  mealTypes: string[];
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  dietFlags: string[];
  tags: RecipeTag[];
  ingredientKeys: string[];
  publishedAt: string | null;
}

export interface RecipeIngredient {
  foodKey: string;
  name: string;
  grams: number;
  unitKey: string | null;
  unitQty: number | null;
  optional: boolean;
}

export interface RecipeDetail extends RecipeSummary {
  steps: string[];
  tips: string | null;
  ingredients: RecipeIngredient[];
  /** slug per locale, only where that locale has its own visible translation */
  alternates: Partial<Record<Locale, string>>;
}

export interface ArticleSource {
  title: string;
  publisher: string;
  url?: string;
}

export interface ArticleSummary {
  id: string;
  slug: string;
  contentLocale: Locale;
  title: string;
  excerpt: string;
  illustration: string;
  coverUrl: string | null;
  category: string;
  readingMin: number;
  publishedAt: string | null;
}

export interface ArticleDetail extends ArticleSummary {
  body: string;
  sources: ArticleSource[];
  alternates: Partial<Record<Locale, string>>;
  updatedAt: string;
}

export interface FridgeFood {
  key: string;
  name: string;
  category: string;
}

export interface SiteSettings {
  contact: {
    phoneE164: string;
    phoneDisplay: string;
    whatsapp: string;
    instagram: string;
    email: string | null;
    address: string | null;
  };
  images: { portrait: string | null; logo: string | null; og: string | null };
  arabicDigits: 'latn' | 'arab';
  hero: { lines: string[] | null; lead: string | null };
  about: { bio: string | null };
  credentials: { items: string[] | null };
  faq: { items: { q: string; a: string }[] | null };
}

export interface WeekDay {
  meals: {
    slot: 'breakfast' | 'lunch' | 'snack' | 'dinner';
    title: string;
    slug: string | null;
    extras: string[];
    kcal: number;
    protein: number;
    carb: number;
    fat: number;
  }[];
  total: { kcal: number; protein: number; carb: number; fat: number };
}
