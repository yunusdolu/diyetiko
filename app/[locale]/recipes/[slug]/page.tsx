import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ViewTransition } from 'react';
import { getRecipe, listRecipes } from '@/lib/content/public';
import { intlLocale, isLocale, localeNames, locales, type Locale } from '@/lib/i18n/config';
import { Link, redirect } from '@/lib/i18n/navigation';
import { absoluteUrl, alternatesFor, localizedPath, ogImages } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { RegisterAlternates } from '@/components/site/alternates';
import { Ingredient } from '@/components/site/ingredients';
import { JsonLd } from '@/components/site/json-ld';
import { MacroRings } from '@/components/site/macro-rings';
import { NutritionLabel } from '@/components/site/nutrition-label';
import { FavoriteButton, RecipeCard, tints } from '@/components/site/recipe-card';
import { Ingredients, PrintButton, Steps } from '@/components/site/recipes/recipe-body';
import { Tooltip } from '@/components/ui/misc';
import { ArrowIcon } from '@/components/ui/motion-button';

export const revalidate = 3600;

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  // Development renders on demand; skipping this keeps Next's static-paths worker (a separate
  // process) away from the local demo database, which only one process may open.
  if (process.env.NODE_ENV === 'development') return [];
  if (!isLocale(params.locale)) return [];
  const recipes = await listRecipes(params.locale);
  return recipes.map((r) => ({ slug: r.slug }));
}

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const res = await getRecipe(locale, decodeURIComponent(slug));
  if (res.kind !== 'found') return {};
  const r = res.item;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const own = locales.filter((l) => r.alternates[l]);
  return {
    title: t('titleTemplate').replace('%s', r.title),
    description: r.summary,
    alternates: alternatesFor(
      locale,
      (l) =>
        r.alternates[l]
          ? { pathname: '/recipes/[slug]', params: { slug: r.alternates[l]! } }
          : null,
      own.length ? own : [locale],
    ),
    openGraph: {
      title: r.title,
      description: r.summary,
      type: 'article',
      images: r.coverUrl ? [r.coverUrl] : await ogImages(locale),
    },
  };
}

const iso = (min: number) => `PT${min}M`;

