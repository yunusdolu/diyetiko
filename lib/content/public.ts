import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { asAnon, pgArray } from '@/lib/db';
import { env } from '@/lib/env';
import { fallbackChain, isLocale, locales, type Locale } from '@/lib/i18n/config';
import { deriveTags } from '@/lib/nutrition/tags';
import { publicMediaUrl } from '@/lib/storage/urls';
import { exampleWeek, seedSettings } from '@/lib/content/seed/settings';
import type {
  ArticleDetail,
  ArticleSource,
  ArticleSummary,
  FridgeFood,
  RecipeDetail,
  RecipeIngredient,
  RecipeSummary,
  SiteSettings,
  WeekDay,
} from '@/types/content';

/*
 * Visibility rule (editorial, see README → Translation workflow):
 *  - tr / en: shown when translation_status is needs_review or reviewed.
 *  - ar / fr: shown only when reviewed by a native speaker; otherwise the page falls back
 *    to en → tr and says so. PREVIEW_UNREVIEWED_TRANSLATIONS=1 relaxes this for local review.
 * RLS already hides drafts and unpublished rows from anon; this narrows further.
 */
/** Data functions only accept real locales (defence in depth behind the proxy). */
function ensure(locale: string): Locale {
  if (!isLocale(locale)) notFound();
  return locale;
}

/** SQL fragment: the translation row `t` is visible for its own locale. */
const VISIBLE_SQL = `(
  (t.locale in ('ar','fr') and t.translation_status = any($VIS_STRICT::translation_status[]))
  or (t.locale in ('tr','en') and t.translation_status in ('needs_review','reviewed'))
)`;

function visibleClause(paramIndex: number): string {
  return VISIBLE_SQL.replace('$VIS_STRICT', `$${paramIndex}`);
}

function strictStatuses(): string {
  return pgArray(env.previewUnreviewed ? ['needs_review', 'reviewed'] : ['reviewed']);
}

type RecipeRow = {
  id: string;
  locale: string;
  slug: string;
  title: string;
  summary: string;
  illustration: string;
  cover_path: string | null;
  prep_min: number;
  cook_min: number;
  servings: number;
  meal_types: string[];
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  diet_flags: string[];
  published_at: string | null;
  ingredient_keys: string[];
};

function toSummary(r: RecipeRow): RecipeSummary {
  const base = {
    kcal: r.kcal,
    protein: r.protein_g,
    fiber: r.fiber_g,
    prepMin: r.prep_min,
    cookMin: r.cook_min,
    dietFlags: r.diet_flags,
  };
  return {
    id: r.id,
    slug: r.slug,
    contentLocale: isLocale(r.locale) ? r.locale : 'tr',
    title: r.title,
    summary: r.summary,
    illustration: r.illustration,
    coverUrl: publicMediaUrl('recipe-media', r.cover_path),
    prepMin: r.prep_min,
    cookMin: r.cook_min,
    servings: r.servings,
    mealTypes: r.meal_types,
    kcal: r.kcal,
    protein: r.protein_g,
    carb: r.carb_g,
    fat: r.fat_g,
    fiber: r.fiber_g,
    dietFlags: r.diet_flags,
    tags: deriveTags(base),
    ingredientKeys: r.ingredient_keys ?? [],
    publishedAt: r.published_at,
  };
}

const RECIPE_COLUMNS = `
  r.id, t.locale::text as locale, t.slug, t.title, t.summary, r.illustration, r.cover_path,
  r.prep_min, r.cook_min, r.servings, r.meal_types, r.kcal, r.protein_g, r.carb_g, r.fat_g, r.fiber_g,
  r.diet_flags, r.published_at,
  (select coalesce(array_agg(distinct f.key order by f.key), '{}')
     from recipe_ingredients ri join foods f on f.id = ri.food_id
    where ri.recipe_id = r.id and not ri.optional) as ingredient_keys`;

