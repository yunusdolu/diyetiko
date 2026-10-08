'use client';

import { motion, useInView } from 'motion/react';
import { useFormatter } from 'next-intl';
import { useId, useRef, useState, type PointerEvent } from 'react';
import { ease } from '@/lib/motion';
import { useDir, usePrefersReducedMotion } from '@/lib/motion/hooks';
import { niceTicks } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';

/*
 * A count over time for the dashboard, laid out by the browser alone: the line is an SVG stretched
 * to its box (strokes do not scale), columns are CSS heights, and every label, dot and grid line
 * is placed in percent. Nothing is measured in JS, so the chart follows its card on every frame —
 * while the sidebar opens or the window is resized — instead of redrawing after the fact.
 * Dataviz rules as elsewhere: one series, recessive grid, text in text tokens, a hover read-out,
 * and the numbers as a table for assistive tech.
 */

type Point = { x: string; y: number | null };

/** a smooth line that never overshoots its points (monotone cubic), in 0…100 × 0…100 */
function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (n < 2) return '';
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1]![0] - pts[i]![0]);
    slope.push((pts[i + 1]![1] - pts[i]![1]) / dx[i]!);
  }
  const m = [slope[0]!];
  for (let i = 1; i < n - 1; i++)
    m.push(slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2);
  m.push(slope[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / slope[i]!;
    const b = m[i + 1]! / slope[i]!;
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * slope[i]!) / h;
      m[i + 1] = (3 * b * slope[i]!) / h;
    }
  }
  let d = `M${pts[0]![0].toFixed(2)} ${pts[0]![1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const k = dx[i]! / 3;
    d += ` C${(x0 + k).toFixed(2)} ${(y0 + m[i]! * k).toFixed(2)} ${(x1 - k).toFixed(2)} ${(y1 - m[i + 1]! * k).toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return d;
}

