'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { convertLeadAction, setLeadStatusAction } from '@/app/admin/_actions/clients';
import { localeNames } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { whatsappHref } from '@/lib/utils';
import type { Lead } from '@/types/admin';
import { Badge, Button, EmptyState, PageTitle, Sheet } from '@/components/admin/ui';
import { DateFilter, useDateRange } from '@/components/admin/date-filter';
import { Tabs } from '@/components/ui/tabs';
import type { ActionState } from '@/components/ui/status-icon';
import { ApplicationDetails, useApplicationSummary } from './application-details';

export function LeadsView({ leads }: { leads: Lead[] }) {
  const t = useTranslations('admin.leads');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const [status, setStatus] = useState<'all' | Lead['status']>('new');
  const [kind, setKind] = useState<'all' | Lead['kind']>('all');
  const [open, setOpen] = useState<Lead | null>(null);
  const summary = useApplicationSummary();
  const { range, setRange, within } = useDateRange();
  const shown = leads.filter(
    (l) =>
      (status === 'all' || l.status === status) &&
      (kind === 'all' || l.kind === kind) &&
      within(l.created_at),
  );

  return (
    <div>
      <PageTitle title={t('title')} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Tabs
          label={tc('status')}
          value={status}
          onChange={setStatus}
          items={[
            { value: 'all', label: tc('all'), count: leads.length },
            ...(['new', 'contacted', 'converted', 'archived'] as const).map((s) => ({
              value: s,
              label: t(`statuses.${s}`),
              count: leads.filter((l) => l.status === s).length,
            })),
          ]}
        />
        <Tabs
          label={tc('filter')}
          value={kind}
          onChange={setKind}
          items={[
            { value: 'all', label: tc('all') },
            ...(['application', 'contact', 'wizard', 'professional'] as const).map((k) => ({
              value: k,
              label: t(`kinds.${k}`),
              count: leads.filter((l) => l.kind === k).length || undefined,
            })),
          ]}
        />
        <DateFilter value={range} onChange={setRange} />
      </div>
      {!shown.length ? (
        <EmptyState>{t('empty')}</EmptyState>
      ) : (
        <motion.ul layout className="a-card divide-y divide-a-border">
          <AnimatePresence initial={false}>
            {shown.map((l) => (
              <motion.li
                key={l.id}
                layout
                exit={{ opacity: 0 }}
                transition={{ duration: admin.dur }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(l)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-start hover:bg-a-surface-2"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {l.status === 'new' && (
                      <span className="size-2 shrink-0 rounded-full bg-paprika" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{l.name}</span>
                      <span className="block truncate text-[0.8125rem] text-a-muted">
                        {l.kind === 'application'
                          ? summary(l.payload ?? {}) || l.phone || l.email
                          : (l.message ?? l.email ?? l.phone ?? '—')}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={l.kind === 'application' ? 'accent' : 'neutral'}>
                      {t(`kinds.${l.kind}`)}
                    </Badge>
                    <span className="text-[0.75rem] text-a-muted">{localeNames[l.locale]}</span>
                    <span className="num text-[0.75rem] text-a-muted">
                      {format.relativeTime(new Date(l.created_at))}
                    </span>
                  </span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
      <LeadSheet lead={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function LeadSheet({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const t = useTranslations('admin.leads');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  if (!lead)
    return (
      <Sheet open={false} onOpenChange={onClose} title="">
        {null}
      </Sheet>
    );

  const setStatus = async (s: Lead['status']) => {
    await setLeadStatusAction(lead.id, s);
    toast.success(tc('updated'));
    router.refresh();
    onClose();
  };
  const convert = async () => {
    setState('loading');
    const res = await convertLeadAction(lead.id);
    if (res.ok && res.data) {
      setState('success');
      toast.success(t('converted'));
      router.push(`/admin/clients/${res.data.id}`);
    } else {
      setState('error');
      setTimeout(() => setState('idle'), 900);
    }
  };
  const payload = Object.entries(lead.payload ?? {}).filter(([, v]) => v !== null && v !== '');

  return (
    <Sheet
      open={Boolean(lead)}
      onOpenChange={(o) => !o && onClose()}
      title={lead.name}
      width={lead.kind === 'application' ? 'lg' : 'md'}
      description={`${t(`kinds.${lead.kind}`)} · ${format.dateTime(new Date(lead.created_at), { dateStyle: 'medium', timeStyle: 'short' })}`}
      footer={
        <>
          {lead.status !== 'archived' && (
            <Button onClick={() => setStatus('archived')}>{t('archive')}</Button>
          )}
          {lead.status === 'new' && (
            <Button onClick={() => setStatus('contacted')}>{t('markContacted')}</Button>
          )}
          {!lead.converted_client_id && (
            <Button variant="primary" state={state} onClick={convert}>
              {t('convert')}
            </Button>
          )}
        </>
      }
    >
      {lead.kind === 'application' ? (
        <ApplicationDetails lead={lead} />
      ) : (
        <GenericLead lead={lead} payload={payload} />
      )}
    </Sheet>
  );
}

/** Contact, wizard and colleague requests: the fields as they came. */
function GenericLead({ lead, payload }: { lead: Lead; payload: [string, unknown][] }) {
  const t = useTranslations('admin.leads');
  const tc = useTranslations('admin.common');
  const tf = useTranslations('form');
  const format = useFormatter();
  return (
    <>
      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 text-[0.875rem]">
        {lead.email && (
          <>
            <dt className="text-a-muted">{tf('email')}</dt>
            <dd>
              <a href={`mailto:${lead.email}`} className="font-semibold underline" dir="ltr">
                {lead.email}
              </a>
            </dd>
          </>
        )}
        {lead.phone && (
          <>
            <dt className="text-a-muted">{tf('phone')}</dt>
            <dd className="flex gap-3" dir="ltr">
              <a href={`tel:${lead.phone}`} className="num font-semibold underline">
                {lead.phone}
              </a>
              <a
                href={whatsappHref(lead.phone.replace(/^0/, '90'))}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                WhatsApp
              </a>
            </dd>
          </>
        )}
        {lead.organization && (
          <>
            <dt className="text-a-muted">{tf('organization')}</dt>
            <dd>{lead.organization}</dd>
          </>
        )}
        <dt className="text-a-muted">{tc('language')}</dt>
        <dd>{localeNames[lead.locale]}</dd>
        <dt className="text-a-muted">KVKK</dt>
        <dd className="text-[0.8125rem]">
          {t('consent', {
            date: format.dateTime(new Date(lead.consent_at), {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
            version: lead.consent_version,
          })}
        </dd>
      </dl>
      {lead.message && (
        <p className="mt-6 rounded-[12px] bg-a-surface-2 p-4 text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
          {lead.message}
        </p>
      )}
      {payload.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[0.75rem] font-bold tracking-[0.08em] text-a-muted uppercase">
            {t('wizardAnswers')}
          </p>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-[0.875rem]">
            {payload.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="num text-a-muted">{k}</dt>
                <dd>
                  {Array.isArray(v)
                    ? v.join(', ')
                    : typeof v === 'object'
                      ? JSON.stringify(v)
                      : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
