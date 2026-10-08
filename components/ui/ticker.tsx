'use client';

import { animate, useInView, useMotionValue } from 'motion/react';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { useLocale } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import { ease } from '@/lib/motion';

/**
 * Number tween. Starts when scrolled into view (or immediately with `immediate`), re-tweens on
 * value change. Formatting goes through Intl with the active locale (Arabic → Latin digits
 * unless `digits="arab"`). Screen readers get the final value only.
 */
export function Ticker({
  value,
  decimals = 0,
  duration = 1.1,
  immediate = false,
  digits = 'latn',
  className,
  prefix,
  suffix,
  format = 'decimal',
}: {
  value: number;
  decimals?: number;
  duration?: number;
  immediate?: boolean;
  digits?: 'latn' | 'arab';
  className?: string;
  prefix?: string;
  suffix?: string;
  /** percent: `value` is a ratio (0.25 → 25 %), formatted with the locale's percent pattern */
  format?: 'decimal' | 'percent';
}) {
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const mv = useMotionValue(immediate ? value : 0);
  const [shown, setShown] = useState(immediate ? value : 0);
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(isLocale(locale) ? intlLocale(locale, digits) : locale, {
        style: format,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [locale, decimals, digits, format],
  );

  useEffect(() => {
    if (!immediate && !inView) return;
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: ease.out });
    return () => controls.stop();
  }, [value, inView, immediate, reduced, duration, mv]);

  useEffect(() => mv.on('change', (v) => setShown(v)), [mv]);

  const display = reduced && (inView || immediate) ? value : shown;

  return (
    <span ref={ref} className={className}>
      <span aria-hidden>
        {prefix}
        {fmt.format(display)}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {fmt.format(value)}
        {suffix}
      </span>
    </span>
  );
}
