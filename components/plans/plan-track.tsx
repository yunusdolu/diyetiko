'use client';

import { motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { useStoredValue } from '@/lib/local-store';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { addMonths, type PlanProgress } from '@/lib/plans';
import { cn } from '@/lib/utils';

export type PlanMode = 'day' | 'week' | 'month';
const MODES: readonly PlanMode[] = ['day', 'week', 'month'];
const STORE = 'plan_mode';

/** The panel's colours for the track: the portal's paper and ink, or the dietitian panel's. */
const TONES = {
  portal: {
    track: 'bg-ink/10',
    fill: 'bg-green-3',
    now: 'bg-ink',
    tick: 'bg-ink/25',
    muted: 'text-ink-60',
    pill: 'bg-paper-2',
    pillOn: 'bg-ink text-paper',
  },
  admin: {
    track: 'bg-a-surface-2',
    fill: 'bg-a-chart',
    now: 'bg-a-text',
    tick: 'bg-a-border',
    muted: 'text-a-muted',
    pill: 'bg-a-surface-2',
    pillOn: 'bg-a-text text-a-bg',
  },
} as const;

const dayDate = (d: string) => new Date(`${d}T12:00:00Z`);

/**
 * Where a client is in their plan, as a bar that fills with the days — read by day (one bar, a tick
 * at every month), by week (a segment a week) or by month (a segment a month, each named). The
 * same component on the client's Today and on the dietitian's client page, so both see the same.
 */
export function PlanTrack({
  name,
  startsOn,
  endsOn,
  progress: p,
  tone,
  compact = false,
}: {
  name: string;
  startsOn: string;
  endsOn: string;
  progress: PlanProgress;
  tone: keyof typeof TONES;
  /** a card on a list: the bar and one line, no view switch */
  compact?: boolean;
}) {
  const t = useTranslations('plan');
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const c = TONES[tone];
  // the view last chosen on this device (a convenience: the page works the same without it)
  const [mode, choose] = useStoredValue<PlanMode>(STORE, 'day', MODES);

  const label = p.term ? t('name', { months: p.term }) : name;
  const short = (d: string) =>
    format.dateTime(dayDate(d), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const pct = Math.round(p.share * 100);
  const status =
    p.state === 'upcoming'
      ? p.startsIn === 1
        ? t('startsTomorrow')
        : t('startsIn', { n: p.startsIn })
      : p.state === 'ended'
        ? t('ended')
        : p.daysLeft === 0
          ? t('lastDay')
          : mode === 'week' && p.weeks - p.week > 0
            ? t('weeksLeft', { n: p.weeks - p.week })
            : mode === 'month' && p.months - p.month > 0
              ? t('monthsLeft', { n: p.months - p.month })
              : t('daysLeft', { n: p.daysLeft });
  const counter =
    mode === 'week'
      ? t('weekOf', { week: Math.max(1, p.week), weeks: p.weeks })
      : mode === 'month'
        ? t('monthOf', { month: Math.max(1, p.month), months: p.months })
        : t('dayOf', { day: Math.max(1, p.day), total: p.totalDays });

  const bar = (
    <Bar mode={compact ? 'day' : mode} p={p} startsOn={startsOn} tone={tone} reduced={reduced} />
  );

  if (compact)
    return (
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[0.75rem]">
          <span className="min-w-0 truncate font-semibold">{label}</span>
          <span className={cn('shrink-0 num', c.muted)}>
            {p.state === 'running' ? t('monthOf', { month: p.month, months: p.months }) : status}
          </span>
        </div>
        {bar}
      </div>
    );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-[1.0625rem] leading-tight font-bold">{label}</p>
          <p className={cn('mt-1 text-[0.8125rem]', c.muted)}>
            <span className="num" dir="ltr">
              {t('period', { from: short(startsOn), to: short(endsOn) })}
            </span>
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label={t('modesLabel')}
          className={cn('inline-flex shrink-0 gap-0.5 rounded-pill p-0.5', c.pill)}
        >
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => choose(m)}
              className={cn(
                'h-7 rounded-pill px-3 text-[0.75rem] font-semibold transition-colors',
                mode === m ? c.pillOn : c.muted,
              )}
            >
              {t(`modes.${m}`)}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="num-wide text-[1.5rem] leading-none sm:text-[1.75rem]">{counter}</span>
        <span className={cn('num text-[0.8125rem] font-semibold', c.muted)}>
          {t('share', { pct })}
        </span>
      </p>
      <div className="mt-3">{bar}</div>
      <p className={cn('mt-2.5 text-[0.8125rem]', c.muted)}>{status}</p>
    </div>
  );
}

