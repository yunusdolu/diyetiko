'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AttentionRow, Reason, ReasonKind } from '@/lib/admin/signals';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/admin/fx';
import { EmptyState } from '@/components/admin/ui';

const TONE: Record<ReasonKind, string> = {
  unread: 'bg-a-accent text-a-accent-text',
  driftAway: 'bg-[color-mix(in_oklab,var(--a-warn)_18%,transparent)] text-a-warn',
  overdueTasks: 'bg-[color-mix(in_oklab,var(--a-warn)_18%,transparent)] text-a-warn',
  noConsent: 'bg-[color-mix(in_oklab,var(--a-danger)_12%,transparent)] text-a-danger',
  quiet: 'bg-a-surface-2 text-a-text',
  measureDue: 'bg-a-surface-2 text-a-text',
  noAppointment: 'bg-a-surface-2 text-a-text',
};

const SHOWN = 5;

export function useReasonText() {
  const t = useTranslations('admin.dashboard.attention.reasons');
  const format = useFormatter();
  return (r: Reason) => {
    switch (r.kind) {
      case 'unread':
      case 'overdueTasks':
        return t(r.kind, { count: r.value ?? 0 });
      case 'quiet':
        return t('quiet', { days: r.value ?? 0 });
      case 'measureDue':
        return r.value == null ? t('measureNever') : t('measureDue', { days: r.value });
      case 'driftAway':
        return t('driftAway', { kg: format.number(r.value ?? 0, { maximumFractionDigits: 1 }) });
      default:
        return t(r.kind);
    }
  };
}

export function AttentionPanel({ rows }: { rows: AttentionRow[] }) {
  const t = useTranslations('admin.dashboard.attention');
  const text = useReasonText();
  const reduced = usePrefersReducedMotion();
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <section className="a-card">
      <header className="flex items-start justify-between gap-3 border-b border-a-border px-5 py-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-[0.9375rem] font-bold">
            {t('title')}
            {rows.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-pill bg-paprika px-1.5 num text-[0.6875rem] text-ink">
                {rows.length}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-[0.75rem] text-a-muted">{t('hint')}</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <EmptyState compact>{t('empty')}</EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-a-border">
            <AnimatePresence initial={false}>
              {shown.map((r, i) => (
                <motion.li
                  key={r.id}
                  layout={!reduced}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    duration: 0.28,
                    ease: ease.out,
                    delay: i >= SHOWN ? (i - SHOWN) * 0.03 : 0,
                  }}
                  className="overflow-hidden"
                >
                  <div className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-a-surface-2/50">
                    <Avatar name={r.full_name} size={34} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/clients/${r.id}?tab=${r.reasons[0]!.tab}`}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        {r.full_name}
                      </Link>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.reasons.map((reason) => (
                          <li key={reason.kind}>
                            <Link
                              href={`/admin/clients/${r.id}?tab=${reason.tab}`}
                              className={cn(
                                'inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-[0.75rem] font-semibold whitespace-nowrap transition-transform hover:-translate-y-px',
                                TONE[reason.kind],
                              )}
                            >
                              <ReasonIcon kind={reason.kind} />
                              {text(reason)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden
                      className="mt-2 shrink-0 text-a-muted opacity-0 transition-[opacity,translate] group-hover:translate-x-0.5 group-hover:opacity-100 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                    >
                      <path
                        d="M9 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {rows.length > SHOWN && (
            <div className="border-t border-a-border px-5 py-2.5">
              <button
                type="button"
                aria-expanded={all}
                onClick={() => setAll((v) => !v)}
                className="text-[0.8125rem] font-semibold underline-offset-4 hover:underline"
              >
                {all ? t('showLess') : t('showAll', { count: rows.length })}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ReasonIcon({ kind }: { kind: ReasonKind }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden className="shrink-0">
      {kind === 'unread' && <path {...common} d="M4 5h16v11H8l-4 4V5Z" />}
      {kind === 'driftAway' && <path {...common} d="M4 17l6-6 4 4 6-7M15 8h5v5" />}
      {kind === 'quiet' && (
        <path {...common} d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      )}
      {kind === 'noConsent' && (
        <path
          {...common}
          d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3ZM12 9v4M12 16h.01"
        />
      )}
      {kind === 'overdueTasks' && <path {...common} d="M5 12l4 4L19 6M12 21a9 9 0 1 0 0-18" />}
      {kind === 'measureDue' && (
        <path {...common} d="M3 17l14-14 4 4L7 21H3v-4ZM12 8l2 2M9 11l2 2M15 5l2 2" />
      )}
      {kind === 'noAppointment' && <path {...common} d="M4 7h16v13H4V7ZM4 11h16M9 3v4M15 3v4" />}
    </svg>
  );
}
