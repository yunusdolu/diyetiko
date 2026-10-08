'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  addPaymentAction,
  deletePackageAction,
  deletePaymentAction,
  savePackageAction,
  setPackageClosedAction,
} from '@/app/admin/_actions/practice';
import type { Billing, PackageRow, PaymentRow } from '@/lib/admin/practice';
import { CURRENCIES, PAYMENT_METHODS, type Currency } from '@/lib/admin/practice-logic';
import { admin, ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Panel,
  Select,
  Sheet,
  Textarea,
} from '@/components/admin/ui';
import { Meter } from '@/components/admin/fx';
import { DateFilter, useDateRange } from '@/components/admin/date-filter';
import type { ActionState } from '@/components/ui/status-icon';

/**
 * "Paket & ödeme": what the client bought, how far they are into it (attended appointments count
 * down automatically), what was paid and what is still owed. Amounts are typed in the panel's own
 * number style ("1.500,50") and never mixed across currencies.
 */
export function BillingTab({
  clientId,
  billing,
  today,
}: {
  clientId: string;
  /** null: the practice migration is not applied yet */
  billing: Billing | null;
  today: string;
}) {
  const t = useTranslations('admin.billing');
  const money = useMoney();
  const [editing, setEditing] = useState<PackageRow | 'new' | null>(null);
  const [paying, setPaying] = useState<{ pkg: PackageRow | null } | null>(null);
  const { range, setRange, within } = useDateRange();

  if (!billing)
    return (
      <EmptyState>
        <span className="text-a-text">{t('migration')}</span>
      </EmptyState>
    );

  const paidTotal = sumBy(billing.payments);
  const open = billing.packages.find((p) => p.state === 'active' || p.state === 'ending');

  return (
    <div className="space-y-5">
      {/* the three numbers a dietitian asks first */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Figure label={t('current')}>
          {open ? (
            <>
              <span className="block truncate text-[1.0625rem] font-bold">{open.name}</span>
              <span className="mt-1 block text-[0.8125rem] text-a-muted">
                {open.sessions_total != null
                  ? t('sessionsLeft', { n: Math.max(0, open.sessions_total - open.used) })
                  : t('usedOpen', { used: open.used })}
              </span>
            </>
          ) : (
            <span className="text-[0.9375rem] text-a-muted">{t('noOpen')}</span>
          )}
        </Figure>
        <Figure label={t('paidTotal')}>
          <Amounts list={paidTotal} money={money} empty="—" />
        </Figure>
        <Figure label={t('dueTotal')} tone={billing.due.length ? 'danger' : 'ok'}>
          <Amounts list={billing.due} money={money} empty={t('settled')} />
        </Figure>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title={t('packages')}
          padded={false}
          action={
            <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
              {t('newPackage')}
            </Button>
          }
        >
          {!billing.packages.length ? (
            <EmptyState compact>{t('noPackages')}</EmptyState>
          ) : (
            <motion.ul layout className="divide-y divide-a-border">
              <AnimatePresence initial={false}>
                {billing.packages.map((p, i) => (
                  <PackageCard
                    key={p.id}
                    pkg={p}
                    index={i}
                    clientId={clientId}
                    onEdit={() => setEditing(p)}
                    onPay={() => setPaying({ pkg: p })}
                  />
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
          <p className="border-t border-a-border px-5 py-3 text-[0.75rem] text-a-muted">
            {t('counted')}
          </p>
        </Panel>

        <Panel
          title={t('payments')}
          padded={false}
          action={
            <Button size="sm" onClick={() => setPaying({ pkg: open ?? null })}>
              {t('recordPayment')}
            </Button>
          }
        >
          {!billing.payments.length ? (
            <EmptyState compact>{t('noPayments')}</EmptyState>
          ) : (
            <>
              <div className="border-b border-a-border px-5 py-2.5">
                <DateFilter value={range} onChange={setRange} />
              </div>
              {billing.payments.some((p) => within(p.paid_on)) ? (
                <Ledger
                  clientId={clientId}
                  payments={billing.payments.filter((p) => within(p.paid_on))}
                  packages={billing.packages}
                />
              ) : (
                <EmptyState compact>{t('noPaymentsRange')}</EmptyState>
              )}
            </>
          )}
        </Panel>
      </div>

      <PackageSheet
        clientId={clientId}
        today={today}
        pkg={editing === 'new' ? null : editing}
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <PaymentSheet
        clientId={clientId}
        today={today}
        packages={billing.packages.filter((p) => !p.closed_at)}
        preset={paying?.pkg ?? null}
        open={paying != null}
        onOpenChange={(o) => !o && setPaying(null)}
      />
    </div>
  );
}

// ---- pieces ------------------------------------------------------------------------------------

/**
 * Amounts as the practice writes them. Turkish lira is "1.500 TL": the ₺ sign is missing from many
 * typefaces and falls back to a glyph that reads as another currency. Other currencies keep their
 * sign.
 */
export function useMoney() {
  const format = useFormatter();
  return (amount: number, currency: Currency) => {
    // whole amounts without decimals, anything else with both ("1.500,50")
    const places = Number.isInteger(amount) ? 0 : 2;
    const digits = { minimumFractionDigits: places, maximumFractionDigits: places };
    return currency === 'TRY'
      ? `${format.number(amount, digits)} TL`
      : format.number(amount, { style: 'currency', currency, ...digits });
  };
}

export function sumBy(rows: { amount: number; currency: Currency }[]) {
  const m = new Map<Currency, number>();
  for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + r.amount);
  return CURRENCIES.filter((c) => m.has(c)).map((c) => ({ currency: c, amount: m.get(c)! }));
}

export function Amounts({
  list,
  money,
  empty,
}: {
  list: { currency: Currency; amount: number }[];
  money: ReturnType<typeof useMoney>;
  empty: string;
}) {
  if (!list.length) return <span className="text-[1.0625rem] font-bold">{empty}</span>;
  return (
    <span className="flex flex-col">
      {list.map((x) => (
        <span key={x.currency} className="num-wide text-[1.5rem] leading-tight">
          {money(x.amount, x.currency)}
        </span>
      ))}
    </span>
  );
}

export function Figure({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: 'ok' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'a-card relative overflow-hidden p-4',
        // what is owed keeps its own edge, now in the ring rather than a border
        tone === 'danger' &&
          'shadow-[0_0_0_1px_color-mix(in_oklab,var(--a-danger)_45%,transparent),var(--a-shadow-card)]',
      )}
    >
      {tone && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 start-0 w-1',
            tone === 'danger' ? 'bg-a-danger' : 'bg-a-ok',
          )}
        />
      )}
      <p className="text-[0.75rem] font-semibold tracking-wide text-a-muted uppercase">{label}</p>
      <div className={cn('mt-2', tone === 'danger' && 'text-a-danger')}>{children}</div>
    </div>
  );
}

