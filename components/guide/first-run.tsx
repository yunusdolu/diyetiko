'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';

/*
 * The first visit (DESIGN.md v1.35): a small card in the corner that offers the guide — it does
 * not cover the page or stop anything being used. Answered either way, it does not come back (the
 * guide itself stays in the menu). Remembered in this browser.
 */

const KEY = { portal: 'portal_tour_seen', admin: 'admin_tour_seen' } as const;

const SKIN = {
  portal: {
    card: 'border border-ink/15 bg-paper text-ink shadow-[0_18px_40px_-18px_rgb(15_27_23/0.45)]',
    text: 'text-ink-70',
    start: 'bg-ink text-paper hover:bg-green',
    later: 'text-ink-60 hover:text-ink',
    mark: 'bg-citrus text-ink',
    place: 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-6',
  },
  admin: {
    card: 'border border-a-border bg-a-surface text-a-text shadow-[0_18px_40px_-18px_rgb(0_0_0/0.5)]',
    text: 'text-a-muted',
    start: 'bg-a-accent text-a-accent-text hover:opacity-90',
    later: 'text-a-muted hover:text-a-text',
    mark: 'bg-a-accent text-a-accent-text',
    place: 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-6',
  },
} as const;

export function FirstRun({
  scope,
  href,
  title,
  text,
  start,
  later,
}: {
  scope: keyof typeof KEY;
  href: string;
  title: string;
  text: string;
  start: string;
  later: string;
}) {
  const skin = SKIN[scope];
  const reduced = usePrefersReducedMotion();
  // decided after mount: the server cannot know what this browser remembers
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(KEY[scope]) === '1';
    } catch {
      /* storage blocked: do not nag on every page */
    }
    if (seen) return;
    const id = window.setTimeout(() => setOpen(true), 1400);
    return () => window.clearTimeout(id);
  }, [scope]);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY[scope], '1');
    } catch {
      /* it will be offered again next time */
    }
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="complementary"
          aria-label={title}
          data-first-run=""
          initial={{ opacity: 0, y: reduced ? 0 : 16, scale: reduced ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduced ? 0 : 10 }}
          transition={{ duration: reduced ? 0.15 : 0.4, ease: ease.out }}
          className={cn(
            'no-print fixed end-4 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-[16px] p-4 sm:end-6',
            skin.card,
            skin.place,
          )}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full text-[1.0625rem] font-bold',
                skin.mark,
              )}
            >
              ?
            </span>
            <div className="min-w-0">
              <p className="text-[0.9375rem] leading-tight font-bold">{title}</p>
              <p className={cn('mt-1.5 text-[0.8125rem] leading-relaxed', skin.text)}>{text}</p>
            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className={cn(
                'inline-flex h-9 items-center rounded-pill px-3 text-[0.8125rem] font-semibold transition-colors',
                skin.later,
              )}
            >
              {later}
            </button>
            <Link
              href={href}
              onClick={close}
              className={cn(
                'inline-flex h-9 items-center rounded-pill px-4 text-[0.8125rem] font-semibold transition-colors',
                skin.start,
              )}
            >
              {start}
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
