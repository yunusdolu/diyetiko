'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { markClientReadAction, replyAction } from '@/app/admin/_actions/portal';
import type { InboxRow } from '@/lib/admin/portal';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/admin/fx';
import { Button, EmptyState } from '@/components/admin/ui';
import type { ActionState } from '@/components/ui/status-icon';
import { CheckIcon } from './agenda';

/**
 * Unread portal messages, answerable right here: a reply goes to the client's portal thread and
 * marks their messages read; "mark as read" clears it without a reply. Nothing leaves the
 * practice's own database.
 */
export function InboxPanel({ rows }: { rows: InboxRow[] }) {
  const t = useTranslations('admin.dashboard.inbox');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const uid = useId();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [done, setDone] = useState<Set<string>>(new Set());
  const shown = rows.filter((r) => !done.has(r.client_id));

  const finish = (id: string) => {
    setDone((d) => new Set(d).add(id));
    setOpenId(null);
    setDraft('');
    router.refresh();
  };

  const send = async (r: InboxRow) => {
    const body = draft.trim();
    if (!body) return;
    setState('loading');
    const res = await replyAction(r.client_id, body);
    if (!res.ok) {
      setState('error');
      toast.error(res.error === 'rateLimited' ? tc('error') : tc('error'));
      setTimeout(() => setState('idle'), 900);
      return;
    }
    await markClientReadAction(r.client_id);
    setState('success');
    toast.success(t('sent'));
    setTimeout(() => {
      setState('idle');
      finish(r.client_id);
    }, 450);
  };

  const markRead = async (r: InboxRow) => {
    await markClientReadAction(r.client_id);
    finish(r.client_id);
  };

  return (
    <section className="a-card">
      <header className="flex items-center justify-between gap-3 border-b border-a-border px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-bold">
          {t('title')}
          {shown.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-pill bg-a-accent px-1.5 num text-[0.6875rem] text-a-accent-text">
              {shown.reduce((n, r) => n + r.unread, 0)}
            </span>
          )}
        </h2>
        <Link
          href="/admin/messages"
          className="text-[0.75rem] font-semibold text-a-muted underline-offset-4 hover:text-a-text hover:underline"
        >
          {t('all')}
        </Link>
      </header>
      {shown.length === 0 ? (
        <EmptyState compact>{t('empty')}</EmptyState>
      ) : (
        <ul className="divide-y divide-a-border">
          <AnimatePresence initial={false}>
            {shown.map((r) => {
              const open = openId === r.client_id;
              return (
                <motion.li
                  key={r.client_id}
                  layout={!reduced}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
                  transition={{ duration: 0.3, ease: ease.out }}
                  className="overflow-hidden"
                >
                  <div className="px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      <Avatar name={r.full_name} size={34} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link
                            href={`/admin/clients/${r.client_id}?tab=messages`}
                            className="truncate font-semibold underline-offset-4 hover:underline"
                          >
                            {r.full_name}
                          </Link>
                          <span className="shrink-0 num text-[0.6875rem] text-a-muted">
                            {format.relativeTime(new Date(r.last_at))}
                          </span>
                        </div>
                        <p
                          className={cn(
                            'mt-1 text-[0.8125rem] text-a-muted',
                            open ? 'whitespace-pre-line' : 'line-clamp-2',
                          )}
                        >
                          {r.last_body}
                        </p>
                        {!open && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenId(r.client_id);
                                setDraft('');
                              }}
                              className="tap-44 inline-flex h-8 items-center gap-1.5 rounded-pill bg-a-accent px-3 text-[0.75rem] font-semibold text-a-accent-text transition-transform active:scale-95"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="13"
                                height="13"
                                aria-hidden
                                className="mirror-rtl"
                              >
                                <path
                                  d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              {t('reply')}
                            </button>
                            <button
                              type="button"
                              onClick={() => markRead(r)}
                              className="tap-44 inline-flex h-8 items-center gap-1.5 rounded-pill border border-a-border px-3 text-[0.75rem] font-semibold transition-[background-color,transform] hover:bg-a-surface-2 active:scale-95"
                            >
                              <CheckIcon />
                              {t('markRead')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.form
                          key="reply"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void send(r);
                          }}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: ease.out }}
                          className="overflow-hidden"
                        >
                          <label htmlFor={`${uid}-${r.client_id}`} className="sr-only">
                            {t('reply')}
                          </label>
                          <textarea
                            id={`${uid}-${r.client_id}`}
                            autoFocus
                            rows={3}
                            maxLength={2000}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                void send(r);
                              }
                            }}
                            placeholder={t('placeholder')}
                            className="mt-3 w-full rounded-[12px] border border-a-border bg-a-bg/40 px-3 py-2.5 text-[0.875rem] leading-relaxed transition-[border-color,box-shadow] outline-none focus:border-a-text focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--a-text)_12%,transparent)]"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <Link
                              href={`/admin/clients/${r.client_id}?tab=messages`}
                              className="text-[0.75rem] font-semibold text-a-muted underline-offset-4 hover:text-a-text hover:underline"
                            >
                              {t('open')}
                            </Link>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => setOpenId(null)}>
                                {tc('cancel')}
                              </Button>
                              <Button
                                size="sm"
                                type="submit"
                                variant="primary"
                                state={state}
                                disabled={!draft.trim()}
                              >
                                {t('send')}
                              </Button>
                            </div>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
