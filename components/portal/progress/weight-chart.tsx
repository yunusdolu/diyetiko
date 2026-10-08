'use client';

import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dirOf, intlLocale, type Locale } from '@/lib/i18n/config';
import {
  addDays,
  daysBetween,
  niceTicks,
  weightSummary,
  type WeightPoint,
} from '@/lib/portal/logic';
import { cn } from '@/lib/utils';

/*
 * Weight over time (dataviz rules): ONE axis (kg), two sources told apart by colour AND shape —
 * your check-ins are a 2px line with small dots, clinic measurements are larger diamonds.
 * Goal is a dashed reference line with a direct label. Hover/keyboard crosshair + a table view.
 * Colours: --color-chart-self / --color-chart-clinic (validated against paper).
 */

const M = { top: 18, right: 14, bottom: 30, left: 44 };

const RANGES = [30, 90] as const;

export function WeightChart({
  points: all,
  goal,
  to,
}: {
  points: WeightPoint[];
  goal: number | null;
  to: string;
}) {
  const t = useTranslations('portal.progress');
  const tu = useTranslations('units');
  const locale = useLocale() as Locale;
  const rtl = dirOf(locale) === 'rtl';
  const il = intlLocale(locale);
  const reduce = usePrefersReducedMotion();
  const tableId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  // 30 days by default so recent daily entries are not squeezed; 90 when the last month is empty
  const [range, setRange] = useState<(typeof RANGES)[number]>(() =>
    all.some((p) => daysBetween(p.day, to) < 30) ? 30 : 90,
  );
  const from = addDays(to, -(range - 1));
  const points = all.filter((p) => p.day >= from && p.day <= to);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e!.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [table]);

  const kg = useMemo(
    () => new Intl.NumberFormat(il, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [il],
  );
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(il, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    [il],
  );
  const longFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(il, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    [il],
  );
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

  const self = points.filter((p) => p.source === 'self').sort((a, b) => a.day.localeCompare(b.day));
  const clinic = points
    .filter((p) => p.source === 'clinic')
    .sort((a, b) => a.day.localeCompare(b.day));
  // one hover stop per day that has any value
  const days = [...new Set(points.map((p) => p.day))].sort();

  const height = width && width < 480 ? 230 : 280;
  const values = (points.length ? points : all).map((p) => p.kg).concat(goal != null ? [goal] : []);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const y0 = ticks[0] ?? 0;
  const y1 = ticks[ticks.length - 1] ?? 1;
  const span = Math.max(1, daysBetween(from, to));
  // the y labels sit on the reading-start side: left in LTR, right in RTL
  const x0 = rtl ? M.right : M.left;
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const xOf = (day: string) => {
    const f = Math.min(1, Math.max(0, daysBetween(from, day) / span));
    return rtl ? x0 + plotW * (1 - f) : x0 + plotW * f;
  };
  const yOf = (v: number) => M.top + plotH * (1 - (v - y0) / (y1 - y0 || 1));
  const line = self
    .map((p, i) => `${i ? 'L' : 'M'}${xOf(p.day).toFixed(1)},${yOf(p.kg).toFixed(1)}`)
    .join(' ');
  const xTicks = [0, 1 / 3, 2 / 3, 1].map((f) => {
    const d = new Date(at(from).getTime() + Math.round(span * f) * 864e5)
      .toISOString()
      .slice(0, 10);
    return d;
  });

  const activeDay = active != null ? days[active] : null;
  const activeSelf = activeDay ? self.find((p) => p.day === activeDay) : undefined;
  const activeClinic = activeDay ? clinic.find((p) => p.day === activeDay) : undefined;
  const latest = weightSummary(points)?.latest ?? null;
  const summary = latest
    ? t('chartSummary', { count: points.length, value: kg.format(latest.kg) })
    : t('noWeight');

  function nearest(clientX: number) {
    const el = wrap.current;
    if (!el || !days.length) return;
    const x = clientX - el.getBoundingClientRect().left;
    let best = 0;
    let dist = Infinity;
    days.forEach((d, i) => {
      const dd = Math.abs(xOf(d) - x);
      if (dd < dist) {
        dist = dd;
        best = i;
      }
    });
    setActive(best);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!days.length) return;
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === fwd || e.key === back || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive((cur) => {
        const c = cur ?? days.length - 1;
        if (e.key === 'Home') return 0;
        if (e.key === 'End') return days.length - 1;
        return Math.min(days.length - 1, Math.max(0, c + (e.key === fwd ? 1 : -1)));
      });
    } else if (e.key === 'Escape') setActive(null);
  }

  const legend = (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-ink-70">
      <li className="flex items-center gap-2">
        <svg width="26" height="10" aria-hidden>
          <path d="M1 5h24" stroke="var(--color-chart-self)" strokeWidth="2" />
          <circle
            cx="13"
            cy="5"
            r="3"
            fill="var(--color-paper)"
            stroke="var(--color-chart-self)"
            strokeWidth="2"
          />
        </svg>
        {t('selfReported')}
      </li>
      <li className="flex items-center gap-2">
        <svg width="14" height="14" aria-hidden>
          <rect
            x="3"
            y="3"
            width="8"
            height="8"
            transform="rotate(45 7 7)"
            fill="var(--color-chart-clinic)"
          />
        </svg>
        {t('clinic')}
      </li>
      {goal != null && (
        <li className="flex items-center gap-2">
          <svg width="26" height="10" aria-hidden>
            <path
              d="M1 5h24"
              stroke="var(--color-ink-60)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          </svg>
          {t('goal')}
        </li>
      )}
    </ul>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label={t('rangeLabel')}
          className="inline-flex rounded-pill border-[1.5px] border-ink/15 p-0.5"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => {
                setRange(r);
                setActive(null);
              }}
              className={cn(
                'h-8 rounded-pill px-3.5 text-[0.8125rem] font-semibold transition-colors',
                range === r ? 'bg-ink text-paper' : 'text-ink-70 hover:text-ink',
              )}
            >
              {t('days', { count: r })}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-controls={tableId}
          aria-expanded={table}
          onClick={() => setTable((v) => !v)}
          className="text-[0.8125rem] font-semibold underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
        >
          {table ? t('showChart') : t('showTable')}
        </button>
      </div>
      <div className="mt-4">{legend}</div>

      {table ? (
        <div
          id={tableId}
          className="mt-4 max-h-80 overflow-auto rounded-[12px] border border-ink/10"
        >
          <table className="w-full text-[0.875rem]">
            <thead className="sticky top-0 bg-paper">
              <tr className="text-ink-60">
                <th scope="col" className="px-3 py-2 text-start font-semibold">
                  {t('table.date')}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">
                  {t('selfReported')}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">
                  {t('clinic')}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => {
                const s = self.find((p) => p.day === d);
                const c = clinic.find((p) => p.day === d);
                return (
                  <tr key={d} className="border-t border-ink/10">
                    <th scope="row" className="px-3 py-2 text-start font-normal">
                      {longFmt.format(at(d))}
                    </th>
                    <td className="px-3 py-2 text-end num">
                      {s ? `${kg.format(s.kg)} ${tu('kg')}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-end num">
                      {c ? `${kg.format(c.kg)} ${tu('kg')}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={wrap}
          role="group"
          aria-label={summary}
          tabIndex={days.length ? 0 : -1}
          onKeyDown={onKey}
          onPointerMove={(e) => nearest(e.clientX)}
          onPointerDown={(e) => nearest(e.clientX)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
          onBlur={() => setActive(null)}
          className="relative mt-4 touch-pan-y rounded-[12px] outline-none select-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-paper-2"
          style={{ height }}
        >
          {!points.length && (
            <p className="absolute inset-0 grid place-items-center rounded-[12px] border-[1.5px] border-dashed border-ink/20 px-4 text-center text-ink-60">
              {t('noWeight')}
            </p>
          )}
          {/* direction ltr: the text-anchor values below are physical, not flipped by the page's RTL */}
          {width > 0 && points.length > 0 && (
            <svg
              width={width}
              height={height}
              direction="ltr"
              className="block overflow-visible"
              aria-hidden
            >
              {/* grid + y labels */}
              {ticks.map((v) => (
                <g key={v}>
                  <line
                    x1={x0}
                    x2={x0 + plotW}
                    y1={yOf(v)}
                    y2={yOf(v)}
                    stroke="var(--color-ink)"
                    strokeOpacity={0.09}
                  />
                  <text
                    x={rtl ? x0 + plotW + 8 : x0 - 8}
                    y={yOf(v)}
                    dy="0.32em"
                    textAnchor={rtl ? 'start' : 'end'}
                    className="fill-ink-60 num text-[11px]"
                  >
                    {new Intl.NumberFormat(il, { maximumFractionDigits: 1 }).format(v)}
                  </text>
                </g>
              ))}
              {/* x labels */}
              {xTicks.map((d, i) => (
                <text
                  key={d}
                  x={xOf(d)}
                  y={height - 8}
                  textAnchor={
                    i === 0
                      ? rtl
                        ? 'end'
                        : 'start'
                      : i === xTicks.length - 1
                        ? rtl
                          ? 'start'
                          : 'end'
                        : 'middle'
                  }
                  className="fill-ink-60 text-[11px]"
                >
                  {dayFmt.format(at(d))}
                </text>
              ))}
              {/* goal */}
              {goal != null && (
                <g>
                  <line
                    x1={x0}
                    x2={x0 + plotW}
                    y1={yOf(goal)}
                    y2={yOf(goal)}
                    stroke="var(--color-ink-60)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                  />
                  <text
                    x={rtl ? x0 + 4 : x0 + plotW - 4}
                    y={yOf(goal) - 7}
                    textAnchor={rtl ? 'start' : 'end'}
                    className="fill-ink-70 text-[11px] font-semibold"
                  >
                    {t('goalLine', { value: `${kg.format(goal)} ${tu('kg')}` })}
                  </text>
                </g>
              )}
              {/* crosshair */}
              {activeDay && (
                <line
                  x1={xOf(activeDay)}
                  x2={xOf(activeDay)}
                  y1={M.top - 6}
                  y2={M.top + plotH}
                  stroke="var(--color-ink)"
                  strokeOpacity={0.35}
                  strokeDasharray="3 3"
                />
              )}
              {/* self-reported line */}
              {self.length > 1 && (
                <motion.path
                  d={line}
                  fill="none"
                  stroke="var(--color-chart-self)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduce ? 0 : 0.9, ease: [0.2, 0.7, 0.2, 1] }}
                />
              )}
              {self.map((p) => (
                <circle
                  key={`s${p.day}`}
                  cx={xOf(p.day)}
                  cy={yOf(p.kg)}
                  r={p.day === activeDay ? 5 : self.length > 30 ? 2.5 : 3.5}
                  fill={p.day === activeDay ? 'var(--color-chart-self)' : 'var(--color-paper)'}
                  stroke="var(--color-chart-self)"
                  strokeWidth={2}
                />
              ))}
              {/* clinic diamonds with a paper ring so they read on top of the line */}
              {clinic.map((p) => {
                const s = p.day === activeDay ? 7 : 5.5;
                return (
                  <rect
                    key={`c${p.day}`}
                    x={xOf(p.day) - s}
                    y={yOf(p.kg) - s}
                    width={s * 2}
                    height={s * 2}
                    transform={`rotate(45 ${xOf(p.day)} ${yOf(p.kg)})`}
                    fill="var(--color-chart-clinic)"
                    stroke="var(--color-paper-2)"
                    strokeWidth={2}
                  />
                );
              })}
            </svg>
          )}
          {/* tooltip */}
          <div aria-live="polite" className="pointer-events-none">
            {activeDay && width > 0 && (
              <div
                className="absolute top-0 z-10 min-w-[10.5rem] rounded-[12px] border border-ink/10 bg-paper px-3 py-2 text-[0.8125rem] shadow-[0_10px_30px_-12px_rgb(15_27_23/0.35)]"
                style={
                  xOf(activeDay) > width / 2
                    ? { right: Math.max(0, width - xOf(activeDay) + 12) }
                    : { left: Math.max(0, xOf(activeDay) + 12) }
                }
              >
                <p className="font-semibold">{longFmt.format(at(activeDay))}</p>
                {activeSelf && (
                  <p className="mt-1 flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-ink-70">
                      <span className="size-2 rounded-full bg-chart-self" aria-hidden />
                      {t('selfReported')}
                    </span>
                    <span className="num font-semibold">
                      {kg.format(activeSelf.kg)} {tu('kg')}
                    </span>
                  </p>
                )}
                {activeClinic && (
                  <p className="mt-1 flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-ink-70">
                      <span className="size-2 rotate-45 bg-chart-clinic" aria-hidden />
                      {t('clinic')}
                    </span>
                    <span className="num font-semibold">
                      {kg.format(activeClinic.kg)} {tu('kg')}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <p className={cn('mt-2 text-[0.75rem] text-ink-60', table && 'sr-only')}>{summary}</p>
    </div>
  );
}
