'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { addLabsAction, deleteLabAction } from '@/app/admin/_actions/practice';
import type { LabRow } from '@/lib/admin/practice';
import {
  LAB_TESTS,
  homaIr,
  isLabTestKey,
  labSeries,
  type LabFlag,
  type LabSeries,
} from '@/lib/admin/practice-logic';
import { admin } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Badge, Button, EmptyState, Input, Panel, Sheet } from '@/components/admin/ui';
import { Sparkline } from '@/components/admin/fx';
import type { ActionState } from '@/components/ui/status-icon';

/**
 * "Tahliller": blood-work values copied from the lab report, each with that lab's own reference
 * range (never assumed). Every test becomes a card — latest value, where it sits in the range,
 * the change since last time and its history.
 */
export function LabsTab({
  clientId,
  labs,
  today,
}: {
  clientId: string;
  labs: LabRow[] | null;
  today: string;
}) {
  const t = useTranslations('admin.labs');
  const [adding, setAdding] = useState(false);
  const series = useMemo(() => (labs ? labSeries(labs) : []), [labs]);
  const homa = useMemo(() => (labs ? homaIr(labs) : null), [labs]);
  const format = useFormatter();

  if (!labs)
    return (
      <EmptyState>
        <span className="text-a-text">{t('migration')}</span>
      </EmptyState>
    );

  const out = series.filter((s) => s.flag === 'low' || s.flag === 'high');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {series.length ? (
            out.length ? (
              <p className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                <span className="font-semibold">{t('outOfRange', { n: out.length })}</span>
                {out.map((s) => (
                  <Badge key={s.test} tone="danger">
                    {testName(t, s.test)} {s.flag === 'high' ? '↑' : '↓'}
                  </Badge>
                ))}
              </p>
            ) : series.some((s) => s.flag) ? (
              // only when the reports gave ranges to compare with
              <p className="text-[0.875rem] text-a-muted">{t('allInRange')}</p>
            ) : null
          ) : null}
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          {t('add')}
        </Button>
      </div>

      {!series.length ? (
        <EmptyState>{t('empty')}</EmptyState>
      ) : (
        <motion.ul layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {homa && (
            <motion.li
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[16px] border border-dashed border-a-border bg-a-surface p-4"
            >
              <p className="text-[0.8125rem] font-semibold text-a-muted">HOMA-IR</p>
              <p className="mt-2 num-wide text-[1.75rem] leading-none">
                {format.number(homa.value, { maximumFractionDigits: 2 })}
              </p>
              <p className="mt-2 text-[0.75rem] text-a-muted">
                {t('homa', {
                  date: format.dateTime(new Date(`${homa.taken_on}T12:00:00`), {
                    dateStyle: 'medium',
                  }),
                })}
              </p>
            </motion.li>
          )}
          {series.map((s, i) => (
            <LabCard key={s.test} series={s} index={i} clientId={clientId} />
          ))}
        </motion.ul>
      )}

      <LabSheet
        open={adding}
        onOpenChange={setAdding}
        clientId={clientId}
        today={today}
        previous={series}
      />
    </div>
  );
}

type T = ReturnType<typeof useTranslations<'admin.labs'>>;
export const testName = (t: T, test: string) => (isLabTestKey(test) ? t(`tests.${test}`) : test);

const FLAG_TONE: Record<LabFlag, 'danger' | 'ok'> = { low: 'danger', high: 'danger', ok: 'ok' };

