'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { spring } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { FluidTrend } from '@/components/admin/fluid-chart';
import { NavIcon, type NavKey } from '@/components/admin/nav';
import { AdminTicker } from '@/components/admin/ticker';
import { Tabs } from '@/components/ui/tabs';

export interface OverviewTile {
  key: string;
  label: string;
  icon: NavKey;
  href: string;
  value: number;
  /** against the previous period of the same length; null when there is nothing to compare */
  delta: number | null;
  deltaLabel: string;
  /** oldest first; `at` is the period's first day (YYYY-MM-DD) */
  series: { at: string; count: number }[];
  unit: 'month' | 'week';
  /** how many periods each choice shows, shortest first */
  ranges: readonly number[];
  initial: number;
  kind: 'area' | 'bar';
}

/**
 * The dashboard's opening card: the two numbers the practice runs on, side by side in a well, and
 * the chart of whichever one is being read. Picking a tile lifts it out of the well (the mark
 * slides between them) and the chart below follows. Each tile keeps its own range.
 */
export function OverviewCard({ title, tiles }: { title: string; tiles: OverviewTile[] }) {
  const t = useTranslations('admin.dashboard');
  const tr = useTranslations('admin.dashboard.range');
  const locale = useLocale() as Locale;
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(tiles[0]?.key ?? '');
  const [spans, setSpans] = useState<Record<string, string>>(
    Object.fromEntries(tiles.map((x) => [x.key, String(x.initial)])),
  );
  const tile = tiles.find((x) => x.key === active) ?? tiles[0];
  if (!tile) return null;

  const span = Number(spans[tile.key] ?? tile.initial);
  const fmt = new Intl.DateTimeFormat(
    intlLocale(locale),
    tile.unit === 'month' ? { month: 'short' } : { day: 'numeric', month: 'short' },
  );
  const data = tile.series.slice(-span).map((p) => ({
    x: fmt.format(new Date(`${p.at}T12:00:00`)),
    y: p.count,
  }));

  return (
    <section className="a-card flex h-full flex-col p-3">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-2 pt-1 pb-3">
        <h2 className="text-[0.9375rem] font-bold">{title}</h2>
        <Tabs
          size="sm"
          label={t('range.label')}
          value={String(span)}
          onChange={(v) => setSpans((s) => ({ ...s, [tile.key]: v }))}
          items={tile.ranges.map((n) => ({
            value: String(n),
            label: tr(tile.unit === 'month' ? 'months' : 'weeks', { n }),
          }))}
        />
      </header>

      {/* the two numbers, in a well; the chosen one is lifted out of it */}
      <div role="group" aria-label={title} className="a-well grid grid-cols-2 gap-1.5 p-1.5">
        {tiles.map((x) => {
          const on = x.key === tile.key;
          return (
            <button
              key={x.key}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(x.key)}
              className="group relative min-w-0 rounded-[15px] p-3.5 text-start transition-colors sm:p-5"
            >
              {on && (
                <motion.span
                  layoutId="a-overview-pick"
                  aria-hidden
                  className="a-raised absolute inset-0 rounded-[15px]"
                  transition={reduced ? { duration: 0 } : spring.snappy}
                />
              )}
              <span className="relative block">
                <span
                  className={cn(
                    'flex items-center gap-2 text-[0.8125rem] font-semibold transition-colors',
                    on ? 'text-a-text' : 'text-a-muted group-hover:text-a-text',
                  )}
                >
                  <NavIcon name={x.icon} size={16} />
                  <span className="min-w-0 max-sm:leading-snug sm:truncate">{x.label}</span>
                </span>
                <span className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1 max-sm:block">
                  <span className="num-wide text-[2rem] leading-none sm:text-[2.25rem]">
                    <AdminTicker value={x.value} />
                  </span>
                  <span className="pb-1 max-sm:mt-1.5 max-sm:block max-sm:pb-0">
                    <Delta value={x.delta} same={t('kpi.same')} />
                    <span className="mt-0.5 block text-[0.6875rem] text-a-muted sm:text-[0.75rem]">
                      {x.deltaLabel}
                    </span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* the chart of whichever number is being read */}
      <div className="mt-3 flex-1 px-1 pb-1">
        {data.length ? (
          <FluidTrend
            key={`${tile.key}-${span}`}
            data={data}
            kind={tile.kind}
            height={196}
            xLabel={t('range.label')}
            yLabel={tile.label}
          />
        ) : (
          <p className="py-10 text-center text-[0.875rem] text-a-muted">{t('mix.empty')}</p>
        )}
        <p className="mt-2 px-1 text-end">
          <Link
            href={tile.href}
            className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-a-muted underline-offset-4 transition-colors hover:text-a-text hover:underline"
          >
            {tile.label}
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden className="mirror-rtl">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </p>
      </div>
    </section>
  );
}

/**
 * How the number moved. Here — and only here — the direction is coloured: on these two counts a
 * rise is unambiguously good. The small cards keep their neutral pill, where it is not.
 */
function Delta({ value, same }: { value: number | null; same: string }) {
  const format = useFormatter();
  if (value == null) return null;
  if (value === 0) return <span className="text-[0.75rem] font-semibold text-a-muted">{same}</span>;
  const up = value > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-pill px-1.5 py-px num text-[0.75rem] font-semibold',
        up
          ? 'bg-[color-mix(in_oklab,var(--a-ok)_15%,transparent)] text-a-ok'
          : 'bg-[color-mix(in_oklab,var(--a-danger)_13%,transparent)] text-a-danger',
      )}
    >
      <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden className={up ? '' : 'rotate-180'}>
        <path d="M6 2l4 6H2z" fill="currentColor" />
      </svg>
      {format.number(value, { signDisplay: 'exceptZero' })}
    </span>
  );
}
