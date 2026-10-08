'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { convertLeadAction, setLeadStatusAction } from '@/app/admin/_actions/clients';
import { waNumber } from '@/lib/admin/signals';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { whatsappHref } from '@/lib/utils';
import type { Lead } from '@/types/admin';
import { Avatar } from '@/components/admin/fx';
import { Badge, EmptyState } from '@/components/admin/ui';
import { useApplicationSummary } from '@/components/admin/application-details';
import { WhatsAppIcon } from './agenda';

const pill =
  'inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-[0.75rem] font-semibold whitespace-nowrap transition-[background-color,transform,border-color] tap-44 active:scale-95';

/**
 * New enquiries from the website with the next step one tap away: call, WhatsApp (the
 * dietitian's own app opens — nothing is sent automatically), mark as contacted, or turn the
 * enquiry into a client record.
 */
export function LeadsPanel({ leads }: { leads: Lead[] }) {
  const t = useTranslations('admin.dashboard.leads');
  const tl = useTranslations('admin.leads');
  const summary = useApplicationSummary();
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const shown = leads.filter((l) => !gone.has(l.id));

  const contacted = async (l: Lead) => {
    setBusy(l.id);
    const res = await setLeadStatusAction(l.id, 'contacted');
    setBusy(null);
    if (!res.ok) return void toast.error(tc('error'));
    setGone((g) => new Set(g).add(l.id));
    toast.success(t('updated'));
    router.refresh();
  };
  const convert = async (l: Lead) => {
    setBusy(l.id);
    const res = await convertLeadAction(l.id);
    setBusy(null);
    if (!res.ok || !res.data) return void toast.error(tc('error'));
    toast.success(t('converted'));
    router.push(`/admin/clients/${res.data.id}?tab=general`);
  };

  return (
    <section className="a-card">
      <header className="flex items-center justify-between gap-3 border-b border-a-border px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-bold">
          {t('title')}
          {shown.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-pill bg-paprika px-1.5 num text-[0.6875rem] text-ink">
              {shown.length}
            </span>
          )}
        </h2>
        <Link
          href="/admin/leads"
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
            {shown.map((l) => {
              const phone = waNumber(l.phone);
              // the visitor's own words (wizard leads carry answers, shown on the leads page)
              const note = l.kind === 'application' ? summary(l.payload ?? {}) : l.message;
              return (
                <motion.li
                  key={l.id}
                  layout={!reduced}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{
                    opacity: 0,
                    x: reduced ? 0 : 40,
                    height: 0,
                    transition: { duration: 0.3 },
                  }}
                  transition={{ duration: 0.3, ease: ease.out }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    <Avatar name={l.name} size={34} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-semibold">{l.name}</span>
                        <Badge>{tl(`kinds.${l.kind}`)}</Badge>
                        <span className="ms-auto num text-[0.6875rem] text-a-muted">
                          {format.relativeTime(new Date(l.created_at))}
                        </span>
                      </div>
                      {note && (
                        <p className="mt-1 line-clamp-2 text-[0.8125rem] text-a-muted">{note}</p>
                      )}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {l.phone && (
                          <a
                            href={`tel:${l.phone.replace(/[^\d+]/g, '')}`}
                            className={`${pill} border border-a-border hover:bg-a-surface-2`}
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
                              <path
                                d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {t('call')}
                          </a>
                        )}
                        {phone && (
                          <a
                            href={whatsappHref(phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${pill} border border-a-border hover:border-[#25d366] hover:bg-[#25d366]/10`}
                          >
                            <WhatsAppIcon size={13} />
                            {t('whatsapp')}
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={busy === l.id}
                          onClick={() => contacted(l)}
                          className={`${pill} border border-a-border hover:bg-a-surface-2 disabled:opacity-50`}
                        >
                          {t('contacted')}
                        </button>
                        <button
                          type="button"
                          disabled={busy === l.id}
                          onClick={() => convert(l)}
                          className={`${pill} bg-a-accent text-a-accent-text hover:opacity-90 disabled:opacity-50`}
                        >
                          {t('convert')}
                        </button>
                      </div>
                    </div>
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