function RangeBar({
  value,
  low,
  high,
}: {
  value: number;
  low: number | null;
  high: number | null;
}) {
  // the range sits in the middle half of the bar; the dot shows where the value falls
  const lo = low ?? 0;
  const hi = high ?? lo * 2;
  if (hi <= lo) return null;
  const span = hi - lo;
  const pos = Math.max(0.02, Math.min(0.98, 0.25 + ((value - lo) / span) * 0.5));
  const off = value < lo || value > hi;
  return (
    <div className="relative mt-3 h-1.5 rounded-pill bg-a-surface-2" aria-hidden>
      <span className="absolute inset-y-0 start-1/4 end-1/4 rounded-pill bg-[color-mix(in_oklab,var(--a-ok)_35%,transparent)]" />
      <motion.span
        className={cn(
          'absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-a-surface ltr:-translate-x-1/2 rtl:translate-x-1/2',
          off ? 'bg-a-danger' : 'bg-a-ok',
        )}
        initial={{ insetInlineStart: '50%', scale: 0 }}
        animate={{ insetInlineStart: `${pos * 100}%`, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      />
    </div>
  );
}

function LabCard({
  series: s,
  index,
  clientId,
}: {
  series: LabSeries;
  index: number;
  clientId: string;
}) {
  const t = useTranslations('admin.labs');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const num = (n: number) => format.number(n, { maximumFractionDigits: 3 });
  const date = (d: string) => format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
  const delta = s.previous ? s.latest.value - s.previous.value : null;
  const { ref_low: low, ref_high: high } = s.latest;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...admin.spring, delay: Math.min(index, 8) * 0.035 }}
      className={cn(
        'rounded-[16px] border bg-a-surface p-4',
        s.flag === 'low' || s.flag === 'high' ? 'border-a-danger/45' : 'border-a-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[0.875rem] font-bold break-words">{testName(t, s.test)}</p>
        {s.flag && <Badge tone={FLAG_TONE[s.flag]}>{t(`flag.${s.flag}`)}</Badge>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="num-wide text-[1.75rem] leading-none">
          {num(s.latest.value)}
          {s.unit && (
            <span className="ms-1 text-[0.8125rem] font-semibold text-a-muted">{s.unit}</span>
          )}
        </p>
        {delta != null && delta !== 0 && (
          <span className="num text-[0.8125rem] font-semibold text-a-muted">
            {delta > 0 ? '▲' : '▼'} {num(Math.abs(delta))}
          </span>
        )}
      </div>
      {(low != null || high != null) && (
        <>
          <RangeBar value={s.latest.value} low={low} high={high} />
          <p className="mt-1.5 text-[0.75rem] text-a-muted">
            {t('range')}:{' '}
            <span className="num">
              {low != null ? num(low) : '…'} – {high != null ? num(high) : '…'}
            </span>
          </p>
        </>
      )}
      {s.samples.length > 1 && (
        <Sparkline
          values={s.samples.map((x) => x.value)}
          height={36}
          className="mt-3 text-a-chart"
        />
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 text-[0.75rem] font-semibold text-a-muted hover:text-a-text"
      >
        <span className="num">{date(s.latest.taken_on)}</span> ·{' '}
        {t('history', { n: s.samples.length })} {open ? '▴' : '▾'}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {[...s.samples].reverse().map((x) => (
              <li
                key={(x as LabRow).id}
                className="flex items-center justify-between gap-2 border-t border-a-border py-1.5 text-[0.8125rem]"
              >
                <span className="num text-a-muted">{date(x.taken_on)}</span>
                <span className="num font-semibold">
                  {num(x.value)} {x.unit}
                </span>
                <button
                  type="button"
                  className="text-[0.75rem] font-semibold text-a-muted hover:text-a-danger"
                  onClick={async () => {
                    if (!window.confirm(t('deleteConfirm'))) return;
                    const res = await deleteLabAction(clientId, (x as LabRow).id);
                    if (!res.ok) return toast.error(tc('error'));
                    toast.success(tc('deleted'));
                    router.refresh();
                  }}
                >
                  {tc('delete')}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

interface Draft {
  key: string;
  test: string;
  custom: boolean;
  value: string;
  unit: string;
  ref_low: string;
  ref_high: string;
}

/**
 * One report at a time: the date, then a value for any of the usual tests (units filled in, the
 * range remembered from this client's previous report) and any other test by name.
 */
function LabSheet({
  open,
  onOpenChange,
  clientId,
  today,
  previous,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  today: string;
  previous: LabSeries[];
}) {
  const t = useTranslations('admin.labs');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const fresh = (): Draft[] =>
    LAB_TESTS.map((x) => {
      const last = previous.find((s) => s.test === x.key)?.latest;
      return {
        key: x.key,
        test: x.key,
        custom: false,
        value: '',
        unit: last?.unit ?? x.unit,
        ref_low: last?.ref_low != null ? String(last.ref_low) : '',
        ref_high: last?.ref_high != null ? String(last.ref_high) : '',
      };
    });
  const [rows, setRows] = useState<Draft[]>(fresh);
  const [takenOn, setTakenOn] = useState(today);
  const [note, setNote] = useState('');
  const set = (i: number, patch: Partial<Draft>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const filled = rows.filter((r) => r.value.trim() && r.test.trim());

  const save = async () => {
    if (!filled.length) return;
    setState('loading');
    const res = await addLabsAction(clientId, {
      taken_on: takenOn,
      note,
      rows: filled.map(({ test, value, unit, ref_low, ref_high }) => ({
        test: test.trim(),
        value,
        unit,
        ref_low,
        ref_high,
      })),
    });
    if (!res.ok) {
      // "rows.3.value" → the 4th filled row
      const bad = new Set<number>();
      for (const k of Object.keys(res.fieldErrors ?? {})) {
        const m = /^rows\.(\d+)/.exec(k);
        if (m) bad.add(rows.indexOf(filled[Number(m[1])]!));
      }
      setFailed(bad);
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    toast.success(tc('saved'));
    router.refresh();
    setTimeout(() => {
      setState('idle');
      setFailed(new Set());
      setRows(fresh());
      setNote('');
      onOpenChange(false);
    }, 400);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('add')}
      description={t('addHint')}
      width="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-[0.8125rem] text-a-muted">{t('filled', { n: filled.length })}</span>
          <div className="flex gap-2">
            <Button onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
            <Button variant="primary" state={state} disabled={!filled.length} onClick={save}>
              {tc('save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          type="date"
          label={t('takenOn')}
          value={takenOn}
          max={today}
          onChange={(e) => setTakenOn(e.target.value)}
          required
        />
        <Input
          label={t('note')}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="mt-5 hidden grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-2 px-1 text-[0.6875rem] font-semibold tracking-wide text-a-muted uppercase sm:grid">
        <span>{t('test')}</span>
        <span>{t('value')}</span>
        <span>{t('unit')}</span>
        <span>{t('refLow')}</span>
        <span>{t('refHigh')}</span>
      </div>
      <ul className="mt-2 space-y-2">
        {rows.map((r, i) => {
          const label = r.custom
            ? r.test || t('customName')
            : t(`tests.${r.test as (typeof LAB_TESTS)[number]['key']}`);
          return (
            <li
              key={r.key}
              className={cn(
                'grid grid-cols-2 gap-2 rounded-[12px] border p-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] sm:items-center sm:border-0 sm:p-0',
                failed.has(i)
                  ? 'border-a-danger sm:bg-[color-mix(in_oklab,var(--a-danger)_8%,transparent)]'
                  : 'border-a-border',
                r.value.trim() && 'sm:bg-a-surface-2/60',
              )}
            >
              {r.custom ? (
                <input
                  aria-label={t('customName')}
                  placeholder={t('customName')}
                  value={r.test}
                  maxLength={80}
                  onChange={(e) => set(i, { test: e.target.value })}
                  className={cell}
                />
              ) : (
                <span className="col-span-2 px-1 text-[0.875rem] font-semibold sm:col-span-1">
                  {label}
                </span>
              )}
              <input
                aria-label={`${label} · ${t('value')}`}
                inputMode="decimal"
                placeholder={t('value')}
                value={r.value}
                onChange={(e) => set(i, { value: e.target.value })}
                className={cn(cell, 'font-semibold')}
              />
              <input
                aria-label={`${label} · ${t('unit')}`}
                placeholder={t('unit')}
                value={r.unit}
                maxLength={20}
                onChange={(e) => set(i, { unit: e.target.value })}
                className={cell}
              />
              <input
                aria-label={`${label} · ${t('refLow')}`}
                inputMode="decimal"
                placeholder={t('refLow')}
                value={r.ref_low}
                onChange={(e) => set(i, { ref_low: e.target.value })}
                className={cell}
              />
              <input
                aria-label={`${label} · ${t('refHigh')}`}
                inputMode="decimal"
                placeholder={t('refHigh')}
                value={r.ref_high}
                onChange={(e) => set(i, { ref_high: e.target.value })}
                className={cell}
              />
            </li>
          );
        })}
      </ul>
      <Button
        className="mt-3"
        size="sm"
        onClick={() =>
          setRows((r) => [
            ...r,
            {
              key: `custom-${r.length}`,
              test: '',
              custom: true,
              value: '',
              unit: '',
              ref_low: '',
              ref_high: '',
            },
          ])
        }
      >
        + {t('addCustom')}
      </Button>
    </Sheet>
  );
}

const cell =
  'h-9 w-full min-w-0 rounded-[8px] border border-a-border bg-a-surface px-2 text-[0.875rem] text-a-text outline-none placeholder:text-a-muted/60 focus:border-a-text';

export function LabsPanelSummary({ labs }: { labs: LabRow[] }) {
  // used by the overview: the out-of-range values of the latest reports, at a glance
  const t = useTranslations('admin.labs');
  const series = labSeries(labs).filter((s) => s.flag === 'low' || s.flag === 'high');
  if (!series.length) return null;
  return (
    <Panel title={t('outOfRange', { n: series.length })}>
      <ul className="flex flex-wrap gap-2">
        {series.map((s) => (
          <li key={s.test}>
            <Badge tone="danger">
              {testName(t, s.test)} {s.flag === 'high' ? '↑' : '↓'}
            </Badge>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
