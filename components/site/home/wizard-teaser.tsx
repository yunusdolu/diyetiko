'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { spring } from '@/lib/motion';
import { useMotionLevel } from '@/lib/motion/hooks';
import { Ingredient } from '@/components/site/ingredients';

export const GOAL_OPTIONS = [
  { key: 'energy', art: 'lemon' },
  { key: 'weight_down', art: 'cucumber' },
  { key: 'weight_up', art: 'walnut' },
  { key: 'regular', art: 'bread' },
  { key: 'sport', art: 'egg' },
  { key: 'family', art: 'tomato' },
] as const;

/**
 * The wizard's first question, asked right on the home page. Each answer starts the wizard
 * with that choice already made (/goal?goal=…). Big numerals + drawn ingredient per option.
 */
export function WizardTeaser() {
  const t = useTranslations('home.wizard');
  const tg = useTranslations('wizard.steps.goal.options');
  const tc = useTranslations('cursor');
  const level = useMotionLevel();
  return (
    <ol
      className="grid grid-cols-1 border-t-2 border-ink sm:grid-cols-2 lg:grid-cols-3"
      aria-label={t('title')}
    >
      {GOAL_OPTIONS.map((opt, i) => (
        <li
          key={opt.key}
          className="border-b border-ink/20 lg:border-e lg:[&:nth-child(3n)]:border-e-0 sm:max-lg:[&:nth-child(odd)]:border-e"
        >
          <Link
            href={{ pathname: '/goal', query: { goal: opt.key } }}
            data-cursor={tc('goal')}
            data-cursor-arrow=""
            data-cursor-dark=""
            className="group/opt relative flex h-full min-h-36 items-end justify-between gap-4 overflow-hidden p-5 transition-colors duration-500 outline-none hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper sm:min-h-48 sm:p-6"
          >
            <span className="relative z-10 flex max-w-[64%] flex-col gap-3">
              <span className="num text-[0.75rem] text-ink-60 transition-colors group-hover/opt:text-sage">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-display text-[clamp(1.5rem,2.4vw,2.1rem)] leading-[1.05] tracking-[-0.01em] ar:leading-[1.35] ar:font-bold">
                {tg(opt.key)}
              </span>
            </span>
            <motion.span
              aria-hidden
              className="pointer-events-none absolute end-3 top-1/2 size-24 -translate-y-1/2 sm:size-28 lg:size-32"
              whileHover={level === 'full' ? { rotate: -14, scale: 1.08 } : undefined}
              transition={spring.soft}
            >
              <Ingredient
                name={opt.art}
                className="size-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/opt:scale-110 group-hover/opt:-rotate-12 motion-reduce:transition-none"
              />
            </motion.span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
