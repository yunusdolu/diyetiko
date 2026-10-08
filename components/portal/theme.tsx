'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { spring } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';

/** read by app/panel/layout.tsx so the server renders the right theme (no flash) */
export const PORTAL_THEME_COOKIE = 'portal_theme';
export type PortalTheme = 'light' | 'dark';

/**
 * The portal's day / night theme (DESIGN.md v1.39). The choice lives in a cookie and on <html>;
 * switching is instant (no reload) and every open control follows through the `portal-theme`
 * event.
 */
export function usePortalTheme(): [
  PortalTheme,
  (next: PortalTheme, from?: { x: number; y: number }) => void,
] {
  const [theme, setTheme] = useState<PortalTheme>('light');
  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    read();
    window.addEventListener('portal-theme', read);
    return () => window.removeEventListener('portal-theme', read);
  }, []);
  const apply = (next: PortalTheme, from?: { x: number; y: number }) => {
    const root = document.documentElement;
    const commit = () => {
      root.dataset.theme = next;
      // every open control follows inside the same frame
      flushSync(() => window.dispatchEvent(new Event('portal-theme')));
    };
    document.cookie = `${PORTAL_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    if (
      typeof document.startViewTransition !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      commit();
      return;
    }
    // Day / night as in the dietitian panel: the new theme opens as a circle from the switch,
    // over the old one, which sinks back a touch.
    const x = from?.x ?? window.innerWidth / 2;
    const y = from?.y ?? window.innerHeight / 2;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.dataset.vtTheme = next;
    const vt = document.startViewTransition(commit);
    vt.ready
      .then(() => {
        const opts = { duration: 720, easing: 'cubic-bezier(0.76, 0, 0.24, 1)' };
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { ...opts, fill: 'both', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => {});
    vt.finished.finally(() => delete root.dataset.vtTheme).catch(() => {});
  };
  return [theme, apply];
}

/**
 * Where the theme circle opens from: the middle of the sun / moon drawn inside the control that
 * was pressed — never the pointer, so it is the same spot wherever on the control the press
 * lands, and with the keyboard too. One rule for every theme control in the portal.
 */
export function glyphCentre(control: Element): { x: number; y: number } {
  const box = (control.querySelector('[data-theme-glyph]') ?? control).getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** A sun that becomes a moon. */
export function ThemeGlyph({ dark, size = 18 }: { dark: boolean; size?: number }) {
  const reduced = usePrefersReducedMotion();
  const t = reduced ? { duration: 0 } : spring.soft;
  return (
    <motion.svg
      data-theme-glyph=""
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      initial={false}
      animate={{ rotate: dark ? -25 : 0 }}
      transition={t}
    >
      <motion.circle
        cx="12"
        cy="12"
        fill="currentColor"
        initial={false}
        animate={{ r: dark ? 7.5 : 4.25 }}
        transition={t}
      />
      <motion.circle
        r="6.5"
        fill="var(--p-glyph-cut, var(--p-surface))"
        initial={false}
        animate={dark ? { cx: 16, cy: 8, opacity: 1 } : { cx: 26, cy: -2, opacity: 0 }}
        transition={t}
      />
      <motion.g
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        style={{ originX: '12px', originY: '12px' }}
        initial={false}
        animate={dark ? { scale: 0.4, opacity: 0 } : { scale: 1, opacity: 1 }}
        transition={t}
      >
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </motion.g>
    </motion.svg>
  );
}

/** Two choices side by side, for the account page (and phones, which have no sidebar). */
export function ThemeChoice() {
  const t = useTranslations('portal.theme');
  const [theme, setTheme] = usePortalTheme();
  return (
    <div role="radiogroup" aria-label={t('title')} className="grid grid-cols-2 gap-2">
      {(['light', 'dark'] as const).map((k) => {
        const on = theme === k;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={(e) => setTheme(k, glyphCentre(e.currentTarget))}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-[14px] border-[1.5px] text-[0.9375rem] font-semibold transition-colors',
              on ? 'border-ink bg-ink text-paper' : 'border-ink/20 hover:border-ink',
            )}
          >
            <ThemeGlyph dark={k === 'dark'} />
            {t(k)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The theme switch as a round button. The new theme opens as a circle from the centre of this
 * very button. `tone`: on a page, or on a dark card.
 */
export function ThemeButton({
  tone = 'page',
  size = 40,
  className,
}: {
  tone?: 'page' | 'dark';
  size?: number;
  className?: string;
}) {
  const t = useTranslations('portal.theme');
  const [theme, setTheme] = usePortalTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      data-theme-switch=""
      aria-label={`${t('title')}: ${t(theme)}`}
      title={`${t('title')}: ${t(theme)}`}
      onClick={(e) => {
        setTheme(next, glyphCentre(e.currentTarget));
      }}
      style={{
        width: size,
        height: size,
        ['--p-glyph-cut' as string]: tone === 'dark' ? '#0f1b17' : 'var(--p-bg)',
      }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full transition-[background-color,border-color,scale] active:scale-90',
        tone === 'dark'
          ? 'border border-paper/20 text-paper hover:border-paper/40 hover:bg-paper/10'
          : 'border-[1.5px] border-ink/20 hover:border-ink',
        className,
      )}
    >
      <ThemeGlyph dark={theme === 'dark'} size={size >= 40 ? 18 : 15} />
    </button>
  );
}
