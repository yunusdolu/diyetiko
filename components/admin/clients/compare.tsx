'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { daysBetween } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import type { Measurement } from '@/types/admin';
import { Button } from '@/components/admin/ui';

type MetricKey = Exclude<keyof Measurement, 'id' | 'client_id' | 'measured_at' | 'note'>;

/**
 * Two measurement days side by side — what a client asks for at a follow-up ("how far have I
 * come since the first visit?"). The summary can be copied (to paste into a message); colours
 * stay neutral: a smaller waist is not "green" for everyone.
 */
export function MeasurementCompare({
  measurements,
  metrics,
}: {
  /** oldest first */
  measurements: Measurement[];
  metrics: readonly (readonly [MetricKey, string, string, number])[];
}) {
  const t = useTranslations('admin.measurements');
  const tc = useTranslations('admin.measurements.compare');
  const format = useFormatter();
  const uid = useId();
  const [fromId, setFromId] = useState(measurements[0]?.id ?? '');
  const [toId, setToId] = useState(measurements.at(-1)?.id ?? '');

  if (measurements.length < 2) return <p className="text-[0.875rem] text-a-muted">{tc('need2')}</p>;

  const a = measurements.find((m) => m.id === fromId) ?? measurements[0]!;
  const b = measurements.find((m) => m.id === toId) ?? measurements.at(-1)!;
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const num = (v: number, sign = false) =>
    format.number(v, { maximumFractionDigits: 1, signDisplay: sign ? 'exceptZero' : 'auto' });
  const rows = metrics
    .filter(([k]) => a[k] != null || b[k] != null)
    .map(([k, key, unit]) => {
      const va = a[k] as number | null;
      const vb = b[k] as number | null;
      const delta = va != null && vb != null ? Math.round((vb - va) * 10) / 10 : null;
      return { k, label: t(key as Parameters<typeof t>[0]), unit, va, vb, delta };
    });
  const span = Math.abs(daysBetween(a.measured_at, b.measured_at));

  const copy = async () => {
    const lines = [
      `${day(a.measured_at)} → ${day(b.measured_at)} (${tc('days', { n: span })})`,
      ...rows.map(
        (r) =>
          `${r.label}: ${r.va != null ? num(r.va) : '—'} → ${r.vb != null ? num(r.vb) : '—'}${
            r.delta != null ? ` (${num(r.delta, true)})` : ''
          }`,
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success(tc('copied'));
    } catch {
      toast.error(tc('copy'));
    }
  };

  const picker = (id: string, value: string, set: (v: string) => void, label: string) => (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-[0.75rem] font-semibold text-a-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="h-10 w-full rounded-[10px] border border-a-border bg-a-surface px-2 num text-[0.75rem] sm:px-3 sm:text-[0.875rem]"
      >
        {measurements.map((m) => (
          <option key={m.id} value={m.id}>
            {day(m.measured_at)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* phones: the two days side by side, the copy button under them */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:flex sm:flex-wrap sm:gap-3">
        {picker(`${uid}-a`, a.id, setFromId, tc('from'))}
        <span aria-hidden className="pb-2.5 text-a-muted rtl:-scale-x-100">
          →
        </span>
        {picker(`${uid}-b`, b.id, setToId, tc('to'))}
        <Button size="md" onClick={copy} className="col-span-3 sm:col-span-1">
          {tc('copy')}
        </Button>
      </div>
      <p className="num text-[0.75rem] text-a-muted">{tc('days', { n: span })}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.875rem]">
          <thead>
            <tr className="border-b border-a-border text-[0.75rem] text-a-muted">
              <th className="py-2 text-start font-semibold" />
              <th className="py-2 text-end font-semibold">{tc('from')}</th>
              <th className="py-2 text-end font-semibold">{tc('to')}</th>
              <th className="py-2 text-end font-semibold">{tc('delta')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className="border-b border-a-border last:border-0">
                <th scope="row" className="py-2.5 text-start font-semibold">
                  {r.label}
                </th>
                <td className="py-2.5 text-end num text-a-muted">
                  {r.va != null ? num(r.va) : '—'}
                </td>
                <td className="py-2.5 text-end num">{r.vb != null ? num(r.vb) : '—'}</td>
                <td className="py-2.5 text-end">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`${a.id}-${b.id}`}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 num text-[0.8125rem] font-semibold',
                        r.delta == null || r.delta === 0 ? 'text-a-muted' : 'bg-a-surface-2',
                      )}
                    >
                      {r.delta != null && r.delta !== 0 && (
                        <svg
                          viewBox="0 0 12 12"
                          width="9"
                          height="9"
                          aria-hidden
                          className={r.delta < 0 ? 'rotate-180' : undefined}
                        >
                          <path d="M6 2l4 6H2z" fill="currentColor" />
                        </svg>
                      )}
                      {r.delta != null ? num(r.delta, true) : '—'}
                    </motion.span>
                  </AnimatePresence>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
