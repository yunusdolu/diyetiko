'use client';

import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { admin } from '@/lib/motion';

/**
 * Progress to goal (0..1). Neutral language and colour: it shows distance covered, never a
 * judgement. Starts at 12 o'clock; mirrored in RTL.
 */
export function ProgressRing({
  value,
  size = 120,
  label,
  children,
}: {
  value: number;
  size?: number;
  label: string;
  children?: React.ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const r = size / 2 - 8;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${Math.round(v * 100)}%`}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="rtl:-scale-x-100"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--a-border)"
          strokeWidth="10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--a-chart)"
          strokeWidth="10"
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ pathLength: reduced ? v : 0 }}
          animate={{ pathLength: Math.max(0.001, v) }}
          transition={{ duration: reduced ? 0 : 0.9, ease: admin.ease }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