const STATE_TONE = { active: 'ok', ending: 'warn', done: 'neutral', upcoming: 'neutral' } as const;

/** Sessions as segments: each attended one fills in, one after the other. */
export function SessionTrack({ total, used }: { total: number; used: number }) {
  const reduced = usePrefersReducedMotion();
  if (total > 24) return <Meter value={used / total} className="h-2.5" />;
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="relative h-2.5 flex-1 overflow-hidden rounded-pill bg-a-surface-2">
          {i < used && (
            <motion.span
              className="absolute inset-0 origin-left rounded-pill bg-a-chart rtl:origin-right"
              initial={{ scaleX: reduced ? 1 : 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: reduced ? 0 : 0.35,
                ease: ease.out,
                delay: reduced ? 0 : i * 0.05,
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

function PackageCard({
  pkg: p,
  index,
  clientId,
  onEdit,
  onPay,
}: {
  pkg: PackageRow;
  index: number;
  clientId: string;
  onEdit: () => void;
  onPay: () => void;
}) {
  const t = useTranslations('admin.billing');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const money = useMoney();
  const router = useRouter();
  const date = (d: string) => format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
  const act = async (fn: () => Promise<{ ok: boolean }>, msg?: string) => {
    const res = await fn();
    if (!res.ok) return toast.error(tc('error'));
    if (msg) toast.success(msg);
    router.refresh();
  };
  const share = p.price ? Math.min(1, p.paid / p.price) : 0;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ ...admin.spring, delay: index * 0.04 }}
      className={cn('px-5 py-4', p.state === 'done' && 'opacity-75')}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="font-bold break-words">{p.name}</p>
          <p className="mt-0.5 text-[0.8125rem] text-a-muted">
            <span className="num">{date(p.starts_on)}</span>
            {p.ends_on && (
              <>
                {' – '}
                <span className="num">{date(p.ends_on)}</span>
              </>
            )}
          </p>
        </div>
        <Badge tone={p.closed_at ? 'neutral' : STATE_TONE[p.state]}>
          {p.closed_at ? t('closed') : t(`state.${p.state}`)}
        </Badge>
      </div>

      {p.sessions_total != null ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.8125rem]">
            <span className="font-semibold">
              {t('used', { used: Math.min(p.used, p.sessions_total), total: p.sessions_total })}
            </span>
            <span className="text-a-muted">
              {t('sessionsLeft', { n: Math.max(0, p.sessions_total - p.used) })}
            </span>
          </div>
          <SessionTrack total={p.sessions_total} used={Math.min(p.used, p.sessions_total)} />
        </div>
      ) : (
        <p className="mt-3 text-[0.8125rem] font-semibold">{t('usedOpen', { used: p.used })}</p>
      )}

      <div className="mt-3">
        {p.price == null ? (
          <p className="text-[0.8125rem] text-a-muted">{t('noPrice')}</p>
        ) : (
          <>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[0.8125rem]">
              <span>
                {t('paid')} <span className="num font-semibold">{money(p.paid, p.currency)}</span>
                <span className="text-a-muted"> / {money(p.price, p.currency)}</span>
              </span>
              {p.due ? (
                <span className="font-semibold text-a-danger">
                  {t('due')} <span className="num">{money(p.due, p.currency)}</span>
                </span>
              ) : (
                <span className="font-semibold text-a-ok">{t('settled')}</span>
              )}
            </div>
            <Meter
              value={share}
              barClassName={p.due ? 'bg-a-warn' : 'bg-a-ok'}
              label={`${t('paid')} ${Math.round(share * 100)}%`}
            />
          </>
        )}
      </div>
      {p.note && <p className="mt-2 text-[0.8125rem] text-a-muted">{p.note}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {!p.closed_at && p.due ? (
          <Button size="sm" variant="primary" onClick={onPay}>
            {t('takePayment')}
          </Button>
        ) : null}
        <Button size="sm" onClick={onEdit}>
          {tc('edit')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => act(() => setPackageClosedAction(clientId, p.id, !p.closed_at))}
        >
          {p.closed_at ? t('reopen') : t('close')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-a-danger"
          onClick={() => {
            if (window.confirm(t('deleteConfirm')))
              void act(() => deletePackageAction(clientId, p.id), tc('deleted'));
          }}
        >
          {tc('delete')}
        </Button>
      </div>
    </motion.li>
  );
}

function Ledger({
  clientId,
  payments,
  packages,
}: {
  clientId: string;
  payments: PaymentRow[];
  packages: PackageRow[];
}) {
  const t = useTranslations('admin.billing');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const money = useMoney();
  const router = useRouter();
  const name = new Map(packages.map((p) => [p.id, p.name]));
  return (
    <motion.ul layout className="divide-y divide-a-border">
      <AnimatePresence initial={false}>
        {payments.map((p) => (
          <motion.li
            key={p.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={admin.spring}
            className="group flex items-center gap-3 px-5 py-3"
          >
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--a-ok)_14%,transparent)] text-a-ok"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M6 13l6 6 6-6" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="num-wide font-semibold">{money(p.amount, p.currency)}</p>
              <p className="truncate text-[0.75rem] text-a-muted">
                <span className="num">
                  {format.dateTime(new Date(`${p.paid_on}T12:00:00`), { dateStyle: 'medium' })}
                </span>
                {' · '}
                {t(`methods.${p.method}`)}
                {' · '}
                {p.package_id ? (name.get(p.package_id) ?? '—') : t('noPackage')}
                {p.note && ` · ${p.note}`}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md shrink-0 px-2 py-1 text-[0.75rem] font-semibold text-a-muted hover:text-a-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              onClick={async () => {
                if (!window.confirm(t('deletePaymentConfirm'))) return;
                const res = await deletePaymentAction(clientId, p.id);
                if (!res.ok) return toast.error(tc('error'));
                toast.success(tc('deleted'));
                router.refresh();
              }}
            >
              {tc('delete')}
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

// ---- sheets ------------------------------------------------------------------------------------

function useSubmit(onDone: () => void) {
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<{ ok: boolean; fieldErrors?: Record<string, string> }>) => {
    setState('loading');
    const res = await fn();
    if (!res.ok) {
      setErrors(res.fieldErrors ?? { form: 'invalid' });
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setErrors({});
    setState('success');
    toast.success(tc('saved'));
    router.refresh();
    setTimeout(() => {
      setState('idle');
      onDone();
    }, 400);
  };
  return { state, errors, run };
}

function PackageSheet({
  clientId,
  today,
  pkg,
  open,
  onOpenChange,
}: {
  clientId: string;
  today: string;
  pkg: PackageRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('admin.billing');
  const tc = useTranslations('admin.common');
  const { state, errors, run } = useSubmit(() => onOpenChange(false));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={pkg ? t('editPackage') : t('newPackage')}
      width="sm"
    >
      <form
        key={pkg?.id ?? 'new'}
        action={(form) =>
          run(() => savePackageAction(clientId, pkg?.id ?? null, Object.fromEntries(form)))
        }
        className="grid grid-cols-2 gap-4"
      >
        <Input
          name="name"
          label={t('name')}
          placeholder={t('namePlaceholder')}
          defaultValue={pkg?.name}
          required
          maxLength={120}
          className="col-span-2"
          error={errors.name && tc('required')}
        />
        <Input
          name="sessions_total"
          type="number"
          min={1}
          max={200}
          inputMode="numeric"
          label={t('sessions')}
          hint={t('sessionsHint')}
          defaultValue={pkg ? (pkg.sessions_total ?? '') : 8}
          className="col-span-2"
          error={errors.sessions_total && tc('error')}
        />
        <Input
          name="starts_on"
          type="date"
          label={t('startsOn')}
          defaultValue={pkg?.starts_on ?? today}
          required
          error={errors.starts_on && tc('required')}
        />
        <Input
          name="ends_on"
          type="date"
          label={t('endsOn')}
          hint={tc('optional')}
          defaultValue={pkg?.ends_on ?? ''}
          error={errors.ends_on && t('endsBeforeStart')}
        />
        <Input
          name="price"
          inputMode="decimal"
          label={t('price')}
          hint={tc('optional')}
          defaultValue={pkg?.price ?? ''}
          error={errors.price && tc('error')}
        />
        <Select
          name="currency"
          label={t('currency')}
          defaultValue={pkg?.currency ?? 'TRY'}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <Textarea
          name="note"
          label={t('note')}
          rows={2}
          defaultValue={pkg?.note ?? ''}
          className="col-span-2"
        />
        <div className="col-span-2 flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" variant="primary" state={state}>
            {tc('save')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/**
 * Recording a payment. On a client's page the client is given; on the payments page (`clients`)
 * the client is chosen first and the package list follows the choice.
 */
export function PaymentSheet({
  clientId,
  clients,
  today,
  packages: ownPackages,
  preset,
  open,
  onOpenChange,
}: {
  clientId: string | null;
  clients?: { id: string; full_name: string; packages: PackageRow[] }[];
  today: string;
  packages: PackageRow[];
  preset: PackageRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('admin.billing');
  const tc = useTranslations('admin.common');
  const { state, errors, run } = useSubmit(() => onOpenChange(false));
  const [picked, setPicked] = useState<string>('');
  const [pkgId, setPkgId] = useState<string>('');
  const cid = clientId ?? (picked || preset?.client_id || '');
  const packages = clients ? (clients.find((c) => c.id === cid)?.packages ?? []) : ownPackages;
  const chosen = packages.find((p) => p.id === pkgId) ?? null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('recordPayment')} width="sm">
      <form
        key={`${open}-${preset?.id ?? 'none'}`}
        action={(form) =>
          run(async () =>
            cid
              ? addPaymentAction(cid, Object.fromEntries(form))
              : { ok: false, fieldErrors: { client_id: 'required' } },
          )
        }
        className="grid grid-cols-2 gap-4"
      >
        {clients && (
          <Select
            name="client_id"
            label={t('client')}
            value={cid}
            onChange={(e) => {
              setPicked(e.target.value);
              setPkgId('');
            }}
            options={[
              { value: '', label: t('chooseClient') },
              ...clients.map((c) => ({ value: c.id, label: c.full_name })),
            ]}
            className="col-span-2"
            error={errors.client_id && tc('required')}
          />
        )}
        <Select
          // the packages are the chosen client's
          key={`pkg-${cid}`}
          name="package_id"
          label={t('forPackage')}
          defaultValue={preset?.id ?? ''}
          onChange={(e) => setPkgId(e.target.value)}
          options={[
            { value: '', label: t('noPackage') },
            ...packages.map((p) => ({ value: p.id, label: p.name })),
          ]}
          className="col-span-2"
        />
        <Input
          name="amount"
          inputMode="decimal"
          label={t('amount')}
          required
          autoFocus
          defaultValue={preset?.due ? String(preset.due) : ''}
          error={errors.amount && tc('error')}
        />
        <Select
          // a payment against a package is in the package's currency
          key={(chosen ?? preset)?.currency ?? 'free'}
          name="currency"
          label={t('currency')}
          defaultValue={(chosen ?? preset)?.currency ?? 'TRY'}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <Input
          name="paid_on"
          type="date"
          label={t('paidOn')}
          defaultValue={today}
          required
          error={errors.paid_on && tc('required')}
        />
        <Select
          name="method"
          label={t('method')}
          defaultValue="transfer"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`methods.${m}`) }))}
        />
        <Input name="note" label={t('note')} maxLength={500} className="col-span-2" />
        <div className="col-span-2 flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" variant="primary" state={state}>
            {tc('save')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
