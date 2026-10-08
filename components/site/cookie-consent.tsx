'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/lib/i18n/navigation';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { afterLoader, readCookie, usePromptTurn } from './prompts';

/** The visitor's answer, kept for a year. Read it before adding anything optional. */
export const CONSENT_COOKIE = 'dm_consent';
/** Fired by the footer's "cookie preferences" link: ask again. */
const SETTINGS_EVENT = 'dm:cookie-settings';

export function optionalCookiesAllowed(): boolean {
  return typeof document !== 'undefined' && readCookie(CONSENT_COOKIE) === 'accepted';
}

/**
 * Cookie choice: accept or reject, equally easy (one tap each, same size). Today the site sets
 * only the cookies it needs to work — the answer is recorded so that anything optional added
 * later asks first. Accepting takes a bite out of the biscuit; rejecting puts it away.
 */
export function CookieConsent() {
  const t = useTranslations('cookies');
  const reduced = usePrefersReducedMotion();
  const [wants, setWants] = useState(false);
  const [answer, setAnswer] = useState<'accepted' | 'rejected' | null>(null);
  const show = usePromptTurn('cookie', wants);

  // the footer link asks again, whatever was chosen before
  useEffect(() => {
    const again = () => {
      setAnswer(null);
      setWants(true);
    };
    window.addEventListener(SETTINGS_EVENT, again);
    return () => window.removeEventListener(SETTINGS_EVENT, again);
  }, []);

  useEffect(() => {
    if (readCookie(CONSENT_COOKIE)) return;
    let alive = true;
    afterLoader().then(() => {
      // a breath after the page opens
      window.setTimeout(() => alive && setWants(true), 900);
    });
    return () => {
      alive = false;
    };
  }, []);

  const decide = (a: 'accepted' | 'rejected') => {
    document.cookie = `${CONSENT_COOKIE}=${a}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setAnswer(a);
    window.setTimeout(() => setWants(false), reduced ? 0 : 520);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.section
          role="region"
          aria-label={t('title')}
          className="fixed inset-x-3 bottom-3 z-[75] mx-auto max-w-[34rem] overflow-hidden rounded-[22px] bg-ink text-paper shadow-sheet sm:inset-x-auto sm:start-6 sm:bottom-6 sm:mx-0"
          initial={{ y: reduced ? 0 : 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { duration: 0.55, ease: ease.out } }}
          exit={{ y: reduced ? 0 : 40, opacity: 0, transition: { duration: 0.3, ease: ease.in } }}
        >
          <div className="flex gap-4 p-5 sm:p-6">
            <Biscuit answer={answer} reduced={reduced} />
            <div className="min-w-0">
              <p className="font-display text-[1.375rem] leading-tight ar:font-bold">
                {t('title')}
              </p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-paper/80">{t('body')}</p>
              <Link
                href="/legal/cookies"
                className="mt-2 inline-block text-[0.8125rem] font-semibold text-citrus underline-offset-4 hover:underline"
              >
                {t('policy')}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-paper/12 p-3">
            <button
              type="button"
              onClick={() => decide('rejected')}
              className="h-12 rounded-pill border border-paper/30 text-ui font-semibold transition-colors hover:bg-paper hover:text-ink"
            >
              {t('reject')}
            </button>
            <button
              type="button"
              onClick={() => decide('accepted')}
              className="h-12 rounded-pill bg-citrus text-ui font-semibold text-ink transition-opacity hover:opacity-90"
            >
              {t('accept')}
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/** A drawn biscuit: a bite on accept, a little drop out of view on reject. */
function Biscuit({
  answer,
  reduced,
}: {
  answer: 'accepted' | 'rejected' | null;
  reduced: boolean;
}) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      className="size-14 shrink-0"
      aria-hidden
      initial={{ rotate: reduced ? 0 : -25, scale: reduced ? 1 : 0.6 }}
      animate={
        answer === 'rejected' && !reduced
          ? { rotate: 40, y: 24, opacity: 0 }
          : { rotate: 0, scale: 1, y: 0, opacity: 1 }
      }
      transition={{ type: 'spring', stiffness: 220, damping: 16 }}
    >
      <defs>
        <mask id="biscuit-bite">
          <rect width="64" height="64" fill="white" />
          <motion.g
            initial={false}
            animate={{ x: answer === 'accepted' ? 0 : 30 }}
            transition={{ duration: reduced ? 0 : 0.25, ease: ease.out }}
          >
            <circle cx="56" cy="10" r="9" fill="black" />
            <circle cx="46" cy="6" r="6" fill="black" />
            <circle cx="60" cy="22" r="6" fill="black" />
          </motion.g>
        </mask>
      </defs>
      <g mask="url(#biscuit-bite)">
        <circle cx="32" cy="32" r="27" fill="#d9a35b" stroke="var(--color-ink)" strokeWidth="2.5" />
        <circle
          cx="32"
          cy="32"
          r="22"
          fill="none"
          stroke="#b9823f"
          strokeWidth="1.5"
          strokeDasharray="2 4"
        />
        {[
          [22, 22],
          [38, 18],
          [42, 36],
          [26, 40],
          [34, 30],
          [18, 32],
        ].map(([x, y]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="3" ry="2.4" fill="#3b2416" />
        ))}
      </g>
    </motion.svg>
  );
}

/** "Cookie preferences" in the footer: opens the choice again. */
export function CookieSettingsLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(SETTINGS_EVENT))}
    >
      {children}
    </button>
  );
}
