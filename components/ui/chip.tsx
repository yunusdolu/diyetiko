'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useMagnet } from './motion-button';

/**
 * Toggle chip: aria-pressed, springy press, a check that draws in when selected, a gentle
 * magnetic pull on fine pointers. Width never fixed (French strings are long).
 */
export function Chip({
  selected,
  onToggle,
  children,
  count,
  tone = 'light',
  disabled,
  className,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  count?: number;
  tone?: 'light' | 'dark';
  disabled?: boolean;
  className?: string;
}) {
  const magnet = useMagnet(0.18);
  const dark = tone === 'dark';
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      whileTap={{ scale: 0.94 }}
      transition={spring.snappy}
      style={magnet.style}
      {...magnet.handlers}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-pill border-[1.5px] px-4 text-[0.875rem] font-semibold whitespace-nowrap transition-colors duration-200 disabled:opacity-35',
        dark
          ? selected
            ? 'border-citrus bg-citrus text-ink'
            : 'border-sage/40 text-paper hover:border-paper'
          : selected
            ? 'border-ink bg-ink text-paper'
            : 'border-ink/25 text-ink hover:border-ink',
        className,
      )}
    >
      <motion.svg
        viewBox="0 0 24 24"
        aria-hidden
        className="-ms-1 overflow-visible"
        initial={false}
        animate={{ width: selected ? 14 : 0, opacity: selected ? 1 : 0 }}
        transition={spring.snappy}
        height="14"
      >
        <motion.path
          d="M4.5 12.5l5 5L19.5 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: selected ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </motion.svg>
      <span>{children}</span>
      {typeof count === 'number' && (
        <span className="num text-[0.75rem] font-normal opacity-60">{count}</span>
      )}
    </motion.button>
  );
}
