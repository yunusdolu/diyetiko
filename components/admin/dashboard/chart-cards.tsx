'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { FluidTrend } from '@/components/admin/fluid-chart';
import { Donut, type DonutSegment } from '@/components/admin/fx';
import { EmptyState } from '@/components/admin/ui';
import { Tabs } from '@/components/ui/tabs';

/** A dashboard card with a title and, at its top end, the chart's time filter. */
function ChartCard({
  title,
  filter,
  children,
}: {
  title: string;
  filter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="a-card">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-a-border px-5 py-2.5">
        <h2 className="py-1 text-[0.9375rem] font-bold">{title}</h2>
        {filter}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** The time filter: a small segmented strip (the same control as the lists' filters). */
function RangeFilter<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return <Tabs size="sm" label={label} value={value} onChange={onChange} items={options} />;
}

/**
 * A count over time (clients per month, requests per week) with its range at the top end:
 * the chart shows the last N periods of the series it was given.
 */
export function TrendCard({
  title,
  series,
  unit,
  ranges,
  initial,
  kind,
  xLabel,
  yLabel,
}: {
  title: string;
  /** oldest first; `at` is the period's first day (YYYY-MM-DD) */
  series: { at: string; count: number }[];
  unit: 'month' | 'week';
  /** how many periods each choice shows, shortest first */
  ranges: readonly number[];
  initial: number;
  kind: 'area' | 'bar';
  xLabel: string;
  yLabel: string;
}) {
  const t = useTranslations('admin.dashboard.range');
  const locale = useLocale() as Locale;
  const [n, setN] = useState(String(initial));
  const fmt = new Intl.DateTimeFormat(
    intlLocale(locale),
    unit === 'month' ? { month: 'short' } : { day: 'numeric', month: 'short' },
  );
  const data = series.slice(-Number(n)).map((p) => ({
    x: fmt.format(new Date(`${p.at}T12:00:00`)),
    y: p.count,
  }));
  return (
    <ChartCard
      title={title}
      filter={
        <RangeFilter
          label={t('label')}
          value={n}
          onChange={setN}
          options={ranges.map((r) => ({
            value: String(r),
            label: t(unit === 'month' ? 'months' : 'weeks', { n: r }),
          }))}
        />
      }
    >
      <FluidTrend kind={kind} height={252} data={data} xLabel={xLabel} yLabel={yLabel} />
    </ChartCard>
  );
}

/** Parts of a whole as a ring with a legend that carries names, numbers and shares. */
function Ring({
  segments,
  totalLabel,
  empty,
}: {
  segments: DonutSegment[];
  totalLabel: string;
  empty: string;
}) {
  const format = useFormatter();
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total) return <EmptyState compact>{empty}</EmptyState>;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
      <Donut segments={segments}>
        <div>
          <p className="num-wide text-[1.75rem] leading-none">{format.number(total)}</p>
          <p className="mt-1 text-[0.6875rem] font-semibold text-a-muted">{totalLabel}</p>
        </div>
      </Donut>
      <ul className="min-w-[9rem] flex-1 space-y-2.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-[0.8125rem]">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="num font-semibold">{format.number(s.value)}</span>
            <span className="w-9 text-end num text-[0.75rem] text-a-muted">
              {format.number(s.value / total, { style: 'percent', maximumFractionDigits: 0 })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Who the practice is working with right now, by status. */
export function ClientMixCard({
  title,
  segments,
  totalLabel,
  empty,
}: {
  title: string;
  segments: DonutSegment[];
  totalLabel: string;
  empty: string;
}) {
  return (
    <ChartCard title={title}>
      <Ring segments={segments} totalLabel={totalLabel} empty={empty} />
    </ChartCard>
  );
}

export interface OutcomeWindow {
  days: 30 | 90 | 365;
  done: number;
  noShow: number;
  cancelled: number;
}

/** How past appointments went — came, did not come, cancelled — over the chosen period. */
export function OutcomesCard({ windows }: { windows: OutcomeWindow[] }) {
  const t = useTranslations('admin.dashboard.outcomes');
  const tr = useTranslations('admin.dashboard.range');
  const format = useFormatter();
  const [days, setDays] = useState('30');
  const w = windows.find((x) => String(x.days) === days) ?? windows[0]!;
  const held = w.done + w.noShow;
  return (
    <ChartCard
      title={t('title')}
      filter={
        <RangeFilter
          label={tr('label')}
          value={days}
          onChange={setDays}
          options={[
            { value: '30', label: tr('months', { n: 1 }) },
            { value: '90', label: tr('months', { n: 3 }) },
            { value: '365', label: tr('year') },
          ]}
        />
      }
    >
      <Ring
        key={days}
        totalLabel={t('total')}
        empty={t('empty')}
        segments={[
          { label: t('done'), value: w.done, color: 'var(--a-chart)' },
          { label: t('noShow'), value: w.noShow, color: 'var(--a-danger)' },
          {
            label: t('cancelled'),
            value: w.cancelled,
            color: 'color-mix(in srgb, var(--a-muted) 55%, transparent)',
          },
        ]}
      />
      {held > 0 && (
        <p className="mt-4 border-t border-a-border pt-3 text-[0.8125rem] text-a-muted">
          {t('rate', {
            rate: format.number(w.done / held, { style: 'percent', maximumFractionDigits: 0 }),
          })}
        </p>
      )}
    </ChartCard>
  );
}
