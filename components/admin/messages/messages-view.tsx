'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { DropdownMenu as M } from 'radix-ui';
import { useDeferredValue, useState } from 'react';
import type { InboxRow, SharedFile } from '@/lib/admin/portal';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/portal';
import { Avatar } from '@/components/admin/fx';
import { SearchPill } from '@/components/admin/search-pill';
import { EmptyState, PageTitle } from '@/components/admin/ui';
import { ClipIcon, FileChip } from '@/components/ui/file-chip';
import { Tabs } from '@/components/ui/tabs';
import { Conversation } from './conversation';

export interface MessageClient {
  id: string;
  full_name: string;
  on_portal: boolean;
  last_weight: number | null;
  next_appointment: string | null;
}

/**
 * The practice's messages in one place: conversations on one side (unread first, searchable,
 * filtered to unread or to those carrying files), the chosen client's thread on the other — with
 * who they are at a glance (last weight, next appointment), shortcuts into their file, the files
 * exchanged so far, and a composer that sends text or a PDF / photo. Phones show one of the two
 * at a time.
 */
export function MessagesView({
  threads,
  clients,
  active,
  uploads,
}: {
  threads: InboxRow[];
  clients: MessageClient[];
  active: { clientId: string; messages: Message[]; shared: SharedFile[] } | null;
  uploads: boolean;
}) {
  const t = useTranslations('admin.portal.messages');
  const tp = useTranslations('admin.portal');
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLocaleLowerCase(locale));
  const [filter, setFilter] = useState<'all' | 'unread' | 'files'>('all');
  const [filesOpen, setFilesOpen] = useState(false);

  const shown = threads.filter(
    (r) =>
      (filter === 'all' || (filter === 'unread' ? r.unread > 0 : r.last_has_file)) &&
      (!q || r.full_name.toLocaleLowerCase(locale).includes(q)),
  );
  const client = active ? clients.find((c) => c.id === active.clientId) : undefined;
  const withThread = new Set(threads.map((r) => r.client_id));
  const unreadTotal = threads.reduce((a, r) => a + r.unread, 0);

  return (
    <div>
      <PageTitle
        eyebrow={tp('title')}
        title={t('inbox')}
        actions={
          // start a thread with a client who has not written yet
          <M.Root>
            <M.Trigger className="group inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-a-border bg-a-surface ps-3 pe-2.5 text-[0.875rem] font-semibold transition-colors outline-none hover:bg-a-surface-2 focus-visible:ring-2 focus-visible:ring-a-text data-[state=open]:bg-a-surface-2">
              <span aria-hidden className="text-[1.1rem] leading-none">
                +
              </span>
              {t('newThread')}
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                aria-hidden
                className="ms-1 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180"
              >
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </M.Trigger>
            <M.Portal>
              <M.Content
                align="end"
                sideOffset={8}
                collisionPadding={12}
                className="a-glass z-[95] max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-64 overflow-y-auto p-1.5 text-a-text outline-none data-[state=open]:animate-[admin-pop_200ms_cubic-bezier(0.16,1,0.3,1)]"
              >
                <M.Label className="px-2.5 pt-1.5 pb-1 text-[0.6875rem] font-semibold tracking-wide text-a-muted uppercase">
                  {t('pickClient')}
                </M.Label>
                {clients.map((c) => (
                  <M.Item
                    key={c.id}
                    onSelect={() => router.push(`/admin/messages?c=${c.id}`)}
                    className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[9px] px-2 text-[0.875rem] font-medium outline-none data-[highlighted]:bg-[color-mix(in_srgb,var(--a-text)_9%,transparent)]"
                  >
                    <Avatar name={c.full_name} size={24} />
                    <span className="min-w-0 flex-1 truncate">{c.full_name}</span>
                    {/* someone who has not been written to yet */}
                    {!withThread.has(c.id) && (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-a-ok" />
                    )}
                  </M.Item>
                ))}
              </M.Content>
            </M.Portal>
          </M.Root>
        }
      />
      {!uploads && (
        <p className="mb-4 rounded-[12px] bg-a-surface-2 px-4 py-3 text-[0.8125rem] text-a-text">
          {t('migration')}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:h-[calc(100dvh-13.5rem)] lg:min-h-[30rem] lg:grid-cols-[21rem_minmax(0,1fr)]">
        {/* conversations */}
        <section
          className={cn(
            'a-card min-h-0 flex-col overflow-hidden',
            active ? 'hidden lg:flex' : 'flex',
          )}
        >
          <header className="shrink-0 space-y-2.5 border-b border-a-border p-3">
            <SearchPill
              value={query}
              onChange={setQuery}
              placeholder={t('search')}
              label={t('search')}
              width="11.5rem"
            />
            <Tabs
              size="sm"
              label={t('inbox')}
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: t('all') },
                { value: 'unread', label: t('unreadOnly'), count: unreadTotal || undefined },
                { value: 'files', label: t('withFiles') },
              ]}
            />
          </header>
          {!threads.length ? (
            <EmptyState compact>{t('inboxEmpty')}</EmptyState>
          ) : !shown.length ? (
            <EmptyState compact>{t('noMatch')}</EmptyState>
          ) : (
            <ul className="a-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
              {shown.map((r) => {
                const on = r.client_id === active?.clientId;
                return (
                  <li key={r.client_id}>
                    <Link
                      href={`/admin/messages?c=${r.client_id}`}
                      scroll={false}
                      aria-current={on ? 'true' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-[12px] px-2.5 py-2.5 transition-colors',
                        on ? 'bg-a-surface-2' : 'hover:bg-a-surface-2/60',
                      )}
                    >
                      <span className="relative shrink-0">
                        <Avatar name={r.full_name} size={38} />
                        {r.unread > 0 && (
                          <span
                            aria-hidden
                            className="absolute -end-0.5 -top-0.5 size-3 rounded-full bg-paprika ring-2 ring-[var(--a-surface)]"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn('truncate', r.unread > 0 ? 'font-bold' : 'font-semibold')}
                          >
                            {r.full_name}
                          </span>
                          <span className="shrink-0 num text-[0.6875rem] text-a-muted">
                            {format.relativeTime(new Date(r.last_at))}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className={cn(
                              'flex min-w-0 flex-1 items-center gap-1 truncate text-[0.8125rem]',
                              r.unread > 0 ? 'text-a-text' : 'text-a-muted',
                            )}
                          >
                            {r.last_has_file && (
                              <span className="shrink-0">
                                <ClipIcon size={12} />
                              </span>
                            )}
                            <span className="truncate">
                              {r.last_author === 'dietitian' && `${t('you')}: `}
                              {r.last_body}
                            </span>
                          </span>
                          {r.unread > 0 && (
                            <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-pill bg-a-accent px-1.5 num text-[0.6875rem] leading-none font-semibold text-a-accent-text">
                              {r.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* the chosen thread */}
        {!active || !client ? (
          <section className="hidden min-h-0 place-items-center rounded-[16px] border border-dashed border-a-border lg:grid">
            <p className="max-w-xs px-6 text-center text-[0.9375rem] text-a-muted">{t('choose')}</p>
          </section>
        ) : (
          <section className="flex min-h-[28rem] flex-col lg:min-h-0">
            <header className="a-card mb-3 shrink-0 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/admin/messages"
                  scroll={false}
                  aria-label={t('back')}
                  className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-a-surface-2 lg:hidden"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    aria-hidden
                    className="mirror-rtl"
                  >
                    <path
                      d="M15 6l-6 6 6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                <Avatar name={client.full_name} size={38} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[1rem] leading-tight font-bold">
                    {client.full_name}
                  </h2>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[0.75rem] text-a-muted">
                    {client.last_weight != null && (
                      <span>
                        {t('lastWeight')}:{' '}
                        <span className="num font-semibold text-a-text">
                          {format.number(client.last_weight, { maximumFractionDigits: 1 })} kg
                        </span>
                      </span>
                    )}
                    {client.next_appointment && (
                      <span>
                        {t('nextAppointment')}:{' '}
                        <span className="num font-semibold text-a-text">
                          {format.dateTime(new Date(client.next_appointment), {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                    )}
                    {!client.on_portal && <span>{t('portalOff')}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['tracking', 'diary', 'labs'] as const).map((tab) => (
                    <Link
                      key={tab}
                      href={`/admin/clients/${client.id}?tab=${tab}`}
                      className="inline-flex h-8 items-center rounded-pill border border-a-border px-3 text-[0.8125rem] font-semibold hover:bg-a-surface-2"
                    >
                      {t(`tabs.${tab}`)}
                    </Link>
                  ))}
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="inline-flex h-8 items-center rounded-pill bg-a-accent px-3 text-[0.8125rem] font-semibold text-a-accent-text hover:opacity-90"
                  >
                    {t('openClient')}
                  </Link>
                </div>
              </div>
              {active.shared.length > 0 && (
                <div className="mt-3 border-t border-a-border pt-2.5">
                  <button
                    type="button"
                    aria-expanded={filesOpen}
                    onClick={() => setFilesOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold hover:underline"
                  >
                    <ClipIcon size={14} />
                    {t('sharedFiles')}
                    <span className="num text-a-muted">{active.shared.length}</span>
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      aria-hidden
                      className={cn('transition-transform', filesOpen && 'rotate-180')}
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {filesOpen && (
                    <ul className="a-scroll mt-2.5 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                      {active.shared.map((f) => (
                        <li key={f.id} className="min-w-0">
                          <FileChip
                            href={`/api/admin/message-file/${f.id}`}
                            name={f.name}
                            mime={f.mime}
                            compact
                            size={f.size}
                            locale={locale}
                            openLabel={t('openFile')}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </header>
            <Conversation
              key={client.id}
              clientId={client.id}
              messages={active.messages}
              onPortal={client.on_portal}
              uploads={uploads}
              fill
              className="min-h-0 flex-1"
            />
          </section>
        )}
      </div>
    </div>
  );
}
