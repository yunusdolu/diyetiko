'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  LANG_SUGGEST_COOKIE,
  LOCALE_COOKIE,
  isLocale,
  localeNames,
  type Locale,
} from '@/lib/i18n/config';
import { dur, ease } from '@/lib/motion';
import { useSwitchLocale } from './lang-switcher';
import { usePromptTurn } from './prompts';

type LangStrings = { suggest: string; suggestAction: string; dismiss: string };

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

/**
 * Suggests ONE other language, ONCE, based on the browser's languages. Never redirects.
 * Shown in the suggested language (the visitor may not read the current one).
 */
export function LangSuggest({ strings }: { strings: Record<Locale, LangStrings> }) {
  const current = useLocale() as Locale;
  const switchTo = useSwitchLocale();
  const [suggest, setSuggest] = useState<Locale | null>(null);

  useEffect(() => {
    if (readCookie(LANG_SUGGEST_COOKIE) || readCookie(LOCALE_COOKIE)) return;
    const preferred = (navigator.languages ?? [navigator.language])
      .map((l) => l.slice(0, 2).toLowerCase())
      .find((l): l is Locale => isLocale(l));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preferred && preferred !== current) setSuggest(preferred);
  }, [current]);

  const dismiss = () => {
    document.cookie = `${LANG_SUGGEST_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    setSuggest(null);
  };

  // waits its turn behind the cookie choice (one prompt at a time)
  const turn = usePromptTurn('lang', Boolean(suggest));
  const s = suggest ? strings[suggest] : null;
  const fill = (x: string) => x.replace('{language}', suggest ? localeNames[suggest] : '');

  return (
    <AnimatePresence>
      {suggest && s && turn && (
        <motion.aside
          lang={suggest}
          dir={suggest === 'ar' ? 'rtl' : 'ltr'}
          aria-live="polite"
          className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-xl flex-wrap items-center gap-x-4 gap-y-3 rounded-[16px] bg-ink px-5 py-4 text-paper shadow-sheet sm:bottom-6"
          initial={{ y: 40, opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            transition: { duration: dur.lg, ease: ease.out, delay: 1.6 },
          }}
          exit={{ y: 40, opacity: 0, transition: { duration: dur.sm } }}
        >
          <p className="min-w-0 flex-1 text-ui">{fill(s.suggest)}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-pill px-3 py-2 text-[0.8125rem] font-semibold text-sage transition-colors hover:text-paper"
            >
              {s.dismiss}
            </button>
            <button
              type="button"
              onClick={() => {
                dismiss();
                switchTo(suggest);
              }}
              className="rounded-pill bg-citrus px-4 py-2 text-[0.8125rem] font-semibold text-ink transition-transform active:scale-95"
            >
              {fill(s.suggestAction)}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
