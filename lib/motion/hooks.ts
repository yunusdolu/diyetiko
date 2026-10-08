'use client';

import { useLocale } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

function detectLowEnd(): boolean {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as NavigatorWithHints;
  if (n.connection?.saveData) return true;
  if (typeof n.deviceMemory === 'number' && n.deviceMemory <= 2) return true;
  if (
    typeof n.hardwareConcurrency === 'number' &&
    n.hardwareConcurrency <= 4 &&
    matchMedia('(pointer: coarse)').matches
  ) {
    return true;
  }
  return false;
}

/**
 * "full"    → all choreography (GSAP pins, scrubbing, cursor, marquee velocity)
 * "lite"    → save-data / low-end: micro-interactions only, no scroll theatre
 * "reduced" → prefers-reduced-motion: 150ms cross-fades, designed static compositions
 */
export type MotionLevel = 'full' | 'lite' | 'reduced';

export function useMotionLevel(): MotionLevel {
  const reduced = usePrefersReducedMotion();
  const [lowEnd, setLowEnd] = useState(false);
  useEffect(() => {
    // Hardware hints only exist in the browser; read them once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLowEnd(detectLowEnd());
  }, []);
  if (reduced) return 'reduced';
  if (lowEnd) return 'lite';
  return 'full';
}

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mql = matchMedia(query);
    mql.addEventListener('change', cb);
    return () => mql.removeEventListener('change', cb);
  };
}

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => matchMedia(query).matches,
    () => serverValue,
  );
}

/**
 * prefers-reduced-motion, hydration-safe. The server cannot know the setting, so the server HTML
 * and the hydration pass use the full-motion markup and reduced-motion browsers switch right
 * after. Use this instead of Motion's own `useReducedMotion` in anything that is server-rendered:
 * that hook reads the media query on the first client render, which makes React throw a
 * hydration mismatch for every visitor who has reduced motion on.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Fine pointer + real hover: the only place hover-driven and cursor effects are allowed. */
export function useFinePointer(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)');
}

/** 1 for LTR, -1 for RTL — multiply every horizontal offset by this. */
export function useDir(): 1 | -1 {
  return useLocale() === 'ar' ? -1 : 1;
}
