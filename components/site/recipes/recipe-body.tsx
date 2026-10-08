'use client';

import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { useChecked, useShoppingList } from '@/lib/local-store';
import { niceQuantity, scaleLine } from '@/lib/nutrition/quantities';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { RecipeDetail } from '@/types/content';
import { IconButton } from '@/components/ui/misc';
import { MotionButton } from '@/components/ui/motion-button';
import { Ticker } from '@/components/ui/ticker';

/** Ingredients with a servings scaler (tweened numbers) + a persistent checklist. */
export function Ingredients({ recipe }: { recipe: RecipeDetail }) {
  const t = useTranslations('recipe');
  const tu = useTranslations('units');
  const locale = useLocale() as Locale;
  const [servings, setServings] = useState(recipe.servings);
  const checked = useChecked(recipe.id);
  const list = useShoppingList();
  const tl = useTranslations('recipes.list');
  const inList = list.has(recipe.id);
  const count = recipe.ingredients.filter((i) => checked.has(i.foodKey)).length;

  return (
    <div>
      {/* on the narrowest phones the servings stepper wraps under the heading */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b-2 border-ink pb-4">
        <h2 className="font-display text-display-md ar:font-bold">{t('ingredients')}</h2>
        <div className="flex items-center gap-2" role="group" aria-label={t('servings')}>
          <IconButton
            label={t('decrease')}
            size="sm"
            disabled={servings <= 1}
            onClick={() => setServings((s) => Math.max(1, s - 1))}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path d="M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </IconButton>
          <p className="min-w-20 text-center">
            <span className="block num-wide text-[1.5rem] leading-none">
              <Ticker value={servings} immediate duration={0.35} />
            </span>
            <span className="label text-[0.625rem] text-ink-60">{t('servings')}</span>
          </p>
          <IconButton
            label={t('increase')}
            size="sm"
            disabled={servings >= 24}
            onClick={() => setServings((s) => Math.min(24, s + 1))}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path
                d="M5 12h14M12 5v14"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
        </div>
      </div>
      <p className="mt-3 text-[0.8125rem] text-ink-60" aria-live="polite">
        {t('checked', { count, total: recipe.ingredients.length })}
      </p>
      <ul className="mt-2">
        {recipe.ingredients.map((ing) => {
          const line = scaleLine(ing, recipe.servings, servings);
          const on = checked.has(ing.foodKey);
          const unit =
            line.unitKey && line.unitQty
              ? `${niceQuantity(line.unitQty, 'unit')} ${tu(line.unitKey as 'piece')}`
              : null;
          const grams = new Intl.NumberFormat(intlLocale(locale), {
            maximumFractionDigits: 1,
          }).format(Number(niceQuantity(line.grams, 'grams')));
          return (
            <li key={ing.foodKey} className="border-b border-ink/15">
              <label className="group/ing flex cursor-pointer items-center gap-4 py-3.5">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={on}
                  onChange={() => checked.toggle(ing.foodKey)}
                />
                <span className="grid size-6 shrink-0 place-items-center rounded-[6px] border-[1.5px] border-ink transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                  <svg viewBox="0 0 24 24" className="size-4 text-paper" aria-hidden>
                    <motion.path
                      d="M4.5 12.5l5 5L19.5 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={false}
                      animate={{ pathLength: on ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </svg>
                </span>
                <span
                  className={cn(
                    'flex-1 text-body transition-colors',
                    on && 'text-ink-60 line-through decoration-ink/40',
                  )}
                >
                  {ing.name}
                  {ing.optional && (
                    <span className="ms-2 text-[0.8125rem] text-ink-60">({t('optional')})</span>
                  )}
                </span>
                <span className="shrink-0 text-end num text-[0.875rem]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`${servings}`}
                      className="inline-block"
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={spring.snappy}
                    >
                      {unit ?? `${grams} g`}
                    </motion.span>
                  </AnimatePresence>
                  {unit && <span className="block text-[0.75rem] text-ink-60">{grams} g</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-6">
        <MotionButton
          variant={inList ? 'fill' : 'outline'}
          onClick={() => list.toggle(recipe.id, servings)}
          state="idle"
        >
          {inList ? tl('remove') : tl('add')}
        </MotionButton>
      </div>
    </div>
  );
}

/** Steps with a sticky progress rail: the current step follows the reader. */
export function Steps({ steps }: { steps: string[] }) {
  const t = useTranslations('recipe');
  const ref = useRef<HTMLOListElement>(null);
  const [current, setCurrent] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 55%'] });
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  // Current step = the last one whose top has passed 55% of the viewport. At the very bottom of
  // the page the last step wins: the final steps often can't scroll up to the middle, so a
  // "crosses the middle band" observer would leave the counter stuck one step short.
  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>('[data-step]'));
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.55;
      let index = 0;
      items.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= line) index = i;
      });
      const atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const listVisible = list.getBoundingClientRect().bottom <= window.innerHeight + 4;
      if (atBottom && listVisible) index = items.length - 1;
      setCurrent(index);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [steps.length]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[10rem_1fr]">
      <div className="hidden lg:block">
        <div className="sticky top-28">
          <p className="label text-ink-60">{t('steps')}</p>
          <p
            className="mt-3 num-display text-[4rem] leading-none text-paprika-deep"
            aria-live="polite"
          >
            {t('stepOf', { current: current + 1, total: steps.length })}
          </p>
          <div className="mt-4 h-40 w-[3px] overflow-hidden bg-ink/10">
            <motion.div className="h-full w-full origin-top bg-ink" style={{ scaleY: progress }} />
          </div>
        </div>
      </div>
      <div>
        <h2 className="border-b-2 border-ink pb-4 font-display text-display-md lg:hidden ar:font-bold">
          {t('steps')}
        </h2>
        <ol ref={ref} className="space-y-10 pt-6 lg:pt-0">
          {steps.map((s, i) => (
            <li
              key={i}
              data-step={i}
              className={cn(
                'grid grid-cols-[3rem_1fr] gap-4 transition-opacity duration-500',
                i === current ? 'opacity-100' : 'opacity-55 motion-reduce:opacity-100',
              )}
            >
              <span className="num-display text-[2.25rem] leading-none text-paprika-deep">
                {i + 1}
              </span>
              <p className="text-lead">{s}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print group/draw inline-flex items-center gap-2 text-ui font-semibold coarse:min-h-11"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path
          d="M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v6H7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <span className="underline-offset-4 group-hover/draw:underline">{label}</span>
    </button>
  );
}
