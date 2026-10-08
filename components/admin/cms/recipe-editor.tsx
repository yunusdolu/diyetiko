'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { deleteRecipeAction, saveRecipeAction } from '@/app/admin/_actions/cms';
import type { RecipeEdit } from '@/lib/admin/cms';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { slugify } from '@/lib/slug';
import { cn } from '@/lib/utils';
import type { FoodOption } from '@/types/admin';
import {
  Badge,
  Button,
  Input,
  Label,
  PageTitle,
  Panel,
  Select,
  Textarea,
} from '@/components/admin/ui';
import { Ingredient, illustrationKeys } from '@/components/site/ingredients';
import { Switch } from '@/components/ui/checkbox';
import type { ActionState } from '@/components/ui/status-icon';
import { statusTone } from './cms-list';
import { DraftTranslationButton } from './draft-translation';
import { MediaUpload } from './media-upload';

type T = RecipeEdit['translations'][number];
const emptyT = (locale: Locale): T => ({
  locale,
  slug: '',
  title: '',
  summary: '',
  steps: [],
  tips: null,
  translation_status: locale === 'tr' ? 'needs_review' : 'draft',
});

export function RecipeEditor({
  recipe,
  foods,
  canDraftTranslate,
}: {
  recipe: RecipeEdit | null;
  foods: FoodOption[];
  canDraftTranslate: boolean;
}) {
  const t = useTranslations('admin.cms');
  const tc = useTranslations('admin.common');
  const tm = useTranslations('meals');
  const tu = useTranslations('units');
  const tmac = useTranslations('macros');
  const uiLocale = useLocale();
  const router = useRouter();
  const [published, setPublished] = useState(recipe?.published ?? false);
  const [illustration, setIllustration] = useState(recipe?.illustration ?? 'tomato');
  const [cover, setCover] = useState<string | null>(recipe?.cover_path ?? null);
  const [prep, setPrep] = useState(recipe?.prep_min ?? 10);
  const [cook, setCook] = useState(recipe?.cook_min ?? 15);
  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [mealTypes, setMealTypes] = useState<string[]>(recipe?.meal_types ?? []);
  const [translations, setTranslations] = useState<Partial<Record<Locale, T>>>(
    Object.fromEntries((recipe?.translations ?? [emptyT('tr')]).map((x) => [x.locale, x])),
  );
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? []);
  const [locale, setLocale] = useState<Locale>('tr');
  const [state, setState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [foodQuery, setFoodQuery] = useState('');

  const cur = translations[locale] ?? emptyT(locale);
  const setCur = (patch: Partial<T>) =>
    setTranslations((all) => ({ ...all, [locale]: { ...cur, ...patch } }));

  const per = useMemo(() => {
    const total = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
    for (const ing of ingredients) {
      if (ing.optional) continue;
      const f = foods.find((x) => x.id === ing.food_id);
      if (!f) continue;
      const k = ing.grams / 100;
      total.kcal += f.kcal * k;
      total.p += f.protein_g * k;
      total.c += f.carb_g * k;
      total.f += f.fat_g * k;
      total.fib += f.fiber_g * k;
    }
    const s = Math.max(1, servings);
    return {
      kcal: total.kcal / s,
      p: total.p / s,
      c: total.c / s,
      f: total.f / s,
      fib: total.fib / s,
    };
  }, [ingredients, foods, servings]);

  const save = async () => {
    setState('loading');
    setError(null);
    const payload = {
      published,
      illustration,
      cover_path: cover,
      prep_min: prep,
      cook_min: cook,
      servings,
      meal_types: mealTypes,
      translations: Object.values(translations)
        .filter((x): x is T => Boolean(x && x.title.trim()))
        .map((x) => ({ ...x, steps: x.steps.filter((s) => s.trim()) })),
      ingredients,
    };
    const res = await saveRecipeAction(recipe?.id ?? null, payload);
    if (!res.ok) {
      setState('error');
      setError(res.error ?? tc('error'));
      toast.error(tc('error'));
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    toast.success(tc('saved'));
    setTimeout(() => setState('idle'), 1000);
    if (!recipe && res.data) router.replace(`/admin/recipes/${res.data.id}`);
    else router.refresh();
  };

  const suggestions = foodQuery.trim()
    ? foods
        .filter((f) =>
          f.name.toLocaleLowerCase(uiLocale).includes(foodQuery.trim().toLocaleLowerCase(uiLocale)),
        )
        .slice(0, 8)
    : [];

  return (
    <div>
      <PageTitle
        eyebrow={
          <Link href="/admin/recipes" className="hover:underline">
            {t('recipesTitle')}
          </Link>
        }
        title={translations.tr?.title || cur.title || t('newRecipe')}
        actions={
          <>
            {recipe && (
              <Button
                variant="ghost"
                className="text-a-danger"
                onClick={async () => {
                  await deleteRecipeAction(recipe.id);
                  toast.success(tc('deleted'));
                  router.push('/admin/recipes');
                }}
              >
                {tc('delete')}
              </Button>
            )}
            <Button variant="primary" state={state} onClick={save}>
              {tc('save')}
            </Button>
          </>
        }
      />
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[10px] bg-[color-mix(in_oklab,var(--a-danger)_12%,transparent)] px-4 py-2 text-[0.875rem] text-a-danger"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.3fr]">
        <div className="space-y-5">
          <Panel title={t('published')}>
            <Switch
              checked={published}
              onCheckedChange={setPublished}
              label={published ? t('published') : t('draft')}
              description={t('reviewRule')}
            />
          </Panel>
          <Panel title={t('illustration')}>
            <div className="flex flex-wrap gap-2">
              {illustrationKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setIllustration(k)}
                  aria-pressed={illustration === k}
                  title={k}
                  className={cn(
                    'grid size-14 place-items-center rounded-[12px] border transition-colors',
                    illustration === k
                      ? 'border-a-text bg-a-surface-2'
                      : 'border-a-border hover:border-a-text/40',
                  )}
                >
                  <Ingredient name={k} className="size-10" />
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Label>{t('cover')}</Label>
              <MediaUpload kind="recipe" value={cover} onChange={setCover} />
            </div>
          </Panel>
          <Panel title={t('ingredients')}>
            <div className="grid grid-cols-3 gap-3">
              <Input
                type="number"
                label={t('prep')}
                value={prep}
                min={0}
                onChange={(e) => setPrep(Number(e.target.value))}
              />
              <Input
                type="number"
                label={t('cook')}
                value={cook}
                min={0}
                onChange={(e) => setCook(Number(e.target.value))}
              />
              <Input
                type="number"
                label={t('servings')}
                value={servings}
                min={1}
                max={24}
                onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <fieldset className="mt-4">
              <legend className="mb-1.5 text-[0.8125rem] font-semibold">{t('mealTypes')}</legend>
              <div className="flex flex-wrap gap-2">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mealTypes.includes(m)}
                    onClick={() =>
                      setMealTypes((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))
                    }
                    className={cn(
                      'h-8 rounded-pill border px-3 text-[0.8125rem] font-semibold transition-colors',
                      mealTypes.includes(m)
                        ? 'border-a-text bg-a-accent text-a-accent-text'
                        : 'border-a-border',
                    )}
                  >
                    {tm(m === 'snack' ? 'snack' : m)}
                  </button>
                ))}
              </div>
            </fieldset>

            <ul className="mt-5 space-y-2">
              <AnimatePresence initial={false}>
                {ingredients.map((ing, i) => {
                  const f = foods.find((x) => x.id === ing.food_id);
                  const unit = f?.units.find((u) => u.key === ing.unit_key);
                  return (
                    <motion.li
                      key={`${ing.food_id}-${i}`}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: admin.dur }}
                      className="flex flex-wrap items-center gap-2 rounded-[10px] bg-a-bg px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold">
                        {f?.name ?? '?'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={unit ? (ing.unit_qty ?? 1) : ing.grams}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setIngredients((all) =>
                            all.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    grams: unit ? v * unit.grams : v,
                                    unit_qty: unit ? v : null,
                                  }
                                : x,
                            ),
                          );
                        }}
                        aria-label={t('grams')}
                        className="h-8 w-20 rounded-[8px] border border-a-border bg-a-surface px-2 text-end num text-[0.8125rem]"
                      />
                      <select
                        value={ing.unit_key ?? 'g'}
                        onChange={(e) => {
                          const u = f?.units.find((x) => x.key === e.target.value);
                          setIngredients((all) =>
                            all.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    unit_key: u?.key ?? null,
                                    unit_qty: u ? 1 : null,
                                    grams: u ? u.grams : x.grams,
                                  }
                                : x,
                            ),
                          );
                        }}
                        aria-label={t('unit')}
                        className="h-8 rounded-[8px] border border-a-border bg-a-surface px-1 text-[0.75rem]"
                      >
                        <option value="g">g</option>
                        {f?.units.map((u) => (
                          <option key={u.key} value={u.key}>
                            {tu(u.key as 'piece')} ({u.grams} g)
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-[0.75rem]">
                        <input
                          type="checkbox"
                          checked={ing.optional}
                          onChange={(e) =>
                            setIngredients((all) =>
                              all.map((x, j) =>
                                j === i ? { ...x, optional: e.target.checked } : x,
                              ),
                            )
                          }
                        />
                        {t('optional')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIngredients((all) => all.filter((_, j) => j !== i))}
                        aria-label={tc('remove')}
                        className="grid size-7 place-items-center rounded-[8px] text-a-muted hover:text-a-danger"
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
                          <path
                            d="M6 6l12 12M18 6L6 18"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            <div className="relative mt-3">
              <Input
                label={t('addIngredient')}
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="…"
              />
              {suggestions.length > 0 && (
                <ul className="a-glass a-glass-sm absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto p-1">
                  {suggestions.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setIngredients((all) => [
                            ...all,
                            {
                              food_id: f.id,
                              grams: f.units[0]?.grams ?? 100,
                              unit_key: f.units[0]?.key ?? null,
                              unit_qty: f.units[0] ? 1 : null,
                              optional: false,
                            },
                          ]);
                          setFoodQuery('');
                        }}
                        className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-start text-[0.875rem] hover:bg-a-surface-2"
                      >
                        {f.name}
                        <span className="num text-[0.75rem] text-a-muted">
                          {Math.round(f.kcal)} kcal/100 g
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <dl className="mt-5 grid grid-cols-5 gap-2 rounded-[12px] border border-a-border p-3 text-center text-[0.75rem]">
              <dt className="col-span-5 text-start font-semibold text-a-muted">{t('computed')}</dt>
              {[
                ['kcal', per.kcal],
                [tmac('short.protein'), per.p],
                [tmac('short.carb'), per.c],
                [tmac('short.fat'), per.f],
                [tmac('fiber'), per.fib],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-a-muted">{k}</dt>
                  <dd className="mt-0.5 num text-[0.9375rem] font-semibold">
                    {Math.round(Number(v))}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>

        <Panel
          title={t('title')}
          action={
            <span className="flex items-center gap-2">
              <Badge tone={statusTone[cur.translation_status]}>
                {t(`translationStatus.${cur.translation_status}`)}
              </Badge>
            </span>
          }
        >
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label={tc('language')}>
            {locales.map((l) => {
              const tr = translations[l];
              return (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={locale === l}
                  onClick={() => setLocale(l)}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[0.8125rem] font-semibold transition-colors',
                    locale === l
                      ? 'border-a-text bg-a-accent text-a-accent-text'
                      : 'border-a-border hover:bg-a-surface-2',
                  )}
                >
                  {localeNames[l]}
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      !tr?.title
                        ? 'bg-a-danger'
                        : tr.translation_status === 'reviewed'
                          ? 'bg-a-ok'
                          : 'bg-mustard',
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={locale}
              className="grid gap-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: admin.dur }}
              lang={locale}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
            >
              {!translations[locale]?.title && (
                <p className="text-[0.8125rem] text-a-muted">{t('missingTranslation')}</p>
              )}
              <Input
                label={t('title')}
                value={cur.title}
                onChange={(e) =>
                  setCur({
                    title: e.target.value,
                    ...(locale !== 'ar' && (!cur.slug || cur.slug === slugify(cur.title))
                      ? { slug: slugify(e.target.value) }
                      : {}),
                  })
                }
              />
              <Input
                label={t('slug')}
                value={cur.slug}
                dir="ltr"
                onChange={(e) => setCur({ slug: e.target.value.toLowerCase() })}
                hint={locale === 'ar' ? 'a-z 0-9 -' : undefined}
              />
              <Textarea
                label={t('summary')}
                rows={2}
                value={cur.summary}
                onChange={(e) => setCur({ summary: e.target.value })}
              />
              <Textarea
                label={t('steps')}
                hint={t('stepsHint')}
                rows={8}
                value={cur.steps.join('\n')}
                onChange={(e) => setCur({ steps: e.target.value.split('\n') })}
              />
              <Textarea
                label={t('tips')}
                rows={2}
                value={cur.tips ?? ''}
                onChange={(e) => setCur({ tips: e.target.value || null })}
              />
              <Select
                label={tc('status')}
                value={cur.translation_status}
                onChange={(e) =>
                  setCur({ translation_status: e.target.value as T['translation_status'] })
                }
                options={(['draft', 'needs_review', 'reviewed'] as const).map((s) => ({
                  value: s,
                  label: t(`translationStatus.${s}`),
                }))}
              />
              {locale !== 'tr' && recipe && (
                <DraftTranslationButton
                  enabled={canDraftTranslate}
                  kind="recipe"
                  id={recipe.id}
                  to={locale}
                  onDraft={(d) => setCur({ ...d, translation_status: 'needs_review' })}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </Panel>
      </div>
    </div>
  );
}
