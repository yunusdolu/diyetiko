'use client';

import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  wrap,
} from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type ReactNode } from 'react';
import { useDir, useMotionLevel } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';

/**
 * Velocity-reactive marquee: base drift + scroll velocity boost; scrolling up reverses it.
 * Direction follows reading direction (RTL drifts the other way). Pausable (WCAG 2.2.2).
 * Reduced motion: a static wrapped list, no pause control needed.
 */
export function Marquee({
  children,
  baseVelocity = 3,
  className,
  label,
}: {
  children: ReactNode;
  baseVelocity?: number;
  className?: string;
  label: string;
}) {
  const t = useTranslations('common');
  const level = useMotionLevel();
  const dir = useDir();
  const [paused, setPaused] = useState(false);
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 4], { clamp: false });
  // LTR: the doubled track is anchored left and slides into [-50%, 0]; RTL: anchored right, [0, 50%].
  const x = useTransform(baseX, (v) => (dir === 1 ? `${wrap(-50, 0, v)}%` : `${wrap(0, 50, v)}%`));
  const direction = useRef(1);
  const band = useRef<HTMLDivElement>(null);
  const inView = useInView(band, { margin: '100px 0px' });

  useAnimationFrame((_, delta) => {
    if (paused || level !== 'full' || !inView) return; // no work while off-screen
    const vf = velocityFactor.get();
    if (vf < 0) direction.current = -1;
    else if (vf > 0) direction.current = 1;
    // Base drift in the current direction, boosted by scroll speed. (Multiplying the direction
    // in twice would cancel the reversal when scrolling up fast.)
    const moveBy = direction.current * baseVelocity * (delta / 1000) * (1 + Math.abs(vf));
    baseX.set(baseX.get() - moveBy * dir * 0.6);
  });

  if (level === 'reduced') {
    return (
      <div
        className={cn('flex flex-wrap items-center gap-x-10 gap-y-4', className)}
        aria-label={label}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={band} className={cn('relative', className)}>
      <div className="overflow-hidden" aria-label={label} role="group">
        <motion.div className="flex w-max flex-nowrap items-center" style={{ x }}>
          <div className="flex shrink-0 items-center gap-10 pe-10">{children}</div>
          <div className="flex shrink-0 items-center gap-10 pe-10" aria-hidden>
            {children}
          </div>
        </motion.div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="absolute end-[var(--gutter)] top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-pill bg-ink/80 text-paper transition-colors hover:bg-ink focus-visible:bg-ink"
      >
        <span className="sr-only">{paused ? t('play') : t('pause')}</span>
        {paused ? (
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path d="M7 5l12 7-12 7Z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}
