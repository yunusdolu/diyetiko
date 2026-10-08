'use client';

import { motion, useInView } from 'motion/react';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { useRef } from 'react';
import { energyShares } from '@/lib/nutrition/energy';
import { ease } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * The brand mark: three concentric rings = the energy share of protein / carbohydrate / fat.
 * Each ring's stroke draws to its share when scrolled into view (or `play` becomes true).
 * Rings start at 12 o'clock and travel clockwise in LTR, counter-clockwise in RTL.
 */
export function MacroRings({
  protein,
  carb,
  fat,
  size = 220,
  stroke = Math.max(3, Math.round(size * 0.064)),
  gap = Math.max(2, Math.round(size * 0.036)),
  surface = 'light',
  play,
  className,
  label,
  children,
}: {
  protein: number;
  carb: number;
  fat: number;
  size?: number;
  stroke?: number;
  gap?: number;
  surface?: 'light' | 'dark';
  play?: boolean;
  className?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  const reduced = usePrefersReducedMotion();
  const shares = energyShares({ protein, carb, fat });
  const active = play ?? inView;
  const dark = surface === 'dark';

  const rings = [
    {
      key: 'protein',
      share: shares.protein,
      color: dark ? 'var(--color-protein)' : 'var(--color-protein-on-light)',
    },
    {
      key: 'carb',
      share: shares.carb,
      color: dark ? 'var(--color-carb)' : 'var(--color-carb-on-light)',
    },
    {
      key: 'fat',
      share: shares.fat,
      color: dark ? 'var(--color-fat)' : 'var(--color-fat-on-light)',
    },
  ] as const;

  const c = size / 2;
  return (
    <div
      ref={ref}
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className="rtl:-scale-x-100"
      >
        {rings.map((r, i) => {
          const radius = c - stroke / 2 - i * (stroke + gap);
          return (
            <g key={r.key} transform={`rotate(-90 ${c} ${c})`}>
              <circle
                cx={c}
                cy={c}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeOpacity={dark ? 0.14 : 0.1}
                strokeWidth={stroke}
              />
              <motion.circle
                cx={c}
                cy={c}
                r={radius}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                pathLength={1}
                initial={{ pathLength: reduced ? r.share : 0, opacity: r.share > 0 ? 1 : 0 }}
                // A zero share draws nothing (a round cap on a zero-length arc would leave a dot).
                animate={{
                  pathLength: active || reduced ? Math.max(0.001, r.share) : 0,
                  opacity: r.share > 0 ? 1 : 0,
                }}
                transition={{
                  duration: reduced ? 0 : 1.4,
                  ease: ease.inOut,
                  delay: reduced ? 0 : 0.15 + i * 0.12,
                }}
              />
            </g>
          );
        })}
      </svg>
      {children && (
        <div className="absolute inset-0 grid place-items-center text-center">
          <div className="flex flex-col items-center">{children}</div>
        </div>
      )}
    </div>
  );
}
