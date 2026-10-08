'use client';

import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMotionLevel } from '@/lib/motion/hooks';
import { ease } from '@/lib/motion';
import type { RecipeSummary } from '@/types/content';
import { RecipeCard } from '@/components/site/recipe-card';
import { MotionButton } from '@/components/ui/motion-button';

/**
 * "What should I eat today?" — one roll of a drawn die (two turns, eased), then the chosen
 * recipe is revealed with a clip wipe. No rapid cycling through titles (nothing flashes).
 */
export function RandomPicker({ recipes }: { recipes: RecipeSummary[] }) {
  const t = useTranslations('recipes.random');
  const level = useMotionLevel();
  const [pick, setPick] = useState<RecipeSummary | null>(null);
  const [rolling, setRolling] = useState(false);
  const [scope, animate] = useAnimate<SVGSVGElement>();
  const [face, setFace] = useState(5);

  const roll = async () => {
    if (rolling || !recipes.length) return;
    setRolling(true);
    let next = recipes[Math.floor(Math.random() * recipes.length)]!;
    if (pick && recipes.length > 1)
      while (next.id === pick.id) next = recipes[Math.floor(Math.random() * recipes.length)]!;
    if (level !== 'reduced' && scope.current) {
      await animate(
        scope.current,
        { rotate: [0, 720], scale: [1, 0.85, 1] },
        { duration: 0.9, ease: ease.inOut },
      );
    }
    setFace(1 + Math.floor(Math.random() * 6));
    setPick(next);
    setRolling(false);
  };

  const pips: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [
      [30, 30],
      [70, 70],
    ],
    3: [
      [28, 28],
      [50, 50],
      [72, 72],
    ],
    4: [
      [30, 30],
      [70, 30],
      [30, 70],
      [70, 70],
    ],
    5: [
      [28, 28],
      [72, 28],
      [50, 50],
      [28, 72],
      [72, 72],
    ],
    6: [
      [30, 26],
      [70, 26],
      [30, 50],
      [70, 50],
      [30, 74],
      [70, 74],
    ],
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-4">
        <h2 className="font-display text-display-md ar:font-bold">{t('title')}</h2>
        <svg ref={scope} viewBox="0 0 100 100" className="mt-8 size-32" aria-hidden>
          <rect
            x="10"
            y="10"
            width="80"
            height="80"
            rx="16"
            transform="translate(4 4)"
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="3"
          />
          <rect x="10" y="10" width="80" height="80" rx="16" fill="var(--color-paprika)" />
          {pips[face]!.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="7" fill="var(--color-ink)" />
          ))}
        </svg>
        <div className="mt-8">
          <MotionButton
            size="lg"
            onClick={roll}
            state={rolling ? 'loading' : 'idle'}
            effect="magnetic"
          >
            {pick ? t('again') : t('roll')}
          </MotionButton>
        </div>
      </div>
      <div className="min-h-[24rem] lg:col-span-7 lg:col-start-6" aria-live="polite">
        <AnimatePresence mode="wait">
          {pick && (
            <motion.div
              key={pick.id}
              initial={level === 'reduced' ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
              animate={
                level === 'reduced'
                  ? { opacity: 1 }
                  : { clipPath: 'inset(0 0 0% 0)', transition: { duration: 0.7, ease: ease.inOut } }
              }
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <RecipeCard recipe={pick} size="lg" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
