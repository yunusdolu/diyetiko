'use client';

import { useLocale, useTranslations } from 'next-intl';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { Link } from '@/lib/i18n/navigation';
import type { RecipeSummary } from '@/types/content';
import { Ingredient } from '@/components/site/ingredients';
import { RecipeCard, tints } from '@/components/site/recipe-card';
import { cn } from '@/lib/utils';

/** Featured recipe (large) + an index of three more — an editorial spread, not a card grid. */
export function RecipesTeaser({ recipes }: { recipes: RecipeSummary[] }) {
  const t = useTranslations('recipes.card');
  const tc = useTranslations('cursor');
  const locale = useLocale() as Locale;
  const fmt = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const [featured, ...rest] = recipes;
  if (!featured) return null;
  return (
    <div className="container-x mt-14 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-6">
      <RecipeCard recipe={featured} size="lg" priority className="lg:col-span-7" />
      <ol className="border-t-2 border-ink lg:col-span-4 lg:col-start-9">
        {rest.slice(0, 4).map((r, i) => (
          <li key={r.id} className="border-b border-ink/20">
            <Link
              href={{ pathname: '/recipes/[slug]', params: { slug: r.slug } }}
              className="group/row flex items-center gap-4 py-4"
            >
              <span
                data-cursor={tc('recipe')}
                className={cn(
                  'grid size-20 shrink-0 place-items-center overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/row:scale-95',
                  tints[r.illustration] ?? 'bg-paper-2',
                )}
              >
                <Ingredient
                  name={r.illustration}
                  className="size-16 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/row:scale-110 group-hover/row:rotate-[-10deg]"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block num text-[0.75rem] text-ink-60">
                  {String(i + 2).padStart(2, '0')} · {t('time', { count: r.prepMin + r.cookMin })} ·{' '}
                  {fmt.format(r.kcal)} kcal
                </span>
                <span className="mt-1 block font-display text-[1.4rem] leading-[1.1] transition-colors group-hover/row:text-paprika-deep ar:leading-[1.4] ar:font-bold">
                  {r.title}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
