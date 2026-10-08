'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { Link } from '@/lib/i18n/navigation';
import { useShoppingList, useStoredIds } from '@/lib/local-store';
import { aggregate, niceQuantity } from '@/lib/nutrition/quantities';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { RecipeIngredient } from '@/types/content';
import { IconButton } from '@/components/ui/misc';
import { MotionButton } from '@/components/ui/motion-button';
import type { ActionState } from '@/components/ui/status-icon';

type R = { id: string; slug: string; title: string; servings: number };

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Combined list from the recipes the visitor picked. Local only; printable and shareable. */
export function ShoppingList({
  recipes,
  ingredients,
}: {
  recipes: R[];
  ingredients: Record<string, RecipeIngredient[]>;
}) {
  const t = useTranslations('recipes.list');
  const tc = useTranslations('common');
  const tr = useTranslations('recipe');
  const locale = useLocale() as Locale;
  const list = useShoppingList();
  const got = useStoredIds('dm_shopping_checked_v1');
  const [shareState, setShareState] = useState<ActionState>('idle');

  const chosen = list.entries.flatMap((entry) => {
    const recipe = recipes.find((r) => r.id === entry.id);
    return recipe ? [{ entry, recipe }] : [];
  });
  const items = aggregate(
    chosen.map(({ entry, recipe }) => ({
      title: recipe.title,
      servings: entry.servings,
      baseServings: recipe.servings,
      lines: ingredients[recipe.id] ?? [],
    })),
  );
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 });
  const grams = (g: number) => `${nf.format(Number(niceQuantity(g, 'grams')))} g`;
  const asText = () =>
    `${t('shareText')}\n\n${items.map((i) => `• ${i.name} — ${grams(i.grams)}`).join('\n')}`;

  const share = async () => {
    setShareState('loading');
    try {
      if (navigator.share) await navigator.share({ title: t('shareText'), text: asText() });
      else await navigator.clipboard.writeText(asText());
      setShareState('success');
      window.setTimeout(() => setShareState('idle'), 1600);
    } catch {
      setShareState('idle');
    }
  };

  if (!chosen.length) {
    return (
      <div className="max-w-xl">
        <p className="text-lead text-ink-70">{t('empty')}</p>
        <Link
          href="/recipes"
          className="mt-6 inline-block text-ui font-semibold underline underline-offset-4"
        >
          {tc('seeAll')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-4">
        <h2 className="label text-ink-60">{t('recipes')}</h2>
        <ul className="mt-4 border-t-2 border-ink">
          <AnimatePresence initial={false}>
            {chosen.map(({ entry, recipe }) => (
              <motion.li
                key={recipe.id}
                layout
                exit={{ opacity: 0, x: -16 }}
                transition={spring.soft}
                className="flex items-center gap-3 border-b border-ink/15 py-3"
              >
                <Link
                  href={{ pathname: '/recipes/[slug]', params: { slug: recipe.slug } }}
                  className="min-w-0 flex-1 font-display text-[1.25rem] leading-tight hover:underline ar:font-bold"
                >
                  {recipe.title}
                </Link>
                <span
                  className="no-print flex items-center gap-1"
                  role="group"
                  aria-label={tr('servings')}
                >
                  <IconButton
                    size="sm"
                    label={tr('decrease')}
                    disabled={entry.servings <= 1}
                    onClick={() => list.setServings(recipe.id, entry.servings - 1)}
                  >
                    <Glyph d="M5 12h14" />
                  </IconButton>
                  <span className="w-6 text-center num">{entry.servings}</span>
                  <IconButton
                    size="sm"
                    label={tr('increase')}
                    onClick={() => list.setServings(recipe.id, entry.servings + 1)}
                  >
                    <Glyph d="M5 12h14M12 5v14" />
                  </IconButton>
                </span>
                <IconButton
                  size="sm"
                  label={t('remove')}
                  className="no-print"
                  onClick={() => list.toggle(recipe.id, entry.servings)}
                >
                  <Glyph d="M6 6l12 12M18 6L6 18" />
                </IconButton>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className="no-print mt-8 flex flex-wrap items-center gap-3">
          <MotionButton onClick={() => window.print()}>{tc('print')}</MotionButton>
          <MotionButton variant="outline" state={shareState} onClick={share}>
            {tc('share')}
          </MotionButton>
          <button
            type="button"
            onClick={list.clear}
            className="px-2 text-ui font-semibold underline underline-offset-4"
          >
            {t('clear')}
          </button>
        </div>
      </div>
      <div className="lg:col-span-7 lg:col-start-6">
        <h2 className="label text-ink-60">{t('items')}</h2>
        <ul className="mt-4 border-t-2 border-ink">
          {items.map((i) => {
            const on = got.has(i.foodKey);
            return (
              <li key={i.foodKey} className="border-b border-ink/15">
                <label className="flex cursor-pointer items-center gap-4 py-3">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    onChange={() => got.toggle(i.foodKey)}
                  />
                  <span className="grid size-6 shrink-0 place-items-center rounded-[6px] border-[1.5px] border-ink transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                    <svg viewBox="0 0 24 24" className="size-4 text-paper" aria-hidden>
                      <motion.path
                        d="M4.5 12.5l5 5L19.5 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        initial={false}
                        animate={{ pathLength: on ? 1 : 0 }}
                      />
                    </svg>
                  </span>
                  <span className={cn('flex-1 text-body', on && 'text-ink-60 line-through')}>
                    {i.name}
                    <span className="block text-[0.75rem] text-ink-60">
                      {i.recipes.join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 num">{grams(i.grams)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
