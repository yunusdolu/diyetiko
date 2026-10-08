'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { CmsListItem } from '@/lib/admin/cms';
import { locales } from '@/lib/i18n/config';
import { Badge, EmptyState, PageTitle } from '@/components/admin/ui';
import { Ingredient } from '@/components/site/ingredients';
import { DateFilter, useDateRange } from '@/components/admin/date-filter';
import { Tabs } from '@/components/ui/tabs';

export const statusTone = { draft: 'neutral', needs_review: 'warn', reviewed: 'ok' } as const;

export function TranslationBadges({ statuses }: { statuses: CmsListItem['statuses'] }) {
  const t = useTranslations('admin.cms.translationStatus');
  return (
    <span className="flex flex-wrap gap-1">
      {locales.map((l) => {
        const s = statuses.find((x) => x.locale === l);
        return (
          <span key={l} title={s ? t(s.status) : '—'}>
            <Badge tone={s ? statusTone[s.status] : 'danger'} className="num uppercase">
              {l}
              <span className="sr-only">: {s ? t(s.status) : '—'}</span>
            </Badge>
          </span>
        );
      })}
    </span>
  );
}

export function CmsList({
  items,
  title,
  newHref,
  newLabel,
  baseHref,
}: {
  items: CmsListItem[];
  title: string;
  newHref: string;
  newLabel: string;
  baseHref: string;
}) {
  const t = useTranslations('admin.cms');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  // by the day the entry was last changed
  const { range, setRange, within } = useDateRange();
  const shown = items.filter(
    (i) =>
      (filter === 'all' ? true : filter === 'published' ? i.published : !i.published) &&
      within(i.updated_at),
  );
  return (
    <div>
      <PageTitle
        title={title}
        actions={
          <Link
            href={newHref}
            className="inline-flex h-10 items-center rounded-[10px] bg-a-accent px-4 text-[0.875rem] font-semibold text-a-accent-text hover:opacity-90"
          >
            {newLabel}
          </Link>
        }
      />
      <p className="mb-4 max-w-3xl rounded-[12px] bg-a-surface-2 px-4 py-3 text-[0.8125rem] text-a-muted">
        {t('reviewRule')}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DateFilter value={range} onChange={setRange} className="order-last" />
        <Tabs
          label={tc('filter')}
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: tc('all'), count: items.length },
            {
              value: 'published',
              label: t('published'),
              count: items.filter((i) => i.published).length,
            },
            { value: 'draft', label: t('draft'), count: items.filter((i) => !i.published).length },
          ]}
        />
      </div>
      {!shown.length ? (
        <EmptyState>{tc('empty')}</EmptyState>
      ) : (
        <ul className="a-card divide-y divide-a-border">
          {shown.map((i) => (
            <li key={i.id}>
              <Link
                href={`${baseHref}/${i.id}`}
                className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-a-surface-2"
              >
                <Ingredient name={i.illustration} className="size-10 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{i.title}</span>
                  <span className="text-[0.75rem] text-a-muted">
                    {format.relativeTime(new Date(i.updated_at))}
                    {i.kcal ? <span className="num"> · {Math.round(i.kcal)} kcal</span> : null}
                  </span>
                </span>
                <TranslationBadges statuses={i.statuses} />
                <Badge tone={i.published ? 'ok' : 'neutral'}>
                  {i.published ? t('published') : t('draft')}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
