/**
 * One motion language for the whole product (see DESIGN.md §7).
 * Only transform / opacity / clip-path / stroke-dashoffset are animated.
 */
import type { Transition, Variants } from 'motion/react';

export const ease = {
  /** expo-out — entrances, reveals */
  out: [0.16, 1, 0.3, 1],
  /** quart in-out — wipes, morphs, page transitions */
  inOut: [0.76, 0, 0.24, 1],
  /** expo-in — exits */
  in: [0.7, 0, 0.84, 0],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export const easeCss = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.76, 0, 0.24, 1)',
  in: 'cubic-bezier(0.7, 0, 0.84, 0)',
} as const;

/** seconds */
export const dur = { xs: 0.12, sm: 0.2, md: 0.35, lg: 0.6, xl: 0.9 } as const;

/** Exits run at 60% of the entrance duration. */
export const exitDur = (d: number) => d * 0.6;

export const stagger = { word: 0.045, char: 0.018, item: 0.06 } as const;

export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 34 },
  soft: { type: 'spring', stiffness: 180, damping: 24 },
  /** Magnetic buttons/chips: a little give, settles without bouncing (damping ratio ≈ 0.9). */
  magnet: { type: 'spring', stiffness: 300, damping: 24, mass: 0.6 },
  /** Things that trail the pointer (cursor ring, hover previews, hero plate): over-damped,
   *  so they catch up smoothly and never overshoot or wobble around the pointer. */
  follow: { type: 'spring', stiffness: 380, damping: 40, mass: 0.6 },
} as const satisfies Record<string, Transition>;

/** Admin is the same language, restrained: nothing longer than 250ms, no theatrics. */
export const admin = {
  dur: 0.2,
  ease: ease.out,
  spring: { type: 'spring', stiffness: 600, damping: 40 } as const satisfies Transition,
} as const;

export const t = {
  enter: (d: number = dur.lg, delay = 0): Transition => ({ duration: d, ease: ease.out, delay }),
  exit: (d: number = dur.lg): Transition => ({ duration: exitDur(d), ease: ease.in }),
  morph: (d: number = dur.lg): Transition => ({ duration: d, ease: ease.inOut }),
};

/** Masked line/word reveal: the child rises from behind an overflow-clip parent. */
export const maskReveal: Variants = {
  hidden: { y: '110%' },
  show: (i: number = 0) => ({
    y: '0%',
    transition: { duration: dur.xl, ease: ease.out, delay: i },
  }),
  exit: { y: '-110%', transition: { duration: exitDur(dur.lg), ease: ease.in } },
};

/** Reduced-motion counterpart: a quick cross-fade, no displacement. */
export const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Dialog / sheet entry used by all overlays. `dir` mirrors horizontal offsets in RTL. */
export const sheetFrom = (side: 'end' | 'bottom', dir: 1 | -1): Variants => ({
  hidden: side === 'bottom' ? { y: '100%' } : { x: `${100 * dir}%` },
  show: { x: 0, y: 0, transition: { duration: dur.lg, ease: ease.out } },
  exit: {
    ...(side === 'bottom' ? { y: '100%' } : { x: `${100 * dir}%` }),
    transition: { duration: exitDur(dur.md), ease: ease.in },
  },
});

export const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: dur.md, ease: ease.out, delay: i * stagger.item },
  }),
  exit: { opacity: 0, scale: 0.96, transition: { duration: exitDur(dur.md), ease: ease.in } },
};