export const listRecipes = cache(async (locale: Locale): Promise<RecipeSummary[]> => {
  locale = ensure(locale);
  const chain = fallbackChain(locale);
  const rows = await asAnon((tx) =>
    tx.query<RecipeRow>(
      `select distinct on (r.id) ${RECIPE_COLUMNS}
         from recipes r
         join recipe_translations t on t.recipe_id = r.id
        where r.published and t.locale = any($1::locale_code[]) and ${visibleClause(2)}
        order by r.id, array_position($1::locale_code[], t.locale)`,
      [pgArray(chain), strictStatuses()],
    ),
  );
  return rows
    .map(toSummary)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
});

async function alternatesFor(
  table: 'recipe_translations' | 'article_translations',
  idColumn: 'recipe_id' | 'article_id',
  id: string,
): Promise<Partial<Record<Locale, string>>> {
  const rows = await asAnon((tx) =>
    tx.query<{ locale: string; slug: string }>(
      `select t.locale::text as locale, t.slug from ${table} t where t.${idColumn} = $1 and ${visibleClause(2)}`,
      [id, strictStatuses()],
    ),
  );
  const out: Partial<Record<Locale, string>> = {};
  for (const r of rows) if (isLocale(r.locale)) out[r.locale] = r.slug;
  return out;
}

export type Lookup<T> =
  { kind: 'found'; item: T } | { kind: 'redirect'; slug: string } | { kind: 'missing' };

export const getRecipe = cache(
  async (locale: Locale, slug: string): Promise<Lookup<RecipeDetail>> => {
    locale = ensure(locale);
    const chain = fallbackChain(locale);
    const [row] = await asAnon((tx) =>
      tx.query<RecipeRow & { steps: string[]; tips: string | null }>(
        `select ${RECIPE_COLUMNS}, t.steps, t.tips
         from recipes r
         join recipe_translations t on t.recipe_id = r.id
        where r.published and t.slug = $3 and t.locale = any($1::locale_code[]) and ${visibleClause(2)}
        order by array_position($1::locale_code[], t.locale)
        limit 1`,
        [pgArray(chain), strictStatuses(), slug],
      ),
    );

    if (!row) {
      // The slug may belong to another language (e.g. a shared link) → send to this locale's slug.
      const [other] = await asAnon((tx) =>
        tx.query<{ recipe_id: string }>(
          `select recipe_id from recipe_translations where slug = $1 limit 1`,
          [slug],
        ),
      );
      if (!other) return { kind: 'missing' };
      const list = await listRecipes(locale);
      const target = list.find((r) => r.id === other.recipe_id);
      return target ? { kind: 'redirect', slug: target.slug } : { kind: 'missing' };
    }

    // If a better (higher in the chain) translation exists under a different slug, prefer it.
    const best = (await listRecipes(locale)).find((r) => r.id === row.id);
    if (best && best.slug !== row.slug && best.contentLocale !== row.locale) {
      return { kind: 'redirect', slug: best.slug };
    }

    const ingredients = await asAnon((tx) =>
      tx.query<{
        key: string;
        name: string;
        grams: number;
        unit_key: string | null;
        unit_qty: number | null;
        optional: boolean;
      }>(
        `select f.key, coalesce(
                (select ft.name from food_translations ft
                  where ft.food_id = f.id and ft.locale = any($2::locale_code[])
                    and (ft.locale in ('tr','en') or ft.translation_status = any($3::translation_status[]))
                  order by array_position($2::locale_code[], ft.locale) limit 1), f.key) as name,
              ri.grams, ri.unit_key, ri.unit_qty, ri.optional
         from recipe_ingredients ri join foods f on f.id = ri.food_id
        where ri.recipe_id = $1
        order by ri.position`,
        [row.id, pgArray(chain), strictStatuses()],
      ),
    );

    const detail: RecipeDetail = {
      ...toSummary(row),
      steps: Array.isArray(row.steps) ? row.steps.map(String) : [],
      tips: row.tips,
      ingredients: ingredients.map<RecipeIngredient>((i) => ({
        foodKey: i.key,
        name: i.name,
        grams: i.grams,
        unitKey: i.unit_key,
        unitQty: i.unit_qty,
        optional: i.optional,
      })),
      alternates: await alternatesFor('recipe_translations', 'recipe_id', row.id),
    };
    return { kind: 'found', item: detail };
  },
);

