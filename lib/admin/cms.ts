import 'server-only';
import { asUser, json, pgArray } from '@/lib/db';
import type { Locale } from '@/lib/i18n/config';
import type { ArticleInput, FoodInput, RecipeInput } from '@/lib/validators/admin';

export interface CmsListItem {
  id: string;
  published: boolean;
  illustration: string;
  title: string;
  statuses: { locale: Locale; status: 'draft' | 'needs_review' | 'reviewed' }[];
  kcal?: number;
  updated_at: string;
}

export async function listRecipesAdmin(uid: string): Promise<CmsListItem[]> {
  return asUser(uid, (tx) =>
    tx.query<CmsListItem>(
      `select r.id, r.published, r.illustration, r.kcal, r.updated_at,
              coalesce((select t.title from recipe_translations t where t.recipe_id = r.id order by t.locale = 'tr' desc limit 1), '—') as title,
              coalesce((select json_agg(json_build_object('locale', t.locale, 'status', t.translation_status) order by t.locale) from recipe_translations t where t.recipe_id = r.id), '[]'::json) as statuses
         from recipes r order by r.updated_at desc`,
    ),
  );
}

export interface RecipeEdit extends RecipeInput {
  id: string;
}

export async function getRecipeAdmin(uid: string, id: string): Promise<RecipeEdit | null> {
  return asUser(uid, async (tx) => {
    const [r] = await tx.query<Omit<RecipeEdit, 'translations' | 'ingredients'>>(
      `select id, published, illustration, cover_path, prep_min, cook_min, servings, meal_types from recipes where id = $1`,
      [id],
    );
    if (!r) return null;
    const translations = await tx.query<RecipeEdit['translations'][number]>(
      `select locale::text as locale, slug, title, summary, steps, tips, translation_status::text as translation_status from recipe_translations where recipe_id = $1`,
      [id],
    );
    const ingredients = await tx.query<RecipeEdit['ingredients'][number]>(
      `select food_id, grams, unit_key, unit_qty, optional from recipe_ingredients where recipe_id = $1 order by position`,
      [id],
    );
    return { ...r, translations, ingredients } as RecipeEdit;
  });
}

export async function saveRecipe(uid: string, id: string | null, d: RecipeInput): Promise<string> {
  return asUser(uid, async (tx) => {
    let rid = id;
    if (rid) {
      await tx.query(
        `update recipes set published=$2, published_at = case when $2 and published_at is null then now() when not $2 then null else published_at end,
                illustration=$3, cover_path=$4, prep_min=$5, cook_min=$6, servings=$7, meal_types=$8::text[] where id=$1`,
        [
          rid,
          d.published,
          d.illustration,
          d.cover_path,
          d.prep_min,
          d.cook_min,
          d.servings,
          pgArray(d.meal_types),
        ],
      );
    } else {
      const [row] = await tx.query<{ id: string }>(
        `insert into recipes (published, published_at, illustration, cover_path, prep_min, cook_min, servings, meal_types)
         values ($1, case when $1 then now() end, $2, $3, $4, $5, $6, $7::text[]) returning id`,
        [
          d.published,
          d.illustration,
          d.cover_path,
          d.prep_min,
          d.cook_min,
          d.servings,
          pgArray(d.meal_types),
        ],
      );
      rid = row!.id;
    }
    await tx.query(
      `delete from recipe_translations where recipe_id = $1 and locale::text <> all($2::text[])`,
      [rid, pgArray(d.translations.map((t) => t.locale))],
    );
    for (const t of d.translations) {
      await tx.query(
        `insert into recipe_translations (recipe_id, locale, slug, title, summary, steps, tips, translation_status)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
         on conflict (recipe_id, locale) do update set slug=excluded.slug, title=excluded.title, summary=excluded.summary, steps=excluded.steps,
           tips=excluded.tips, translation_status=excluded.translation_status`,
        [rid, t.locale, t.slug, t.title, t.summary, json(t.steps), t.tips, t.translation_status],
      );
    }
    await tx.query(`delete from recipe_ingredients where recipe_id = $1`, [rid]);
    for (const [i, ing] of d.ingredients.entries()) {
      await tx.query(
        `insert into recipe_ingredients (recipe_id, food_id, grams, unit_key, unit_qty, optional, position) values ($1,$2,$3,$4,$5,$6,$7)`,
        [rid, ing.food_id, ing.grams, ing.unit_key, ing.unit_qty, ing.optional, i],
      );
    }
    return rid!;
  });
}

export async function deleteRecipe(uid: string, id: string) {
  await asUser(uid, (tx) => tx.query(`delete from recipes where id = $1`, [id]));
}

