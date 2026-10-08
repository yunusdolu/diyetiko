'use client';

import { useLocale } from 'next-intl';
import { useId, useState } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { FluidTrend } from './fluid-chart';

/*
 * Admin charts (dataviz rules): one series per chart (single axis), 2px line, recessive grid,
 * rounded bar ends, text in text tokens, a hover read-out, a table view for every chart. The
 * drawing itself is FluidTrend: laid out by the browser, so it follows its card on every frame.
 * Series colour --a-chart is validated per theme (light #2e7d4f / dark #7fa126).
 */

type Point = { x: string; y: number | null };

function DataTable({
  data,
  xLabel,
  yLabel,
  format,
}: {
  data: Point[];
  xLabel: string;
  yLabel: string;
  format: (v: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="text-[0.75rem] font-semibold text-a-muted underline-offset-4 hover:underline"
      >
        {open ? '−' : '+'} {xLabel} / {yLabel}
      </button>
      {open && (
        <table id={id} className="mt-2 w-full num text-[0.75rem]">
          <thead>
            <tr className="text-a-muted">
              <th className="py-1 text-start font-semibold">{xLabel}</th>
              <th className="py-1 text-end font-semibold">{yLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.x} className="border-t border-a-border">
                <td className="py-1">{d.x}</td>
                <td className="py-1 text-end">{d.y == null ? '—' : format(d.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function TrendChart({
  data,
  height = 220,
  unit,
  decimals = 0,
  goal,
  xLabel,
  yLabel,
  kind = 'area',
}: {
  data: Point[];
  height?: number;
  unit?: string;
  decimals?: number;
  goal?: number | null;
  xLabel: string;
  yLabel: string;
  kind?: 'area' | 'bar';
}) {
  const locale = useLocale() as Locale;
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: decimals });
  const format = (v: number) => nf.format(v);
  return (
    <div>
      <FluidTrend
        data={data}
        kind={kind}
        height={height}
        unit={unit}
        decimals={decimals}
        goal={goal}
        // counts start at zero; measurements are framed around their own range
        fromZero={kind === 'bar'}
        xLabel={xLabel}
        yLabel={yLabel}
      />
      <DataTable data={data} xLabel={xLabel} yLabel={yLabel} format={format} />
    </div>
  );
}
