'use client';

import { motion, useInView } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';

/**
 * A year of months filling in, for dark surfaces: the first three (the minimum) in citrus, the
 * next three lighter, the rest as the road that can follow — with 3 / 6 / 12 under them.
 */
export function MonthStrip({ className, tall = true }: { className?: string; tall?: boolean }) {
  const ta = useTranslations('apply');
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: '-10% 0px' });
  return (
    <div ref={ref} className={className} aria-hidden>
      <div className="grid grid-cols-12 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'relative overflow-hidden rounded-[6px] bg-paper/8',
              tall ? 'h-24 sm:h-32' : 'h-16',
            )}
          >
            <motion.span
              className={cn(
                'absolute inset-0 origin-bottom rounded-[6px]',
                i < 3 ? 'bg-citrus' : i < 6 ? 'bg-paper/35' : 'bg-paper/15',
              )}
              initial={{ scaleY: reduced ? 1 : 0 }}
              animate={{ scaleY: seen || reduced ? 1 : 0 }}
              transition={{
                duration: 0.55,
                ease: ease.out,
                delay: reduced ? 0 : 0.15 + i * 0.07,
              }}
            />
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-12 text-[0.75rem] font-semibold">
        <span className="col-span-3 border-t-2 border-citrus pt-2 text-citrus">
          {ta('durations.m3')}
        </span>
        <span className="col-span-3 border-t-2 border-paper/35 pt-2 text-paper/70">
          {ta('durations.m6')}
        </span>
        <span className="col-span-6 border-t-2 border-paper/15 pt-2 text-end text-paper/50">
          {ta('durations.m12')}
        </span>
      </div>
    </div>
  );
}