export async function listArticlesAdmin(uid: string): Promise<CmsListItem[]> {
  return asUser(uid, (tx) =>
    tx.query<CmsListItem>(
      `select a.id, a.published, a.illustration, a.updated_at,
              coalesce((select t.title from article_translations t where t.article_id = a.id order by t.locale = 'tr' desc limit 1), '—') as title,
              coalesce((select json_agg(json_build_object('locale', t.locale, 'status', t.translation_status) order by t.locale) from article_translations t where t.article_id = a.id), '[]'::json) as statuses
         from articles a order by a.updated_at desc`,
    ),
  );
}

export interface ArticleEdit extends ArticleInput {
  id: string;
}

export async function getArticleAdmin(uid: string, id: string): Promise<ArticleEdit | null> {
  return asUser(uid, async (tx) => {
    const [a] = await tx.query<Omit<ArticleEdit, 'translations'>>(
      `select id, published, illustration, cover_path, category, reading_min, sources from articles where id = $1`,
      [id],
    );
    if (!a) return null;
    const translations = await tx.query<ArticleEdit['translations'][number]>(
      `select locale::text as locale, slug, title, excerpt, body, translation_status::text as translation_status from article_translations where article_id = $1`,
      [id],
    );
    return { ...a, translations } as ArticleEdit;
  });
}

export async function saveArticle(
  uid: string,
  id: string | null,
  d: ArticleInput,
): Promise<string> {
  return asUser(uid, async (tx) => {
    let aid = id;
    if (aid) {
      await tx.query(
        `update articles set published=$2, published_at = case when $2 and published_at is null then now() when not $2 then null else published_at end,
                illustration=$3, cover_path=$4, category=$5, reading_min=$6, sources=$7::jsonb where id=$1`,
        [
          aid,
          d.published,
          d.illustration,
          d.cover_path,
          d.category,
          d.reading_min,
          json(d.sources),
        ],
      );
    } else {
      const [row] = await tx.query<{ id: string }>(
        `insert into articles (published, published_at, illustration, cover_path, category, reading_min, sources)
         values ($1, case when $1 then now() end, $2, $3, $4, $5, $6::jsonb) returning id`,
        [d.published, d.illustration, d.cover_path, d.category, d.reading_min, json(d.sources)],
      );
      aid = row!.id;
    }
    await tx.query(
      `delete from article_translations where article_id = $1 and locale::text <> all($2::text[])`,
      [aid, pgArray(d.translations.map((t) => t.locale))],
    );
    for (const t of d.translations) {
      await tx.query(
        `insert into article_translations (article_id, locale, slug, title, excerpt, body, translation_status) values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (article_id, locale) do update set slug=excluded.slug, title=excluded.title, excerpt=excluded.excerpt, body=excluded.body,
           translation_status=excluded.translation_status`,
        [aid, t.locale, t.slug, t.title, t.excerpt, t.body, t.translation_status],
      );
    }
    return aid!;
  });
}

export async function deleteArticle(uid: string, id: string) {
  await asUser(uid, (tx) => tx.query(`delete from articles where id = $1`, [id]));
}

export interface FoodEdit extends FoodInput {
  id: string;
  used: number;
}

export async function listFoodsAdmin(uid: string): Promise<FoodEdit[]> {
  return asUser(uid, (tx) =>
    tx.query<FoodEdit>(
      `select f.id, f.key, f.category, f.kcal, f.protein_g, f.carb_g, f.fat_g, f.fiber_g, f.flags, f.units, f.review_status::text as review_status, f.source,
              (select count(*)::int from recipe_ingredients ri where ri.food_id = f.id) as used,
              json_build_object(
                'tr', coalesce((select name from food_translations where food_id = f.id and locale = 'tr'), ''),
                'en', coalesce((select name from food_translations where food_id = f.id and locale = 'en'), ''),
                'fr', coalesce((select name from food_translations where food_id = f.id and locale = 'fr'), ''),
                'ar', coalesce((select name from food_translations where food_id = f.id and locale = 'ar'), '')) as names
         from foods f order by f.category, f.key`,
    ),
  );
}

