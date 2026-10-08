'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';

/**
 * The time left to the next meeting, counting down: days, hours and minutes, each figure rolling
 * when it changes. Rendered after mount (the server cannot know the reader's clock).
 */
export function Countdown({ startsAt }: { startsAt: string }) {
  const t = useTranslations('portal.carePrep');
  const reduced = usePrefersReducedMotion();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, []);
  if (now == null) return <div className="h-[4.25rem]" aria-hidden />;
  const left = Math.max(0, Date.parse(startsAt) - now);
  const mins = Math.floor(left / 60_000);
  const parts = [
    { key: 'days', value: Math.floor(mins / 1440) },
    { key: 'hours', value: Math.floor((mins % 1440) / 60) },
    { key: 'minutes', value: mins % 60 },
  ] as const;
  return (
    <dl className="grid grid-cols-3 gap-2" role="timer" aria-label={t('countdown')}>
      {parts.map((p) => (
        <div key={p.key} className="rounded-[14px] bg-paper/10 px-2 py-2.5 text-center">
          <dd className="relative h-8 overflow-hidden num text-[1.75rem] leading-8 font-semibold">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={p.value}
                className="block"
                initial={reduced ? { opacity: 0 } : { y: '-100%' }}
                animate={reduced ? { opacity: 1 } : { y: 0 }}
                exit={reduced ? { opacity: 0 } : { y: '100%' }}
                transition={{ duration: 0.35, ease: ease.out }}
              >
                {String(p.value).padStart(2, '0')}
              </motion.span>
            </AnimatePresence>
          </dd>
          <dt className="mt-0.5 label text-[0.5625rem] text-sage">{t(p.key)}</dt>
        </div>
      ))}
    </dl>
  );
}

const KEY = 'portal_prep';
const ITEMS = ['weigh', 'diary', 'questions', 'labs', 'device'] as const;

/**
 * Getting ready for the meeting: a short list to tick, kept in this browser for that meeting
 * (a new meeting starts a clean list).
 */
export function PrepList({ meeting }: { meeting: string }) {
  const t = useTranslations('portal.carePrep');
  const reduced = usePrefersReducedMotion();
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as {
        meeting: string;
        done: string[];
      } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.meeting === meeting) setDone(saved.done);
    } catch {
      /* nothing remembered */
    }
  }, [meeting]);
  const toggle = (k: string) => {
    const next = done.includes(k) ? done.filter((x) => x !== k) : [...done, k];
    setDone(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ meeting, done: next }));
    } catch {
      /* private mode */
    }
  };
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-ink/10">
          <motion.span
            className="block h-full origin-left rounded-pill bg-green-3 rtl:origin-right"
            initial={false}
            animate={{ scaleX: done.length / ITEMS.length }}
            transition={reduced ? { duration: 0 } : { duration: 0.4, ease: ease.out }}
          />
        </span>
        <span className="num text-[0.8125rem] font-semibold text-ink-60">
          {done.length}/{ITEMS.length}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {ITEMS.map((k) => {
          const on = done.includes(k);
          return (
            <li key={k}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(k)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 py-2 text-start text-[0.9375rem] transition-colors',
                  on ? 'p-well text-ink-60' : 'hover:bg-ink/[0.04]',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
                    on ? 'border-ink bg-ink text-citrus' : 'border-ink/35',
                  )}
                >
                  <svg viewBox="0 0 16 16" width="11" height="11">
                    <motion.path
                      d="M3.5 8.5l3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={false}
                      animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
                      transition={{ duration: reduced ? 0 : 0.28, ease: ease.out }}
                    />
                  </svg>
                </span>
                <span className={cn('min-w-0 flex-1', on && 'line-through decoration-ink/30')}>
                  {t(`items.${k}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[0.75rem] text-ink-60">{t('note')}</p>
    </div>
  );
}
