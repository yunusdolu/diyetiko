'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { archiveClientAction, quickAddClientAction } from '@/app/admin/_actions/clients';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { ClientListItem, ClientStatus } from '@/types/admin';
import { Badge, Button, EmptyState, Input, PageTitle, Select, Sheet } from '@/components/admin/ui';
import { DateFilter, useDateRange } from '@/components/admin/date-filter';
import { SearchPill } from '@/components/admin/search-pill';
import { Tabs } from '@/components/ui/tabs';
import type { ActionState } from '@/components/ui/status-icon';
import { ClientCard } from './client-card';

const STATUS_TONE: Record<ClientStatus, 'ok' | 'warn' | 'neutral' | 'accent'> = {
  active: 'ok',
  paused: 'warn',
  completed: 'neutral',
  archived: 'neutral',
};

export function ClientsView({
  clients,
  archived,
  openQuickAdd,
  showArchived,
}: {
  clients: ClientListItem[];
  archived: ClientListItem[];
  openQuickAdd: boolean;
  showArchived: boolean;
}) {
  const t = useTranslations('admin.clients');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLocaleLowerCase(locale));
  const [status, setStatus] = useState<'all' | ClientStatus>('all');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [tab, setTab] = useState<'list' | 'archived'>(showArchived ? 'archived' : 'list');
  const [quick, setQuick] = useState(openQuickAdd);

  // by the day the client was added to the panel
  const { range, setRange, within } = useDateRange();
  const source = tab === 'archived' ? archived : clients;
  const shown = source.filter((c) => {
    if (status !== 'all' && c.status !== status) return false;
    if (!within(c.created_at)) return false;
    if (!q) return true;
    return [c.full_name, c.email ?? '', c.phone ?? '', c.tags.join(' ')]
      .join(' ')
      .toLocaleLowerCase(locale)
      .includes(q);
  });

  const restore = async (id: string) => {
    const res = await archiveClientAction(id, false);
    if (res.ok) {
      toast.success(tc('restored'));
      router.refresh();
    }
  };

  return (
    <div>
      <PageTitle
        title={t('title')}
        eyebrow={t('count', { count: clients.length })}
        actions={
          <>
            {/* File download from a route handler — a plain anchor, not client navigation. */}
            <a
              href="/api/admin/export/clients"
              download
              className="inline-flex h-10 items-center rounded-[10px] border border-a-border bg-a-surface px-4 text-[0.875rem] font-semibold hover:bg-a-surface-2"
            >
              {tc('exportCsv')}
            </a>
            <Link
              href="/admin/clients/new"
              className="inline-flex h-10 items-center rounded-[10px] border border-a-border bg-a-surface px-4 text-[0.875rem] font-semibold hover:bg-a-surface-2"
            >
              {t('fullForm')}
            </Link>
            <Button variant="primary" onClick={() => setQuick(true)}>
              {t('quickAdd')}
            </Button>
          </>
        }
      />

      {/* one row: search (opens when used), status, date; at the end the view and the archive */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchPill
          value={query}
          onChange={setQuery}
          placeholder={t('searchPlaceholder')}
          label={tc('search')}
        />
        <Tabs
          label={tc('status')}
          value={status}
          onChange={setStatus}
          items={[
            { value: 'all', label: tc('all') },
            ...(['active', 'paused', 'completed'] as const).map((s) => ({
              value: s,
              label: t(`status.${s}`),
              count: source.filter((c) => c.status === s).length,
            })),
          ]}
        />
        <DateFilter value={range} onChange={setRange} />
        <div className="ms-auto flex items-center gap-2">
          <Tabs
            label={tc('view')}
            value={view}
            onChange={setView}
            items={[
              {
                value: 'cards',
                label: (
                  <span title={tc('cards')} className="-mx-1 block">
                    <ViewIcon d="M4 4h7v7H4V4ZM13 4h7v7h-7V4ZM4 13h7v7H4v-7ZM13 13h7v7h-7v-7Z" />
                    <span className="sr-only">{tc('cards')}</span>
                  </span>
                ),
              },
              {
                value: 'table',
                label: (
                  <span title={tc('table')} className="-mx-1 block">
                    <ViewIcon d="M4 6h16M4 12h16M4 18h16" />
                    <span className="sr-only">{tc('table')}</span>
                  </span>
                ),
              },
            ]}
          />
          {/* the archive is a switch on the same list, not a second strip */}
          <button
            type="button"
            aria-pressed={tab === 'archived'}
            onClick={() => setTab(tab === 'archived' ? 'list' : 'archived')}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-[0.8125rem] font-semibold transition-colors',
              tab === 'archived'
                ? 'border-transparent bg-a-accent text-a-accent-text'
                : 'border-a-border bg-a-surface hover:bg-a-surface-2',
            )}
          >
            <ViewIcon d="M4 5h16v4H4V5ZM6 9v10h12V9M10 13h4" />
            {t('deletedList')}
            <span className="num text-[0.75rem] opacity-70">{archived.length}</span>
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState action={<Button onClick={() => setQuick(true)}>{t('quickAdd')}</Button>}>
          {tc('empty')}
        </EmptyState>
      ) : (
        <LayoutGroup>
          <AnimatePresence mode="wait" initial={false}>
            {view === 'cards' ? (
              <motion.ul
                key="cards"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: admin.dur }}
              >
                {shown.map((c, i) => (
                  <motion.li
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: { delay: Math.min(i, 12) * 0.03, duration: admin.dur },
                    }}
                  >
                    <ClientCard
                      client={c}
                      onRestore={tab === 'archived' ? () => void restore(c.id) : undefined}
                      restoreLabel={t('restore')}
                    />
                  </motion.li>
                ))}
              </motion.ul>
            ) : (
              <motion.div
                key="table"
                className="a-card overflow-x-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: admin.dur }}
              >
                <table className="w-full min-w-[760px] text-[0.875rem]">
                  <thead>
                    <tr className="border-b border-a-border text-start text-[0.75rem] text-a-muted">
                      {[
                        t('fields.fullName'),
                        tc('status'),
                        t('fields.phone'),
                        t('lastMeasurement'),
                        'kg',
                        t('fields.preferredLanguage'),
                        'KVKK',
                      ].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-start font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-a-border last:border-0 hover:bg-a-surface-2"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/admin/clients/${c.id}`}
                            className="font-semibold hover:underline"
                          >
                            {c.full_name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
                        </td>
                        <td className="px-4 py-2.5 num-narrow" dir="ltr">
                          {c.phone ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 num-narrow">{c.last_measured_at ?? '—'}</td>
                        <td className="px-4 py-2.5 num-narrow">{c.last_weight ?? '—'}</td>
                        <td className="px-4 py-2.5">{localeNames[c.preferred_language]}</td>
                        <td className={cn('px-4 py-2.5', !c.kvkk_consent_at && 'text-a-danger')}>
                          {c.kvkk_consent_at
                            ? format.dateTime(new Date(c.kvkk_consent_at), { dateStyle: 'short' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      )}

      <QuickAdd open={quick} onOpenChange={setQuick} />
    </div>
  );
}

function QuickAdd({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('admin.clients');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lang, setLang] = useState<Locale>('tr');

  const submit = async (form: FormData) => {
    setState('loading');
    const res = await quickAddClientAction({
      full_name: form.get('full_name'),
      email: form.get('email'),
      phone: form.get('phone'),
      preferred_language: lang,
    });
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    toast.success(tc('created'));
    setTimeout(() => {
      onOpenChange(false);
      setState('idle');
      router.push(`/admin/clients/${res.data!.id}`);
    }, 450);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('quickAdd')}
      description={t('quickAddLead')}
      width="sm"
    >
      <form action={submit} className="space-y-4">
        <Input
          name="full_name"
          label={t('fields.fullName')}
          required
          autoFocus
          error={errors.full_name && tc('required')}
        />
        <Input
          name="email"
          type="email"
          label={t('fields.email')}
          dir="ltr"
          error={errors.email && t('fields.email')}
        />
        <Input
          name="phone"
          type="tel"
          label={t('fields.phone')}
          dir="ltr"
          error={errors.phone && t('fields.phone')}
        />
        <Select
          label={t('fields.preferredLanguage')}
          value={lang}
          onChange={(e) => setLang(e.target.value as Locale)}
          options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" variant="primary" state={state}>
            {tc('save')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function ViewIcon({ d }: { d: string }) {
  return (
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
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}
