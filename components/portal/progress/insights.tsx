'use client';

import { motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { ease, spring } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';

export interface Journey {
  start: number;
  now: number;
  goal: number;
  /** 0…1 of the way from start to goal */
  share: number;
  /** kg per week over the recent weeks (negative = losing); null without enough entries */
  pace: number | null;
  /** the day the goal is reached at this pace (YYYY-MM-DD); null when it is not approaching */
  eta: string | null;
}

/**
 * The way to the goal weight: where it began, where it is, where it is going — the marker travels
 * along the track — with the recent pace and, when the weight is moving toward the goal, the date
 * that pace arrives at. A direction read from the entries, not a promise.
 */
export function GoalJourney({ journey }: { journey: Journey }) {
  const t = useTranslations('portal.insights');
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const kg = (v: number) =>
    format.number(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const left = Math.abs(journey.now - journey.goal);
  const reached = journey.share >= 1;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['start', journey.start, false],
            ['now', journey.now, true],
            ['goal', journey.goal, false],
          ] as const
        ).map(([k, v, on]) => (
          <div
            key={k}
            className={cn('rounded-[14px] px-2 py-3', on ? 'bg-ink text-paper' : 'p-well')}
          >
            <p className={cn('label text-[0.5625rem]', on ? 'text-sage' : 'text-ink-60')}>{t(k)}</p>
            <p className="mt-1 num text-[1.375rem] leading-none font-semibold">
              {kg(v)}
              <span className="ms-1 text-[0.6875rem] font-normal">kg</span>
            </p>
          </div>
        ))}
      </div>

      <div dir="ltr" className="relative mt-6 h-2.5 rounded-pill bg-ink/10">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-pill bg-green-3"
          initial={{ width: 0 }}
          animate={{ width: `${journey.share * 100}%` }}
          transition={reduced ? { duration: 0 } : { duration: 1.1, ease: ease.out, delay: 0.15 }}
        />
        <motion.span
          className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink ring-[3px] ring-[var(--p-surface)]"
          initial={{ left: 0 }}
          animate={{ left: `${journey.share * 100}%` }}
          transition={reduced ? { duration: 0 } : { duration: 1.1, ease: ease.out, delay: 0.15 }}
        >
          <span className="size-1.5 rounded-full bg-citrus" />
        </motion.span>
      </div>
      <p className="mt-2 flex justify-between num text-[0.75rem] text-ink-60">
        <span>{format.number(journey.share, { style: 'percent', maximumFractionDigits: 0 })}</span>
        <span>{reached ? t('reached') : t('left', { kg: kg(left) })}</span>
      </p>

      <ul className="mt-4 flex flex-wrap gap-2 text-[0.8125rem]">
        {journey.pace != null && (
          <li className="rounded-pill bg-ink/[0.06] px-3 py-1.5">
            {t('pace')}:{' '}
            <span className="num font-semibold" dir="ltr">
              {format.number(journey.pace, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
                signDisplay: 'exceptZero',
              })}{' '}
              kg
            </span>{' '}
            {t('perWeek')}
          </li>
        )}
        {journey.eta && !reached && (
          <li className="rounded-pill bg-citrus px-3 py-1.5 font-semibold">
            {t('eta', {
              date: format.dateTime(new Date(`${journey.eta}T12:00:00Z`), {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }),
            })}
          </li>
        )}
      </ul>
      {journey.eta && !reached && <p className="mt-2 text-[0.75rem] text-ink-60">{t('etaHint')}</p>}
    </div>
  );
}

export interface Badge {
  key: 'first' | 'streak7' | 'streak30' | 'water7' | 'move150' | 'kilo1' | 'half' | 'goal';
  earned: boolean;
  /** 0…1 toward it */
  progress: number;
}

const GLYPH: Record<Badge['key'], string> = {
  first: 'M5 12.5l4.5 4.5L19 7.5',
  streak7: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 1.5-4.5C10 10 11 8 12 3Z',
  streak30: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.400 3.1 1.3-6L3.400 9.300l6-.7L12 3Z',
  water7:
    'M12 3.500c3 3.800 5.500 6.800 5.500 10a5.500 5.500 0 0 1-11 0c0-3.200 2.500-6.200 5.500-10Z',
  move150:
    'M13 4a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3ZM7 21l3-6-2-3 2-5 4 2 3 1M10 12l4 2 1 7',
  kilo1: 'M4 8h16l-1.500 12h-13L4 8ZM9 8a3 3 0 0 1 6 0',
  half: 'M12 21a9 9 0 1 0 0-18v18Z',
  goal: 'M5 21V4M5 5h11l-2 3.500 2 3.500H5',
};

/** Milestones read from the client's own entries. Earned ones pop in; the rest show how far. */
export function Achievements({ badges }: { badges: Badge[] }) {
  const t = useTranslations('portal.insights.badges');
  const reduced = usePrefersReducedMotion();
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {badges.map((b, i) => (
        <motion.li
          key={b.key}
          initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduced ? { duration: 0.15 } : { ...spring.snappy, delay: 0.05 + i * 0.05 }}
          className={cn(
            'relative overflow-hidden rounded-[16px] p-3.5',
            b.earned ? 'bg-ink text-paper' : 'p-well',
          )}
        >
          <span
            className={cn(
              'grid size-9 place-items-center rounded-full',
              b.earned ? 'bg-citrus text-ink' : 'bg-ink/10 text-ink-60',
            )}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d={GLYPH[b.key]}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="mt-2.5 text-[0.875rem] leading-tight font-bold">{t(`${b.key}.title`)}</p>
          <p
            className={cn(
              'mt-0.5 text-[0.75rem] leading-snug',
              b.earned ? 'text-sage' : 'text-ink-60',
            )}
          >
            {t(`${b.key}.text`)}
          </p>
          {!b.earned && (
            <span className="mt-2.5 block h-1 overflow-hidden rounded-pill bg-ink/10" aria-hidden>
              <motion.span
                className="block h-full origin-left rounded-pill bg-green-3 rtl:origin-right"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: b.progress }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: 0.7, ease: ease.out, delay: 0.2 + i * 0.05 }
                }
              />
            </span>
          )}
          <span className="sr-only">{b.earned ? t('earned') : t('locked')}</span>
        </motion.li>
      ))}
    </ul>
  );
}