/** Ingredients (foods) used by published recipes, localized — for the fridge finder. */
export const listFridgeFoods = cache(async (locale: Locale): Promise<FridgeFood[]> => {
  locale = ensure(locale);
  const chain = fallbackChain(locale);
  const rows = await asAnon((tx) =>
    tx.query<{ key: string; category: string; name: string }>(
      `select distinct on (f.id) f.key, f.category, ft.name
         from foods f join food_translations ft on ft.food_id = f.id
        where ft.locale = any($1::locale_code[])
          and (ft.locale in ('tr','en') or ft.translation_status = any($2::translation_status[]))
        order by f.id, array_position($1::locale_code[], ft.locale)`,
      [pgArray(chain), strictStatuses()],
    ),
  );
  return rows.map((r) => ({ key: r.key, name: r.name, category: r.category }));
});

/** Ingredient lines for several recipes (shopping list), localized. */
export const recipeIngredientMap = cache(
  async (locale: Locale): Promise<Record<string, RecipeIngredient[]>> => {
    locale = ensure(locale);
    const chain = fallbackChain(locale);
    const rows = await asAnon((tx) =>
      tx.query<{
        recipe_id: string;
        key: string;
        name: string;
        grams: number;
        unit_key: string | null;
        unit_qty: number | null;
        optional: boolean;
      }>(
        `select ri.recipe_id, f.key,
              coalesce((select ft.name from food_translations ft
                         where ft.food_id = f.id and ft.locale = any($1::locale_code[])
                           and (ft.locale in ('tr','en') or ft.translation_status = any($2::translation_status[]))
                         order by array_position($1::locale_code[], ft.locale) limit 1), f.key) as name,
              ri.grams, ri.unit_key, ri.unit_qty, ri.optional
         from recipe_ingredients ri join foods f on f.id = ri.food_id
        order by ri.recipe_id, ri.position`,
        [pgArray(chain), strictStatuses()],
      ),
    );
    const map: Record<string, RecipeIngredient[]> = {};
    for (const r of rows) {
      (map[r.recipe_id] ??= []).push({
        foodKey: r.key,
        name: r.name,
        grams: r.grams,
        unitKey: r.unit_key,
        unitQty: r.unit_qty,
        optional: r.optional,
      });
    }
    return map;
  },
);

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------
type ArticleRow = {
  id: string;
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  illustration: string;
  cover_path: string | null;
  category: string;
  reading_min: number;
  published_at: string | null;
};

function toArticleSummary(r: ArticleRow): ArticleSummary {
  return {
    id: r.id,
    slug: r.slug,
    contentLocale: isLocale(r.locale) ? r.locale : 'tr',
    title: r.title,
    excerpt: r.excerpt,
    illustration: r.illustration,
    coverUrl: publicMediaUrl('recipe-media', r.cover_path),
    category: r.category,
    readingMin: r.reading_min,
    publishedAt: r.published_at,
  };
}

const ARTICLE_COLUMNS = `a.id, t.locale::text as locale, t.slug, t.title, t.excerpt, a.illustration, a.cover_path,
  a.category, a.reading_min, a.published_at`;

export const listArticles = cache(async (locale: Locale): Promise<ArticleSummary[]> => {
  locale = ensure(locale);
  const chain = fallbackChain(locale);
  const rows = await asAnon((tx) =>
    tx.query<ArticleRow>(
      `select distinct on (a.id) ${ARTICLE_COLUMNS}
         from articles a join article_translations t on t.article_id = a.id
        where a.published and t.locale = any($1::locale_code[]) and ${visibleClause(2)}
        order by a.id, array_position($1::locale_code[], t.locale)`,
      [pgArray(chain), strictStatuses()],
    ),
  );
  return rows
    .map(toArticleSummary)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
});

