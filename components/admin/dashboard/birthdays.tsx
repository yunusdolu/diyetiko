'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { BirthdayRow } from '@/lib/admin/insights';
import { waNumber } from '@/lib/admin/signals';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn, whatsappHref } from '@/lib/utils';
import { Avatar } from '@/components/admin/fx';
import { EmptyState } from '@/components/admin/ui';
import { WhatsAppIcon, type ReminderTemplates } from './agenda';

/** Birthdays of active clients in the coming week, with wishes in the client's own language. */
export function BirthdaysPanel({
  rows,
  templates,
  locale,
}: {
  rows: BirthdayRow[];
  templates: ReminderTemplates;
  locale: Locale;
}) {
  const t = useTranslations('admin.dashboard.birthdays');
  const reduced = usePrefersReducedMotion();
  const wish = (r: BirthdayRow) => {
    const tpl = templates[r.language] ?? templates[locale];
    const name =
      r.full_name
        .replace(/\(.*?\)/g, '')
        .trim()
        .split(/\s+/)[0] ?? '';
    return tpl.birthday.replace('{name}', name).replace('{signature}', tpl.signature);
  };
  return (
    <section className="a-card">
      <header className="flex items-center justify-between gap-3 border-b border-a-border px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-bold">
          <CakeIcon />
          {t('title')}
        </h2>
        <span className="text-[0.75rem] text-a-muted">{t('hint')}</span>
      </header>
      {rows.length === 0 ? (
        <EmptyState compact>{t('empty')}</EmptyState>
      ) : (
        <ul className="divide-y divide-a-border">
          {rows.map((r, i) => {
            const phone = waNumber(r.phone);
            const today = r.days === 0;
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: ease.out, delay: reduced ? 0 : 0.1 + i * 0.05 }}
                className={cn(
                  'flex items-center gap-3 px-5 py-3',
                  today && 'bg-[color-mix(in_oklab,var(--color-citrus)_14%,transparent)]',
                )}
              >
                <span className="relative">
                  <Avatar name={r.full_name} size={34} />
                  {today && !reduced && (
                    // a small burst around the avatar on the day itself
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-full ring-2 ring-citrus"
                      animate={{ scale: [1, 1.35], opacity: [0.9, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/admin/clients/${r.id}?tab=overview`}
                    className="block truncate font-semibold underline-offset-4 hover:underline"
                  >
                    {r.full_name}
                  </Link>
                  <span className="text-[0.75rem] text-a-muted">
                    <span className={cn(today && 'font-semibold text-a-text')}>
                      {today ? t('today') : t('inDays', { n: r.days })}
                    </span>{' '}
                    ·{' '}
                    {t('turns', { age: new Intl.NumberFormat(intlLocale(locale)).format(r.turns) })}
                  </span>
                </span>
                {phone && (
                  <a
                    href={whatsappHref(phone, wish(r))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap-44 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border border-a-border px-3 text-[0.75rem] font-semibold transition-[background-color,border-color,transform] hover:border-[#25d366] hover:bg-[#25d366]/10 active:scale-95"
                  >
                    <WhatsAppIcon size={13} />
                    {t('congratulate')}
                  </a>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CakeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="text-paprika">
      <path
        d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 5 0M12 12V8M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
