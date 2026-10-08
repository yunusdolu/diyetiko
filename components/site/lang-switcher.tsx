'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LOCALE_COOKIE, localeNames, locales, type Locale } from '@/lib/i18n/config';
import { getPathname, usePathname } from '@/lib/i18n/navigation';
import { dur, ease, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { coverForLanguageSwitch } from '@/components/motion/ink-loader';
import { useAlternates } from './alternates';

export function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Switch language: remember the choice and load the same page in the other language.
 *
 * A real page load on purpose: the language lives in the root layout, so a client-side switch
 * remounts the whole document anyway (direction, fonts, every effect). As a full navigation
 * everything initialises cleanly in the new direction, and the cross-document view transition
 * (`@view-transition` in globals.css, type "locale-swap") keeps the fade where supported.
 */
export function useSwitchLocale() {
  const pathname = usePathname();
  const params = useParams();
  const alternates = useAlternates();
  return (next: Locale) => {
    rememberLocale(next);
    const target = alternates
      ? getPathname({
          locale: next,
          href: {
            pathname: alternates.route,
            params: { slug: alternates.slugs[next] ?? String(params.slug ?? '') },
          },
        })
      : // Static routes: next-intl maps the internal pathname to the localized one.
        getPathname({ locale: next, href: pathname as Parameters<typeof getPathname>[0]['href'] });
    // ink covers this page, then the next one plays the loader in full before it opens
    void coverForLanguageSwitch().then(() => window.location.assign(target));
  };
}

export function LangSwitcher({
  tone = 'light',
  className,
}: {
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const t = useTranslations('lang');
  const locale = useLocale() as Locale;
  const switchTo = useSwitchLocale();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const dark = tone === 'dark';

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('label')}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-pill px-3 num text-[0.8125rem] font-medium uppercase transition-colors duration-200',
          dark ? 'text-paper hover:bg-green-2' : 'text-ink hover:bg-paper-2',
          open && (dark ? 'bg-green-2' : 'bg-paper-2'),
        )}
      >
        <span lang="en">{locale.toUpperCase()}</span>
        <motion.svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={spring.snappy}
        >
          <path
            d="M5 9l7 7 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            aria-label={t('label')}
            className="absolute end-0 top-[calc(100%+8px)] z-50 min-w-44 overflow-hidden rounded-[14px] bg-ink p-1.5 text-paper shadow-sheet"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: dur.sm, ease: ease.out },
            }}
            exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12 } }}
          >
            {locales.map((l, i) => (
              <motion.li
                key={l}
                role="none"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0, transition: { delay: 0.03 * i, duration: dur.sm } }}
              >
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={l === locale}
                  lang={l}
                  dir={l === 'ar' ? 'rtl' : 'ltr'}
                  onClick={() => {
                    setOpen(false);
                    if (l !== locale) switchTo(l);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-6 rounded-[10px] px-3 py-2.5 text-start text-ui transition-colors hover:bg-green',
                    l === locale && 'text-citrus',
                  )}
                >
                  <span>{localeNames[l]}</span>
                  <span className="num text-[0.6875rem] uppercase opacity-60" lang="en">
                    {l}
                  </span>
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
