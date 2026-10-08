'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { createProgramAction } from '@/app/admin/_actions/programs';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import type { ProgramMeta } from '@/types/admin';
import { Badge, Button, EmptyState, Input, PageTitle, Select, Sheet } from '@/components/admin/ui';
import { DateFilter, useDateRange } from '@/components/admin/date-filter';
import { Tabs } from '@/components/ui/tabs';
import type { ActionState } from '@/components/ui/status-icon';

type Row = ProgramMeta & { day_count: number; link_count: number };

export function ProgramsView({
  programs,
  clients,
  openNew,
  presetClient,
}: {
  programs: Row[];
  clients: { id: string; full_name: string; preferred_language: Locale }[];
  openNew: boolean;
  presetClient: string | null;
}) {
  const t = useTranslations('admin.programs');
  const ts = useTranslations('admin.share');
  const format = useFormatter();
  const [tab, setTab] = useState<'programs' | 'templates'>('programs');
  const [open, setOpen] = useState(openNew);
  const templates = programs.filter((p) => p.is_template);
  // by the day the programme was last changed
  const { range, setRange, within } = useDateRange();
  const list = (tab === 'templates' ? templates : programs.filter((p) => !p.is_template)).filter(
    (p) => within(p.updated_at),
  );

  return (
    <div>
      <PageTitle
        title={t('title')}
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            {t('new')}
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <DateFilter value={range} onChange={setRange} className="order-last" />
        <Tabs
          label={t('title')}
          value={tab}
          onChange={setTab}
          items={[
            { value: 'programs', label: t('title'), count: programs.length - templates.length },
            { value: 'templates', label: t('templates'), count: templates.length },
          ]}
        />
      </div>
      {!list.length ? (
        <EmptyState action={<Button onClick={() => setOpen(true)}>{t('new')}</Button>}>
          {t('empty')}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { delay: Math.min(i, 10) * 0.02, duration: admin.dur },
              }}
            >
              <Link
                href={`/admin/programs/${p.id}`}
                className="a-card block h-full p-4 transition-[box-shadow,translate] duration-300 fine:hover:-translate-y-0.5 fine:hover:shadow-[0_0_0_1px_var(--a-card-ring),0_18px_36px_-22px_rgb(15_27_23/0.45)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{p.title}</span>
                  {p.is_template ? (
                    <Badge>{t('template')}</Badge>
                  ) : (
                    <Badge tone={p.status === 'active' ? 'ok' : 'neutral'}>
                      {t(`status.${p.status}`)}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[0.8125rem] text-a-muted">
                  {p.client_name ?? t('unassigned')}
                </p>
                <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-a-border pt-3 text-[0.75rem] text-a-muted">
                  <span>{localeNames[p.language]}</span>·
                  <span className="num">{t('dayCount', { n: p.day_count })}</span>·
                  <span className="num">
                    {p.target_kcal ? `${format.number(p.target_kcal)} kcal` : '—'}
                  </span>
                  {p.link_count > 0 && (
                    <Badge tone="accent">
                      {ts('links')}: {p.link_count}
                    </Badge>
                  )}
                  <span className="ms-auto">{format.relativeTime(new Date(p.updated_at))}</span>
                </p>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
      <NewProgram
        open={open}
        onOpenChange={setOpen}
        clients={clients}
        templates={templates}
        presetClient={presetClient}
      />
    </div>
  );
}

function NewProgram({
  open,
  onOpenChange,
  clients,
  templates,
  presetClient,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: { id: string; full_name: string; preferred_language: Locale }[];
  templates: Row[];
  presetClient: string | null;
}) {
  const t = useTranslations('admin.programs');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [clientId, setClientId] = useState(presetClient ?? '');
  const client = clients.find((c) => c.id === clientId);
  const [language, setLanguage] = useState<Locale>(client?.preferred_language ?? 'tr');
  const [source, setSource] = useState<'blank' | 'template'>('blank');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [asTemplate, setAsTemplate] = useState(false);
  const [state, setState] = useState<ActionState>('idle');

  const submit = async (form: FormData) => {
    setState('loading');
    const res = await createProgramAction({
      title: String(form.get('title') ?? ''),
      clientId: asTemplate ? null : clientId || null,
      language,
      templateId: source === 'template' && templateId ? templateId : null,
      isTemplate: asTemplate,
    });
    if (!res.ok || !res.data) {
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    router.push(`/admin/programs/${res.data.id}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('new')} width="sm">
      <form action={submit} className="grid gap-4">
        <Input
          name="title"
          label={t('titleField')}
          required
          autoFocus
          defaultValue={client ? `${client.full_name.split(' ')[0]} — ` : ''}
        />
        <Tabs
          label={t('new')}
          value={source}
          onChange={setSource}
          items={[
            { value: 'blank', label: t('fromScratch') },
            { value: 'template', label: t('fromTemplate') },
          ]}
        />
        {source === 'template' && (
          <Select
            label={t('templates')}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            options={
              templates.length
                ? templates.map((p) => ({ value: p.id, label: p.title }))
                : [{ value: '', label: '—' }]
            }
          />
        )}
        <Select
          label={t('assign')}
          value={clientId}
          disabled={asTemplate}
          onChange={(e) => {
            setClientId(e.target.value);
            const c = clients.find((x) => x.id === e.target.value);
            if (c) setLanguage(c.preferred_language);
          }}
          options={[
            { value: '', label: t('unassigned') },
            ...clients.map((c) => ({ value: c.id, label: c.full_name })),
          ]}
        />
        <Select
          label={t('language')}
          value={language}
          onChange={(e) => setLanguage(e.target.value as Locale)}
          options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
        />
        <label className="flex items-center gap-2 text-[0.875rem]">
          <input
            type="checkbox"
            checked={asTemplate}
            onChange={(e) => setAsTemplate(e.target.checked)}
            className="size-4 accent-[var(--a-accent)]"
          />
          {t('saveAsTemplate')}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" variant="primary" state={state}>
            {tc('new')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