export default async function RecipePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const res = await getRecipe(locale, decodeURIComponent(slug));
  if (res.kind === 'missing') notFound();
  if (res.kind === 'redirect')
    redirect({ href: { pathname: '/recipes/[slug]', params: { slug: res.slug } }, locale });
  if (res.kind !== 'found') notFound();
  const r = res.item;

  const t = await getTranslations('recipe');
  const tc = await getTranslations('common');
  const tm = await getTranslations('macros');
  const td = await getTranslations('diet');
  const tr = await getTranslations('recipes');
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 });
  const related = (await listRecipes(locale))
    .filter((x) => x.id !== r.id)
    .map((x) => ({
      x,
      score:
        x.mealTypes.filter((m) => r.mealTypes.includes(m)).length +
        x.tags.filter((tg) => r.tags.includes(tg)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.x);
  const fallback = r.contentLocale !== locale;

  return (
    <article
      lang={fallback ? r.contentLocale : undefined}
      dir={fallback && r.contentLocale !== 'ar' && locale === 'ar' ? 'ltr' : undefined}
    >
      <RegisterAlternates value={{ route: '/recipes/[slug]', slugs: r.alternates }} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Recipe',
          name: r.title,
          description: r.summary,
          inLanguage: r.contentLocale,
          image: r.coverUrl ? [r.coverUrl] : undefined,
          author: { '@type': 'Organization', name: 'Diyetiko' },
          prepTime: iso(r.prepMin),
          cookTime: iso(r.cookMin),
          totalTime: iso(r.prepMin + r.cookMin),
          recipeYield: String(r.servings),
          recipeCategory: r.mealTypes.join(', '),
          keywords: r.tags.map((x) => td(x)).join(', '),
          recipeIngredient: r.ingredients.map((i) => `${nf1.format(i.grams)} g ${i.name}`),
          recipeInstructions: r.steps.map((s) => ({ '@type': 'HowToStep', text: s })),
          nutrition: {
            '@type': 'NutritionInformation',
            servingSize: '1',
            calories: `${nf.format(r.kcal)} kcal`,
            proteinContent: `${nf1.format(r.protein)} g`,
            carbohydrateContent: `${nf1.format(r.carb)} g`,
            fatContent: `${nf1.format(r.fat)} g`,
            fiberContent: `${nf1.format(r.fiber)} g`,
          },
          url: absoluteUrl(
            localizedPath(locale, { pathname: '/recipes/[slug]', params: { slug: r.slug } }),
          ),
        }}
      />

      {/* Hero */}
      <header className="container-x grid grid-cols-1 gap-10 pt-24 pb-16 lg:grid-cols-12 lg:gap-6 lg:pt-32">
        <div className="lg:col-span-6">
          <ViewTransition name={`recipe-${r.id}`} share="morph" default="none">
            <div
              className={cn(
                'relative grid aspect-[4/3.4] place-items-center overflow-hidden',
                tints[r.illustration] ?? 'bg-paper-2',
              )}
            >
              {r.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <Ingredient name={r.illustration} className="h-[78%] w-auto" />
              )}
            </div>
          </ViewTransition>
        </div>
        <div className="flex flex-col lg:col-span-6 lg:ps-6">
          <Link
            href="/recipes"
            className="no-print group/back inline-flex items-center gap-2 self-start text-[0.8125rem] font-semibold text-ink-70 coarse:min-h-11"
          >
            <ArrowIcon size={14} className="rotate-180" />
            <span className="group-hover/back:underline">{t('backToRecipes')}</span>
          </Link>
          <h1 className="mt-6 font-display text-display-lg tracking-[-0.025em] ar:leading-[1.3] ar:font-bold ar:tracking-normal">
            {r.title}
          </h1>
          <p className="mt-5 max-w-xl text-lead text-ink-70">{r.summary}</p>

          <dl className="mt-8 grid max-w-lg grid-cols-4 border-y-2 border-ink">
            {[
              [t('prep'), tc('minutes', { count: r.prepMin })],
              [t('cook'), tc('minutes', { count: r.cookMin })],
              [t('total'), tc('minutes', { count: r.prepMin + r.cookMin })],
              [t('servings'), String(r.servings)],
            ].map(([k, v], i) => (
              <div key={k} className={cn('py-3', i > 0 && 'border-s border-ink/20 ps-3')}>
                <dt className="label text-[0.625rem] text-ink-60">{k}</dt>
                <dd className="mt-1 num text-[0.9375rem]">{v}</dd>
              </div>
            ))}
          </dl>

          {r.tags.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {r.tags.map((tag) => (
                <li key={tag}>
                  <Tooltip content={td(`thresholds.${tag}`)}>
                    <button
                      type="button"
                      className="rounded-pill border border-ink/25 px-3 py-1.5 text-[0.8125rem] font-medium hover:border-ink coarse:min-h-11 coarse:px-4"
                    >
                      {td(tag)}
                    </button>
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}

          <div className="no-print mt-8 flex items-center gap-5">
            <FavoriteButton id={r.id} title={r.title} className="border border-ink/25" />
            <PrintButton label={tc('print')} />
          </div>

          {fallback && (
            <p
              className="mt-6 max-w-lg border-s-2 border-paprika-deep ps-3 text-[0.8125rem] text-ink-70"
              lang={locale}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
            >
              {tc('translationFallback', {
                language: localeNames[locale],
                fallback: localeNames[r.contentLocale],
              })}
            </p>
          )}
        </div>
      </header>

      {/* Ingredients + nutrition */}
      <section className="container-x grid grid-cols-1 gap-14 py-16 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-6">
          <Ingredients recipe={r} />
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <div className="lg:sticky lg:top-24">
            <div className="flex flex-wrap items-center gap-8">
              <MacroRings
                protein={r.protein}
                carb={r.carb}
                fat={r.fat}
                size={180}
                stroke={13}
                gap={6}
                label={`${tm('protein')} / ${tm('carb')} / ${tm('fat')}`}
              >
                <span className="num-wide text-[1.75rem] leading-none">{nf.format(r.kcal)}</span>
                <span className="mt-1 label text-[0.625rem] text-ink-60">kcal</span>
              </MacroRings>
              <ul className="space-y-2 text-[0.8125rem]">
                {(['protein', 'carb', 'fat'] as const).map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'size-2.5 rounded-full',
                        {
                          protein: 'bg-protein-on-light',
                          carb: 'bg-carb-on-light',
                          fat: 'bg-fat-on-light',
                        }[k],
                      )}
                      aria-hidden
                    />
                    <span className="font-semibold">{tm(k)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <NutritionLabel
              className="mt-8"
              title={t('nutrition')}
              caption={t('nutritionNote')}
              rows={[
                { label: tm('kcal'), value: `${nf.format(r.kcal)} kcal`, total: false },
                { label: tm('protein'), value: `${nf1.format(r.protein)} g` },
                { label: tm('carb'), value: `${nf1.format(r.carb)} g` },
                { label: tm('fiber'), value: `${nf1.format(r.fiber)} g`, sub: true },
                { label: tm('fat'), value: `${nf1.format(r.fat)} g` },
              ]}
              footer={t('dataNote')}
            />
          </div>
        </div>
      </section>

      {/* Method */}
      <section className="container-x py-16">
        <Steps steps={r.steps} />
        {r.tips && (
          <aside className="mt-16 grid grid-cols-1 gap-3 border-t-2 border-ink pt-6 lg:ms-[10rem] lg:grid-cols-[12rem_1fr]">
            <p className="label text-ink-60">{t('tips')}</p>
            <p className="max-w-2xl font-display text-[1.5rem] leading-snug italic ar:leading-[1.6] ar:font-bold ar:not-italic">
              {r.tips}
            </p>
          </aside>
        )}
      </section>

      {related.length > 0 && (
        <section className="no-print border-t border-ink/15 bg-paper-2 grain py-24">
          <div className="container-x">
            <h2 className="font-display text-display-md ar:font-bold">{t('related')}</h2>
            <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((x) => (
                <RecipeCard key={x.id} recipe={x} />
              ))}
            </div>
            <p className="mt-12">
              <Link
                href="/recipes"
                className="tap-44 text-ui font-semibold underline underline-offset-4"
              >
                {tr('title')}
              </Link>
            </p>
          </div>
        </section>
      )}
    </article>
  );
}