export const getArticle = cache(
  async (locale: Locale, slug: string): Promise<Lookup<ArticleDetail>> => {
    locale = ensure(locale);
    const chain = fallbackChain(locale);
    const [row] = await asAnon((tx) =>
      tx.query<ArticleRow & { body: string; sources: ArticleSource[]; updated_at: string }>(
        `select ${ARTICLE_COLUMNS}, t.body, a.sources, greatest(a.updated_at, t.updated_at) as updated_at
         from articles a join article_translations t on t.article_id = a.id
        where a.published and t.slug = $3 and t.locale = any($1::locale_code[]) and ${visibleClause(2)}
        order by array_position($1::locale_code[], t.locale)
        limit 1`,
        [pgArray(chain), strictStatuses(), slug],
      ),
    );
    if (!row) {
      const [other] = await asAnon((tx) =>
        tx.query<{ article_id: string }>(
          `select article_id from article_translations where slug = $1 limit 1`,
          [slug],
        ),
      );
      if (!other) return { kind: 'missing' };
      const target = (await listArticles(locale)).find((a) => a.id === other.article_id);
      return target ? { kind: 'redirect', slug: target.slug } : { kind: 'missing' };
    }
    const best = (await listArticles(locale)).find((a) => a.id === row.id);
    if (best && best.slug !== row.slug && best.contentLocale !== row.locale)
      return { kind: 'redirect', slug: best.slug };
    return {
      kind: 'found',
      item: {
        ...toArticleSummary(row),
        body: row.body,
        sources: Array.isArray(row.sources) ? row.sources : [],
        updatedAt: row.updated_at,
        alternates: await alternatesFor('article_translations', 'article_id', row.id),
      },
    };
  },
);

// ---------------------------------------------------------------------------
// Site settings (DB overrides; message files hold the defaults)
// ---------------------------------------------------------------------------
type Json = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

export const getSiteSettings = cache(async (locale: Locale): Promise<SiteSettings> => {
  locale = ensure(locale);
  const chain = fallbackChain(locale);
  const [base, localized] = await asAnon(async (tx) => {
    const b = await tx.query<{ key: string; data: Json }>(
      `select key, data from site_settings where is_public`,
    );
    const l = await tx.query<{ key: string; locale: string; data: Json }>(
      `select key, locale::text as locale, data from site_setting_translations t
        where t.locale = any($1::locale_code[])
          and (t.locale in ('tr','en') and t.translation_status <> 'draft'
               or t.translation_status = any($2::translation_status[]))`,
      [pgArray(chain), strictStatuses()],
    );
    return [b, l] as const;
  });

  const get = (key: string): Json => base.find((r) => r.key === key)?.data ?? {};
  const loc = (key: string): Json => {
    for (const l of chain) {
      const hit = localized.find((r) => r.key === key && r.locale === l);
      if (hit) return hit.data;
    }
    return {};
  };

  const contact = { ...seedSettings.contact, ...get('contact') } as SiteSettings['contact'];
  const images = { ...seedSettings.images, ...get('images') } as SiteSettings['images'];
  const numbers = get('numbers');
  const hero = loc('hero');
  const about = loc('about');
  const credentials = loc('credentials');
  const faq = loc('faq');

  const lines = Array.isArray(hero.lines)
    ? hero.lines.filter((x): x is string => typeof x === 'string')
    : null;
  const credItems = Array.isArray(credentials.items)
    ? credentials.items.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : null;
  const faqItems = Array.isArray(faq.items)
    ? faq.items.filter(
        (x): x is { q: string; a: string } =>
          typeof x === 'object' &&
          x !== null &&
          typeof (x as Json).q === 'string' &&
          typeof (x as Json).a === 'string',
      )
    : null;

  return {
    contact,
    images: {
      portrait: publicMediaUrl('site-media', images.portrait),
      logo: publicMediaUrl('site-media', images.logo),
      og: publicMediaUrl('site-media', images.og),
    },
    arabicDigits: numbers.arabicDigits === 'arab' ? 'arab' : 'latn',
    hero: { lines: lines && lines.length ? lines : null, lead: str(hero.lead) },
    about: { bio: str(about.bio) },
    credentials: { items: credItems && credItems.length ? credItems : null },
    faq: { items: faqItems && faqItems.length ? faqItems : null },
  };
});