export async function saveFood(uid: string, id: string | null, d: FoodInput): Promise<string> {
  return asUser(uid, async (tx) => {
    let fid = id;
    if (fid) {
      await tx.query(
        `update foods set key=$2, category=$3, kcal=$4, protein_g=$5, carb_g=$6, fat_g=$7, fiber_g=$8, flags=$9::text[], units=$10::jsonb, review_status=$11, source=$12 where id=$1`,
        [
          fid,
          d.key,
          d.category,
          d.kcal,
          d.protein_g,
          d.carb_g,
          d.fat_g,
          d.fiber_g,
          pgArray(d.flags),
          json(d.units),
          d.review_status,
          d.source,
        ],
      );
    } else {
      const [row] = await tx.query<{ id: string }>(
        `insert into foods (key, category, kcal, protein_g, carb_g, fat_g, fiber_g, flags, units, review_status, source)
         values ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9::jsonb,$10,$11) returning id`,
        [
          d.key,
          d.category,
          d.kcal,
          d.protein_g,
          d.carb_g,
          d.fat_g,
          d.fiber_g,
          pgArray(d.flags),
          json(d.units),
          d.review_status,
          d.source,
        ],
      );
      fid = row!.id;
    }
    for (const [locale, name] of Object.entries(d.names)) {
      if (!name.trim()) {
        await tx.query(`delete from food_translations where food_id = $1 and locale = $2`, [
          fid,
          locale,
        ]);
        continue;
      }
      await tx.query(
        `insert into food_translations (food_id, locale, name, translation_status) values ($1, $2, $3, $4)
         on conflict (food_id, locale) do update set name = excluded.name`,
        [fid, locale, name.trim(), locale === 'tr' ? 'reviewed' : 'needs_review'],
      );
    }
    return fid!;
  });
}

export async function deleteFood(uid: string, id: string): Promise<boolean> {
  return asUser(uid, async (tx) => {
    const [used] = await tx.query<{ n: number }>(
      `select count(*)::int as n from recipe_ingredients where food_id = $1`,
      [id],
    );
    if ((used?.n ?? 0) > 0) return false;
    await tx.query(`delete from foods where id = $1`, [id]);
    return true;
  });
}

// --------------------------------------------------------------------------- settings
export type SettingsBundle = {
  base: Record<string, Record<string, unknown>>;
  localized: Record<
    string,
    Partial<Record<Locale, { data: Record<string, unknown>; status: string }>>
  >;
  profile: { full_name: string; admin_locale: Locale; arabic_digits: 'latn' | 'arab' };
};

export async function getSettings(uid: string): Promise<SettingsBundle> {
  return asUser(uid, async (tx) => {
    const base = await tx.query<{ key: string; data: Record<string, unknown> }>(
      `select key, data from site_settings`,
    );
    const loc = await tx.query<{
      key: string;
      locale: Locale;
      data: Record<string, unknown>;
      translation_status: string;
    }>(
      `select key, locale::text as locale, data, translation_status::text as translation_status from site_setting_translations`,
    );
    const [profile] = await tx.query<SettingsBundle['profile']>(
      `select full_name, admin_locale::text as admin_locale, arabic_digits from profiles where id = $1`,
      [uid],
    );
    const localized: SettingsBundle['localized'] = {};
    for (const r of loc)
      (localized[r.key] ??= {})[r.locale] = { data: r.data, status: r.translation_status };
    return {
      base: Object.fromEntries(base.map((b) => [b.key, b.data])),
      localized,
      profile: profile ?? { full_name: '', admin_locale: 'tr', arabic_digits: 'latn' },
    };
  });
}

export async function saveSetting(uid: string, key: string, data: Record<string, unknown>) {
  await asUser(uid, (tx) =>
    tx.query(
      `insert into site_settings (key, data) values ($1, $2::jsonb) on conflict (key) do update set data = excluded.data`,
      [key, json(data)],
    ),
  );
}

export async function saveLocalizedSetting(
  uid: string,
  key: string,
  locale: Locale,
  data: Record<string, unknown>,
  status: string,
) {
  await asUser(uid, async (tx) => {
    await tx.query(
      `insert into site_settings (key, data) values ($1, '{}'::jsonb) on conflict (key) do nothing`,
      [key],
    );
    await tx.query(
      `insert into site_setting_translations (key, locale, data, translation_status) values ($1, $2, $3::jsonb, $4)
       on conflict (key, locale) do update set data = excluded.data, translation_status = excluded.translation_status`,
      [key, locale, json(data), status],
    );
  });
}

export async function saveProfile(uid: string, p: SettingsBundle['profile']) {
  await asUser(uid, (tx) =>
    tx.query(
      `update profiles set full_name = $2, admin_locale = $3, arabic_digits = $4 where id = $1`,
      [uid, p.full_name, p.admin_locale, p.arabic_digits],
    ),
  );
  await saveSetting(uid, 'numbers', { arabicDigits: p.arabic_digits });
}
