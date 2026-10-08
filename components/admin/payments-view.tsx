'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { deletePaymentAction } from '@/app/admin/_actions/practice';
import type { Ledger, LedgerPayment, PackageRow } from '@/lib/admin/practice';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/admin/practice-logic';
import { admin } from '@/lib/motion';
import { Avatar, Meter } from '@/components/admin/fx';
import { Button, EmptyState, PageTitle, Panel } from '@/components/admin/ui';
import { Amounts, Figure, PaymentSheet, sumBy, useMoney } from '@/components/admin/clients/billing';
import { DateFilter, useDateRange } from '@/components/admin/date-filter';
import { SearchPill } from '@/components/admin/search-pill';
import { Tabs } from '@/components/ui/tabs';

/** the list's columns from md up: date · client · package · method · amount · delete */
const COLS =
  'md:grid md:grid-cols-[6.5rem_minmax(0,1.3fr)_minmax(0,1fr)_6.5rem_minmax(6.5rem,auto)_2.5rem] md:items-center md:gap-4';

/**
 * "Ödemeler": every client's payments in one list — filtered by date, payment method and name,
 * grouped by month with the month's total — next to what is still owed on open packages. A
 * payment can be recorded here for any client; the same record shows on the client's own page.
 */
export function PaymentsView({ ledger, today }: { ledger: Ledger | null; today: string }) {
  const t = useTranslations('admin.payments');
  const tb = useTranslations('admin.billing');
  const tc = useTranslations('admin.common');
  const td = useTranslations('admin.dateRange');
  const format = useFormatter();
  const locale = useLocale();
  const money = useMoney();
  const { range, setRange, within } = useDateRange('1m');
  const [method, setMethod] = useState<'all' | PaymentMethod>('all');
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLocaleLowerCase(locale));
  // a fresh sheet for every opening: the client chosen last time must not stick
  const [sheet, setSheet] = useState<{ n: number; open: boolean; pkg: PackageRow | null }>({
    n: 0,
    open: false,
    pkg: null,
  });
  const openSheet = (pkg: PackageRow | null) => setSheet((s) => ({ n: s.n + 1, open: true, pkg }));

  if (!ledger)
    return (
      <div>
        <PageTitle title={t('title')} />
        <EmptyState>
          <span className="text-a-text">{tb('migration')}</span>
        </EmptyState>
      </div>
    );

  const shown = ledger.payments.filter(
    (p) =>
      within(p.paid_on) &&
      (method === 'all' || p.method === method) &&
      (!q ||
        [p.client_name, p.package_name ?? '', p.note ?? '']
          .join(' ')
          .toLocaleLowerCase(locale)
          .includes(q)),
  );
  const months = groupByMonth(shown);
  const owedTotal = sumBy(ledger.owed.map((p) => ({ amount: p.due!, currency: p.currency })));
  const monthName = (ym: string) =>
    format.dateTime(new Date(`${ym}-15T12:00:00`), { month: 'long', year: 'numeric' });

  return (
    <div>
      <PageTitle
        title={t('title')}
        eyebrow={t('count', { count: ledger.payments.length })}
        actions={
          <>
            <Button
              disabled={!shown.length}
              onClick={() =>
                downloadCsv(
                  shown.map((p) => ({ ...p, methodLabel: tb(`methods.${p.method}`) })),
                  [
                    t('cols.date'),
                    t('cols.client'),
                    t('cols.package'),
                    t('cols.method'),
                    t('cols.amount'),
                    tb('currency'),
                    tb('note'),
                  ],
                  `${t('file')}-${today}.csv`,
                )
              }
            >
              {tc('exportCsv')}
            </Button>
            <Button variant="primary" onClick={() => openSheet(null)}>
              {tb('recordPayment')}
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Figure label={t('received')} tone="ok">
          <Amounts list={sumBy(shown)} money={money} empty="—" />
          <span className="mt-1 block text-[0.75rem] text-a-muted">{td(range)}</span>
        </Figure>
        <Figure label={t('records')}>
          <span className="num-wide text-[1.5rem] leading-tight">{shown.length}</span>
          <span className="mt-1 block text-[0.75rem] text-a-muted">
            {t('clientsPaid', { count: new Set(shown.map((p) => p.client_id)).size })}
          </span>
        </Figure>
        <Figure label={t('owed')} tone={owedTotal.length ? 'danger' : undefined}>
          <Amounts list={owedTotal} money={money} empty={tb('settled')} />
          {ledger.owed.length > 0 && (
            <span className="mt-1 block text-[0.75rem] text-a-muted">
              {t('owedCount', { count: ledger.owed.length })}
            </span>
          )}
        </Figure>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchPill
          value={query}
          onChange={setQuery}
          placeholder={t('searchPlaceholder')}
          label={tc('search')}
        />
        <DateFilter value={range} onChange={setRange} />
        <Tabs
          label={tb('method')}
          value={method}
          onChange={setMethod}
          items={[
            { value: 'all', label: tc('all') },
            ...PAYMENT_METHODS.map((m) => ({ value: m, label: tb(`methods.${m}`) })),
          ]}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title={t('list')} padded={false}>
          {!shown.length ? (
            <EmptyState compact>
              {ledger.payments.length ? t('emptyRange') : tb('noPayments')}
            </EmptyState>
          ) : (
            <div data-testid="payments-list">
              <div
                className={`hidden border-b border-a-border px-5 py-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-a-muted uppercase ${COLS}`}
              >
                <span>{t('cols.date')}</span>
                <span>{t('cols.client')}</span>
                <span>{t('cols.package')}</span>
                <span>{t('cols.method')}</span>
                <span className="text-end">{t('cols.amount')}</span>
                <span />
              </div>
              {months.map(([ym, rows]) => (
                <section key={ym} aria-label={monthName(ym)}>
                  <h3 className="flex items-baseline justify-between gap-3 border-b border-a-border bg-a-surface-2 px-5 py-2 text-[0.8125rem] font-bold">
                    <span className="first-letter:uppercase">{monthName(ym)}</span>
                    {/* under the amount column (the delete column and its gap lie beyond) */}
                    <span className="num text-a-muted md:pe-14">
                      {sumBy(rows)
                        .map((x) => money(x.amount, x.currency))
                        .join(' + ')}
                    </span>
                  </h3>
                  <ul className="divide-y divide-a-border border-b border-a-border last:border-b-0">
                    <AnimatePresence initial={false}>
                      {rows.map((p) => (
                        <PaymentLine key={p.id} p={p} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('owedTitle')} padded={false}>
          {!ledger.owed.length ? (
            <EmptyState compact>{t('nothingOwed')}</EmptyState>
          ) : (
            <ul className="divide-y divide-a-border" data-testid="owed-list">
              {ledger.owed.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={p.client_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/clients/${p.client_id}?tab=billing`}
                      className="block truncate font-semibold hover:underline"
                    >
                      {p.client_name}
                    </Link>
                    <p className="truncate text-[0.75rem] text-a-muted">{p.name}</p>
                    {p.price != null && p.price > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <Meter
                          value={p.paid / p.price}
                          className="h-1.5 max-w-[9rem] flex-1"
                          barClassName="bg-a-ok"
                        />
                        <span className="num text-[0.6875rem] whitespace-nowrap text-a-muted">
                          {money(p.paid, p.currency)} / {money(p.price, p.currency)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="num-wide font-semibold whitespace-nowrap text-a-danger">
                      {money(p.due!, p.currency)}
                    </span>
                    <Button size="sm" onClick={() => openSheet(p)}>
                      {tb('takePayment')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <PaymentSheet
        key={sheet.n}
        clientId={null}
        clients={ledger.clients}
        today={today}
        packages={[]}
        preset={sheet.pkg}
        open={sheet.open}
        onOpenChange={(o) => !o && setSheet((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}

function PaymentLine({ p }: { p: LedgerPayment }) {
  const t = useTranslations('admin.billing');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const money = useMoney();
  const router = useRouter();
  const date = format.dateTime(new Date(`${p.paid_on}T12:00:00`), { dateStyle: 'medium' });
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: admin.dur }}
      className={`group flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 transition-colors hover:bg-a-surface-2 ${COLS}`}
    >
      <span className="order-3 num text-[0.8125rem] text-a-muted md:order-none">{date}</span>
      <Link
        href={`/admin/clients/${p.client_id}?tab=billing`}
        className="order-1 flex min-w-0 flex-1 basis-[60%] items-center gap-2.5 font-semibold hover:underline md:order-none"
      >
        <Avatar name={p.client_name} size={28} />
        <span className="truncate">{p.client_name}</span>
      </Link>
      <span className="order-4 min-w-0 truncate text-[0.8125rem] text-a-muted md:order-none">
        {p.package_name ?? t('noPackage')}
        {p.note && ` · ${p.note}`}
      </span>
      <span className="order-5 text-[0.8125rem] md:order-none">{t(`methods.${p.method}`)}</span>
      <span className="order-2 num-wide font-semibold whitespace-nowrap md:order-none md:text-end">
        {money(p.amount, p.currency)}
      </span>
      <button
        type="button"
        aria-label={`${tc('delete')}: ${p.client_name}, ${date}`}
        className="order-6 ms-auto grid size-8 place-items-center rounded-[8px] text-a-muted transition-colors hover:bg-a-surface hover:text-a-danger focus-visible:opacity-100 md:order-none md:ms-0 md:opacity-0 md:group-hover:opacity-100"
        onClick={async () => {
          if (!window.confirm(t('deletePaymentConfirm'))) return;
          const res = await deletePaymentAction(p.client_id, p.id);
          if (!res.ok) return toast.error(tc('error'));
          toast.success(tc('deleted'));
          router.refresh();
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
        </svg>
      </button>
    </motion.li>
  );
}

/** rows are newest first; months keep that order */
function groupByMonth(rows: LedgerPayment[]): [string, LedgerPayment[]][] {
  const m = new Map<string, LedgerPayment[]>();
  for (const r of rows) {
    const ym = r.paid_on.slice(0, 7);
    m.set(ym, [...(m.get(ym) ?? []), r]);
  }
  return [...m];
}

/** The filtered list as a file, made in the browser: nothing leaves the panel. */
function downloadCsv(
  rows: (LedgerPayment & { methodLabel: string })[],
  head: string[],
  fileName: string,
) {
  // a cell that a spreadsheet would run as a formula is written as text
  const cell = (v: string | number) => {
    const s = String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((p) =>
    [
      p.paid_on,
      p.client_name,
      p.package_name ?? '',
      p.methodLabel,
      p.amount,
      p.currency,
      p.note ?? '',
    ]
      .map(cell)
      .join(';'),
  );
  const blob = new Blob([`﻿${head.map(cell).join(';')}\n${lines.join('\n')}\n`], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