export function FluidTrend({
  data,
  kind,
  height = 208,
  xLabel,
  yLabel,
  unit,
  decimals = 0,
  goal,
  fromZero = true,
}: {
  data: Point[];
  kind: 'area' | 'bar';
  height?: number;
  xLabel: string;
  yLabel: string;
  /** shown after the value in the read-out ("kg") */
  unit?: string;
  decimals?: number;
  /** a dashed line at this value (a goal weight) */
  goal?: number | null;
  /** counts start at zero; measurements (weights) are framed around their own range */
  fromZero?: boolean;
}) {
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const rtl = useDir() === -1;
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, margin: '-5% 0px' });
  const show = reduced || inView;
  const [hover, setHover] = useState<number | null>(null);
  const gid = `fa${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const n = data.length;
  const nf = (v: number) => format.number(v, { maximumFractionDigits: decimals });
  const values = data.map((d) => d.y).filter((v): v is number => v != null);
  const hi = Math.max(...(values.length ? values : [0]), goal ?? -Infinity);
  const lo = Math.min(...(values.length ? values : [0]), goal ?? Infinity);
  const pad = (hi - lo) * 0.15 || 1;
  const ticks = fromZero
    ? niceTicks(0, Math.max(0, hi) + (Math.max(0, hi) * 0.15 || 1), 4, decimals === 0)
    : niceTicks(lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad, 4, decimals === 0);
  const base = ticks[0] ?? 0;
  const top = ticks.at(-1) ?? 1;
  /** share of the plot's height, 0…1 */
  const level = (v: number) => (top > base ? (v - base) / (top - base) : 0);
  /** the points that have a value, with their place in the series */
  const known = data
    .map((d, i) => ({ i, x: d.x, y: d.y }))
    .filter((d): d is { i: number; x: string; y: number } => d.y != null);
  /** where point i sits along the plot, 0…1 (reading direction aware) */
  const along = (i: number) => {
    const p = kind === 'bar' ? (i + 0.5) / n : n > 1 ? i / (n - 1) : 0.5;
    return rtl ? 1 - p : p;
  };
  // few enough x labels to stay apart at any width; the latest period always shows
  const step = Math.ceil(n / 6);
  const labelled = (i: number) => (n - 1 - i) % step === 0;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    let f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (rtl) f = 1 - f;
    const at = kind === 'bar' ? Math.min(n - 1, Math.floor(f * n)) : f * (n - 1);
    // the nearest point that has a value
    let best: number | null = null;
    for (const d of known) if (best == null || Math.abs(d.i - at) < Math.abs(best - at)) best = d.i;
    setHover(best);
  };

  const line =
    kind === 'area'
      ? monotonePath(known.map((d) => [along(d.i) * 100, 100 - level(d.y) * 100]))
      : '';
  // the path runs with the reading direction; the fill closes along the baseline
  const first = known.length ? along(known[0]!.i) * 100 : 0;
  const last = known.length ? along(known.at(-1)!.i) * 100 : 0;
  const at = hover != null ? data[hover] : undefined;
  const shown = at && at.y != null ? { x: at.x, y: at.y } : null;

  return (
    <div ref={box} dir="ltr">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        {/* y labels, level with their grid lines */}
        <div className="relative" style={{ height }} aria-hidden>
          <span className="invisible block num text-[0.6875rem]">
            {ticks.map(nf).reduce((a, b) => (b.length > a.length ? b : a), '')}
          </span>
          {ticks.map((v) => (
            <span
              key={v}
              className="absolute end-0 translate-y-1/2 num text-[0.6875rem] leading-none text-a-muted"
              style={{ bottom: `calc(${level(v)} * (100% - 16px) + 8px)` }}
            >
              {nf(v)}
            </span>
          ))}
        </div>

        <div
          className="relative touch-pan-y"
          style={{ height }}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* the plot proper: 8 px of air above and below for dots and the top line */}
          <div className="absolute inset-x-1.5 inset-y-2">
            {ticks.map((v) => (
              <span
                key={v}
                aria-hidden
                className="absolute inset-x-0 h-px bg-a-border"
                style={{ bottom: `${level(v) * 100}%` }}
              />
            ))}

            {goal != null && (
              <span
                aria-hidden
                className="absolute inset-x-0 border-t border-dashed border-a-muted"
                style={{ bottom: `${level(goal) * 100}%` }}
              />
            )}

            {kind === 'area' ? (
              <>
                <motion.div
                  className="absolute inset-0"
                  initial={{
                    clipPath: reduced
                      ? 'inset(-10px -10px -10px -10px)'
                      : 'inset(-10px 100% -10px -10px)',
                  }}
                  animate={{
                    clipPath: show
                      ? 'inset(-10px -10px -10px -10px)'
                      : 'inset(-10px 100% -10px -10px)',
                  }}
                  transition={{ duration: reduced ? 0 : 0.9, ease: ease.out }}
                >
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 size-full overflow-visible text-a-chart"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {line && (
                      <>
                        <path d={`${line} L${last} 100 L${first} 100 Z`} fill={`url(#${gid})`} />
                        <path
                          d={line}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </>
                    )}
                  </svg>
                  {known.map((d) => (
                    <span
                      key={d.i}
                      aria-hidden
                      className={cn(
                        'absolute size-[9px] -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-a-chart transition-[background-color,scale] duration-150',
                        hover === d.i ? 'scale-125 bg-a-chart' : 'bg-a-surface',
                      )}
                      style={{ left: `${along(d.i) * 100}%`, bottom: `${level(d.y) * 100}%` }}
                    />
                  ))}
                </motion.div>
                {hover != null && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-px -translate-x-1/2 border-s border-dashed border-a-muted/60"
                    style={{ left: `${along(hover) * 100}%` }}
                  />
                )}
              </>
            ) : (
              <div className={cn('absolute inset-0 flex items-end', rtl && 'flex-row-reverse')}>
                {data.map((d, i) => (
                  <div key={i} className="flex h-full min-w-0 flex-1 items-end justify-center">
                    <motion.span
                      aria-hidden
                      className={cn(
                        'w-[62%] max-w-10 origin-bottom rounded-t-[4px] bg-a-chart transition-opacity duration-150',
                        hover != null && hover !== i && 'opacity-45',
                      )}
                      style={{
                        height: `${level(d.y ?? base) * 100}%`,
                        minHeight: (d.y ?? 0) > 0 ? 3 : 0,
                      }}
                      initial={{ scaleY: reduced ? 1 : 0 }}
                      animate={{ scaleY: show ? 1 : 0 }}
                      transition={{
                        duration: reduced ? 0 : 0.55,
                        ease: ease.out,
                        delay: reduced ? 0 : i * 0.03,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {hover != null && shown && (
              <div
                className={cn(
                  'a-glass a-glass-sm pointer-events-none absolute z-10 mb-3 px-2.5 py-1.5 text-[0.75rem] whitespace-nowrap',
                  along(hover) < 0.2
                    ? 'translate-x-0'
                    : along(hover) > 0.8
                      ? '-translate-x-full'
                      : '-translate-x-1/2',
                )}
                style={{
                  left: `${along(hover) * 100}%`,
                  bottom: `min(${level(shown.y) * 100}%, calc(100% - 3.25rem))`,
                }}
              >
                <p className="text-a-muted">{shown.x}</p>
                <p className="num font-semibold text-a-text">
                  {nf(shown.y)}
                  {unit ? ` ${unit}` : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* x labels under their points */}
        <span />
        <div className="relative mx-1.5 h-5" aria-hidden>
          {data.map(
            (d, i) =>
              labelled(i) && (
                <span
                  key={i}
                  className={cn(
                    'absolute top-1 text-[0.6875rem] leading-none whitespace-nowrap text-a-muted',
                    kind === 'area' && along(i) < 0.02
                      ? 'translate-x-0'
                      : kind === 'area' && along(i) > 0.98
                        ? '-translate-x-full'
                        : '-translate-x-1/2',
                  )}
                  style={{ left: `${along(i) * 100}%` }}
                >
                  {d.x}
                </span>
              ),
          )}
        </div>
      </div>

      <table className="sr-only">
        <caption>{yLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{xLabel}</th>
            <th scope="col">{yLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.x}</th>
              <td>{d.y == null ? '—' : nf(d.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