/** Example week for the home page, computed from real recipe data. */
export const getExampleWeek = cache(async (locale: Locale): Promise<WeekDay[]> => {
  locale = ensure(locale);
  const [recipes, foods] = await Promise.all([listRecipes(locale), listFoodsForWeek(locale)]);
  const keyToRecipe = await recipeKeyMap();
  return exampleWeek.map((day) => {
    const meals = day.meals.map((m) => {
      const id = keyToRecipe[m.recipe];
      const r = recipes.find((x) => x.id === id);
      let kcal = r?.kcal ?? 0;
      let protein = r?.protein ?? 0;
      let carb = r?.carb ?? 0;
      let fat = r?.fat ?? 0;
      const extras: string[] = [];
      for (const e of m.extras ?? []) {
        const f = foods[e.food];
        if (!f) continue;
        kcal += (f.kcal * e.grams) / 100;
        protein += (f.protein * e.grams) / 100;
        carb += (f.carb * e.grams) / 100;
        fat += (f.fat * e.grams) / 100;
        extras.push(f.name);
      }
      return {
        slot: m.slot,
        title: r?.title ?? m.recipe,
        slug: r?.slug ?? null,
        extras,
        kcal,
        protein,
        carb,
        fat,
      };
    });
    const total = meals.reduce(
      (a, m) => ({
        kcal: a.kcal + m.kcal,
        protein: a.protein + m.protein,
        carb: a.carb + m.carb,
        fat: a.fat + m.fat,
      }),
      { kcal: 0, protein: 0, carb: 0, fat: 0 },
    );
    return { meals, total };
  });
});

/** Seed recipe keys → ids. Seed ids are deterministic, so we can recompute them from the key. */
const recipeKeyMap = cache(async (): Promise<Record<string, string>> => {
  const { seedRecipeId } = await import('@/lib/content/seed/ids');
  const out: Record<string, string> = {};
  for (const d of exampleWeek) for (const m of d.meals) out[m.recipe] = seedRecipeId(m.recipe);
  return out;
});

const listFoodsForWeek = cache(
  async (
    locale: Locale,
  ): Promise<
    Record<string, { name: string; kcal: number; protein: number; carb: number; fat: number }>
  > => {
    const keys = [
      ...new Set(
        exampleWeek.flatMap((d) => d.meals.flatMap((m) => (m.extras ?? []).map((e) => e.food))),
      ),
    ];
    const chain = fallbackChain(locale);
    // Extras are basic foods; they are read as the public projection of the seed values.
    const { seedFoods } = await import('@/lib/content/seed/foods');
    const names = await listFridgeFoods(locale);
    const out: Record<
      string,
      { name: string; kcal: number; protein: number; carb: number; fat: number }
    > = {};
    for (const k of keys) {
      const f = seedFoods.find((x) => x.key === k);
      if (!f) continue;
      const localized = names.find((n) => n.key === k)?.name;
      const own = chain.map((l) => f.names[l]).find(Boolean);
      out[k] = { name: localized ?? own ?? k, kcal: f.kcal, protein: f.p, carb: f.c, fat: f.f };
    }
    return out;
  },
);

export function allLocales(): readonly Locale[] {
  return locales;
}
