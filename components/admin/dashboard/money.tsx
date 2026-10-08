'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { PracticeMoney } from '@/lib/admin/practice';
import type { Currency } from '@/lib/admin/practice-logic';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/admin/fx';
import { EmptyState } from '@/components/admin/ui';
import { SessionTrack, useMoney } from '@/components/admin/clients/billing';

/**
 * "Tahsilat": what came in this month (against last month), what is still owed on open packages,
 * and the packages worth a word with the client — last session, finished, or unpaid.
 */
export function MoneyPanel({ data }: { data: PracticeMoney | null }) {
  const t = useTranslations('admin.dashboard.money');
  const tb = useTranslations('admin.billing');
  const money = useMoney();
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const join = (list: { amount: number; currency: Currency }[]) =>
    list.map((x) => money(x.amount, x.currency)).join(' + ');

  return (
    <section className="a-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-a-border px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-bold">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="6" width="18" height="12" rx="2.5" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M6.5 9.5v.01M17.5 14.5v.01" />
          </svg>
          {t('title')}
        </h2>
      </header>
      {!data ? (
        <EmptyState compact>{t('migration')}</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 divide-x divide-a-border rtl:divide-x-reverse">
            <div className="min-w-0 px-5 py-4">
              <p className="text-[0.75rem] font-semibold text-a-muted">{t('month')}</p>
              <p className="mt-1.5 num-wide text-[clamp(1.25rem,3.4vw,1.75rem)] leading-tight break-words">
                {data.month.length ? join(data.month) : money(0, 'TRY')}
              </p>
              <p className="mt-1 text-[0.75rem] text-a-muted">
                {data.lastMonth.length
                  ? t('vsLast', { amount: join(data.lastMonth) })
                  : t('lastNone')}
              </p>
            </div>
            <div className="min-w-0 px-5 py-4">
              <p className="text-[0.75rem] font-semibold text-a-muted">{t('due')}</p>
              <p
                className={cn(
                  'mt-1.5 num-wide text-[clamp(1.25rem,3.4vw,1.75rem)] leading-tight break-words',
                  data.due.length && 'text-a-danger',
                )}
              >
                {data.due.length ? join(data.due) : '—'}
              </p>
              {!data.due.length && (
                <p className="mt-1 text-[0.75rem] text-a-muted">{t('nothingDue')}</p>
              )}
            </div>
          </div>
          <div className="border-t border-a-border">
            <p className="px-5 pt-3.5 text-[0.75rem] font-semibold tracking-wide text-a-muted uppercase">
              {t('watch')}
            </p>
            {!data.watch.length ? (
              <EmptyState compact>{t('empty')}</EmptyState>
            ) : (
              <ul className="divide-y divide-a-border">
                {data.watch.slice(0, 5).map((p, i) => {
                  const reason =
                    p.state === 'done'
                      ? t('reason.done')
                      : p.state === 'ending'
                        ? p.sessions_total != null && p.sessions_total - p.used === 1
                          ? t('reason.ending')
                          : `${t('reason.endingWeek')} · ${format.dateTime(new Date(`${p.ends_on}T12:00:00`), { day: 'numeric', month: 'short' })}`
                        : null;
                  return (
                    <motion.li
                      key={p.id}
                      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        ease: ease.out,
                        delay: reduced ? 0 : 0.1 + i * 0.05,
                      }}
                    >
                      <Link
                        href={`/admin/clients/${p.client_id}?tab=billing`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-a-surface-2"
                      >
                        <Avatar name={p.client_name} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{p.client_name}</span>
                          <span className="block truncate text-[0.75rem] text-a-muted">
                            {p.name}
                            {p.sessions_total != null &&
                              ` · ${tb('used', { used: Math.min(p.used, p.sessions_total), total: p.sessions_total })}`}
                          </span>
                          {p.sessions_total != null && p.sessions_total <= 24 && (
                            <span className="mt-1.5 block max-w-[12rem]">
                              <SessionTrack
                                total={p.sessions_total}
                                used={Math.min(p.used, p.sessions_total)}
                              />
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 text-end">
                          {reason && (
                            <span
                              className={cn(
                                'inline-flex h-6 items-center rounded-pill px-2.5 text-[0.6875rem] font-semibold whitespace-nowrap',
                                p.state === 'done'
                                  ? 'bg-a-surface-2 text-a-text'
                                  : 'bg-[color-mix(in_oklab,#e9b949_28%,transparent)] text-[#7a5a0e] dark:text-mustard',
                              )}
                            >
                              {reason}
                            </span>
                          )}
                          {(p.due ?? 0) > 0 && (
                            <span className="num text-[0.75rem] font-semibold whitespace-nowrap text-a-danger">
                              {t('reason.unpaid', { amount: money(p.due!, p.currency) })}
                            </span>
                          )}
                        </span>
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
