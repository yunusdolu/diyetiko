'use client';

import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { ease } from '@/lib/motion';

/**
 * Errors above the pages (the panel layout itself, the login page).
 * A friendly stop instead of a crash: what happened in plain words and one button that tries
 * again (re-runs the server render, then resets the boundary). Only the digest is logged.
 */
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('admin.common');
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    console.error('admin page error', error.digest ?? 'no-digest');
  }, [error]);
  return (
    <motion.section
      role="alert"
      className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: ease.out }}
    >
      <div>
        <svg
          viewBox="0 0 64 64"
          width="56"
          height="56"
          aria-hidden
          className="mx-auto text-a-muted"
        >
          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle
            cx="32"
            cy="32"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".4"
            strokeWidth="2.5"
          />
          <path
            d="M32 22v12M32 41h.01"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <h1 className="mt-5 font-display text-[1.75rem] leading-tight ar:font-bold">
          {t('errorTitle')}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-a-muted">{t('errorBody')}</p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(() => {
              router.refresh();
              reset();
            })
          }
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-pill bg-a-accent px-5 text-[0.9375rem] font-semibold text-a-accent-text transition-[opacity,transform] hover:opacity-90 active:scale-95 disabled:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden
            className={pending ? 'animate-spin' : undefined}
          >
            <path
              d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t('retry')}
        </button>
      </div>
    </motion.section>
  );
}
