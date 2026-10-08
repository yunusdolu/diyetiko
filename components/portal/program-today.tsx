'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ease, spring } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { PORTAL_TZ } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';

export interface TodayMeal {
  slot: string;
  label: string;
  /** "08:00" or null */
  time: string | null;
  kcal: number;
  items: string;
  logged: boolean;
}

/** minutes since midnight in the portal's time zone */
function nowMinutes() {
  const p = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: PORTAL_TZ,
  }).formatToParts(new Date());
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return v('hour') * 60 + v('minute');
}
const toMinutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * The programme page's opener (DESIGN.md v1.38): what today asks for. The next meal with a clock
 * that counts down to it, the day's meals as a line that fills as they are logged, the day's
 * energy and macros against the targets, and the week's days as columns with today marked.
 */
export function ProgramToday({
  meals,
  planned,
  targets,
  week,
}: {
  meals: TodayMeal[];
  planned: { kcal: number; protein: number; carb: number; fat: number };
  targets: { kcal: number | null; protein: number | null; carb: number | null; fat: number | null };
  /** the programme's days: energy planned for each, and which one is today */
  week: { label: string; kcal: number; today: boolean }[];
}) {
  const t = useTranslations('portal.programToday');
  const tm = useTranslations('macros');
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(nowMinutes());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const timed = meals.filter((m) => m.time);
  const next =
    now == null
      ? null
      : (timed.find((m) => !m.logged && toMinutes(m.time!) >= now) ??
        meals.find((m) => !m.logged) ??
        null);
  const wait = next?.time && now != null ? toMinutes(next.time) - now : null;
  const done = meals.filter((m) => m.logged).length;
  const peak = Math.max(1, ...week.map((d) => d.kcal));
  const bars = [
    { key: 'kcal', label: t('energy'), value: planned.kcal, target: targets.kcal, unit: 'kcal' },
    {
      key: 'protein',
      label: tm('protein'),
      value: planned.protein,
      target: targets.protein,
      unit: 'g',
    },
    { key: 'carb', label: tm('carb'), value: planned.carb, target: targets.carb, unit: 'g' },
    { key: 'fat', label: tm('fat'), value: planned.fat, target: targets.fat, unit: 'g' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* the next meal */}
      <section className="on-dark relative isolate overflow-clip rounded-[22px] bg-ink p-5 text-paper shadow-[0_18px_30px_-18px_rgb(15_27_23/0.5)] sm:p-6 xl:col-span-5">
        <span
          aria-hidden
          className="pointer-events-none absolute -end-20 -top-24 -z-10 size-[20rem] rounded-full bg-[radial-gradient(circle,rgb(216_242_74/0.2),transparent_62%)] motion-safe:animate-[admin-drift_16s_ease-in-out_infinite_alternate]"
        />
        <p className="label text-sage">{next ? t('next') : t('allDone')}</p>
        {next ? (
          <>
            <h2 className="mt-2 text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">
              {next.label}
              {next.time && <span className="ms-2 num text-[1.125rem] text-sage">{next.time}</span>}
            </h2>
            <p className="mt-1.5 line-clamp-2 text-[0.9375rem] text-paper/80">
              <bdi>{next.items}</bdi>
            </p>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-[0.8125rem]">
              <span className="inline-flex h-7 items-center rounded-pill bg-citrus px-3 font-bold text-ink">
                {wait == null
                  ? t('anytime')
                  : wait <= 0
                    ? t('now')
                    : wait < 60
                      ? t('inMinutes', { n: wait })
                      : t('inHours', { h: Math.floor(wait / 60), m: wait % 60 })}
              </span>
              <span className="num text-paper/70">
                {format.number(next.kcal, { maximumFractionDigits: 0 })} kcal
              </span>
            </p>
          </>
        ) : (
          <p className="mt-2 text-[1.25rem] leading-snug font-bold">{t('allDoneText')}</p>
        )}

        {/* the day as a line of meals */}
        <ol
          className="mt-5 flex items-center gap-1.5"
          aria-label={t('meals', { done, total: meals.length })}
        >
          {meals.map((m, i) => (
            <li key={m.slot} className="min-w-0 flex-1" title={m.label}>
              <span className="block h-1.5 overflow-hidden rounded-pill bg-paper/15">
                <motion.span
                  className="block h-full origin-left rounded-pill bg-citrus rtl:origin-right"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: m.logged ? 1 : 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.6, ease: ease.out, delay: 0.15 + i * 0.08 }
                  }
                />
              </span>
              <span
                className={cn(
                  'mt-1.5 block truncate text-[0.6875rem] font-semibold',
                  m === next ? 'text-citrus' : m.logged ? 'text-paper' : 'text-paper/55',
                )}
              >
                {m.label}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/panel#plan"
            className="inline-flex h-10 items-center rounded-pill bg-paper px-4 text-[0.8125rem] font-bold text-ink transition-transform hover:scale-[1.03] active:scale-95"
          >
            {t('log')}
          </Link>
          <Link
            href="/panel/shopping"
            className="inline-flex h-10 items-center rounded-pill border border-paper/25 px-4 text-[0.8125rem] font-semibold transition-colors hover:border-citrus hover:text-citrus"
          >
            {t('shopping')}
          </Link>
        </p>
      </section>

      {/* the day against its targets */}
      <section className="p-card p-5 sm:p-6 xl:col-span-4">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.01em]">{t('dayTitle')}</h2>
        <ul className="mt-4 space-y-3.5">
          {bars.map((b, i) => {
            const share = b.target ? Math.min(1, b.value / b.target) : null;
            const over = b.target != null && b.value > b.target * 1.1;
            return (
              <li key={b.key}>
                <p className="flex items-baseline justify-between gap-3 text-[0.875rem]">
                  <span className="font-semibold">{b.label}</span>
                  <span className="num whitespace-nowrap">
                    {format.number(b.value, { maximumFractionDigits: 0 })}
                    {b.target != null && (
                      <span className="text-ink-60">
                        {' '}
                        / {format.number(b.target, { maximumFractionDigits: 0 })}
                      </span>
                    )}{' '}
                    {b.unit}
                  </span>
                </p>
                {share != null && (
                  <span className="mt-1.5 block h-2 overflow-hidden rounded-pill bg-ink/10">
                    <motion.span
                      className={cn(
                        'block h-full origin-left rounded-pill rtl:origin-right',
                        over ? 'bg-paprika' : 'bg-green-3',
                      )}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: share }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { duration: 0.8, ease: ease.out, delay: 0.1 + i * 0.07 }
                      }
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* the programme's days */}
      <section className="p-card flex flex-col p-5 sm:p-6 xl:col-span-3">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.01em]">{t('weekTitle')}</h2>
        <ol className="mt-4 flex flex-1 items-end gap-1.5" style={{ minHeight: '7.5rem' }}>
          {week.map((d, i) => (
            <li key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="relative flex h-24 w-full items-end overflow-hidden rounded-[8px] bg-ink/[0.06]">
                <motion.span
                  className={cn(
                    'w-full origin-bottom rounded-[8px]',
                    d.today ? 'bg-ink' : 'bg-green-3/70',
                  )}
                  style={{ height: `${(d.kcal / peak) * 100}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={reduced ? { duration: 0 } : { ...spring.soft, delay: 0.1 + i * 0.05 }}
                  title={`${d.label}: ${format.number(d.kcal, { maximumFractionDigits: 0 })} kcal`}
                />
              </span>
              <span
                className={cn(
                  'max-w-full truncate text-[0.625rem] font-semibold',
                  d.today ? 'text-ink' : 'text-ink-60',
                )}
              >
                {d.label}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[0.75rem] text-ink-60">{t('weekHint')}</p>
      </section>
    </div>
  );
}