/** The bar itself: the day's continuous fill, or one segment per week / month. */
function Bar({
  mode,
  p,
  startsOn,
  tone,
  reduced,
}: {
  mode: PlanMode;
  p: PlanProgress;
  startsOn: string;
  tone: keyof typeof TONES;
  reduced: boolean;
}) {
  const t = useTranslations('plan');
  const format = useFormatter();
  const c = TONES[tone];
  const grow = (delay = 0) => ({
    duration: reduced ? 0 : 0.9,
    ease: ease.out,
    delay: reduced ? 0 : delay,
  });
  const a11y = {
    role: 'meter' as const,
    'aria-label': t('progressLabel', { day: Math.max(1, p.day), total: p.totalDays }),
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-valuenow': Math.round(p.share * 100),
  };

  if (mode === 'day') {
    // a tick where each month of the plan begins
    const ticks = Array.from({ length: Math.max(0, p.months - 1) }, (_, i) => {
      const at = addMonths(startsOn, i + 1);
      const d = Math.round(
        (Date.parse(`${at}T12:00:00Z`) - Date.parse(`${startsOn}T12:00:00Z`)) / 864e5,
      );
      return d / p.totalDays;
    });
    return (
      <div {...a11y} className={cn('relative h-3 overflow-hidden rounded-pill', c.track)}>
        <motion.div
          className={cn('h-full origin-left rounded-pill rtl:origin-right', c.fill)}
          initial={{ scaleX: reduced ? p.share : 0 }}
          animate={{ scaleX: p.share }}
          transition={grow()}
        />
        {ticks.map((x, i) => (
          <span
            key={i}
            aria-hidden
            className={cn('absolute inset-y-0.5 w-px', c.tick)}
            style={{ insetInlineStart: `${x * 100}%` }}
          />
        ))}
      </div>
    );
  }

  // weeks or months: how full each segment is
  const segments =
    mode === 'week'
      ? Array.from({ length: p.weeks }, (_, i) => {
          const first = i * 7 + 1;
          const len = Math.min(7, p.totalDays - i * 7);
          return {
            fill: Math.max(0, Math.min(1, (p.day - first + 1) / len)),
            label: null,
            span: null,
          };
        })
      : Array.from({ length: p.months }, (_, i) => {
          const from = addMonths(startsOn, i);
          const to = addMonths(startsOn, i + 1);
          const day0 = Math.round(
            (Date.parse(`${from}T12:00:00Z`) - Date.parse(`${startsOn}T12:00:00Z`)) / 864e5,
          );
          const len = Math.round(
            (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 864e5,
          );
          // a plan's month runs from its start day to the same day a month on, not by the calendar
          const last = new Date(`${to}T12:00:00Z`);
          last.setUTCDate(last.getUTCDate() - 1);
          const md = (d: Date) =>
            format.dateTime(d, { day: 'numeric', month: 'short', timeZone: 'UTC' });
          return {
            fill: Math.max(0, Math.min(1, (p.day - day0) / len)),
            label: p.months > 6 ? String(i + 1) : t('monthN', { n: i + 1 }),
            span: `${md(dayDate(from))} – ${md(last)}`,
          };
        });
  const dense = segments.length > 30;
  return (
    <div>
      <div {...a11y} className={cn('flex', dense ? 'gap-[2px]' : 'gap-1')}>
        {segments.map((s, i) => (
          <div
            key={i}
            className={cn(
              'relative h-3 min-w-0 flex-1 overflow-hidden',
              dense ? 'rounded-[2px]' : 'rounded-pill',
              c.track,
            )}
          >
            <motion.div
              className={cn('h-full origin-left rtl:origin-right', c.fill)}
              initial={{ scaleX: reduced ? s.fill : 0 }}
              animate={{ scaleX: s.fill }}
              transition={grow(Math.min(i, 24) * (dense ? 0.012 : 0.05))}
            />
          </div>
        ))}
      </div>
      {mode === 'month' && segments.length <= 12 && (
        <div className={cn('mt-1.5 flex gap-1 text-[0.6875rem]', c.muted)}>
          {segments.map((s, i) => (
            <span
              key={i}
              className={cn(
                'min-w-0 flex-1 truncate text-center',
                i + 1 === p.month && p.state === 'running' && 'font-semibold text-current',
              )}
            >
              <span title={s.span ?? undefined}>{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
