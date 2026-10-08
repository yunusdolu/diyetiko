'use client';

import { motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { localeNames } from '@/lib/i18n/config';
import { ease } from '@/lib/motion';
import { waNumber } from '@/lib/admin/signals';
import { cn, whatsappHref } from '@/lib/utils';
import type { Lead } from '@/types/admin';
import { Badge } from '@/components/admin/ui';

type T = ReturnType<typeof useTranslations<'admin.leads.app'>>;

/** A label from the application's own lists; an unexpected value is shown as it came. */
function pick(t: T, group: string, v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const key = `${group}.${v}`;
  return t.has(key as 'durations.m3') ? t(key as 'durations.m3') : v;
}
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** "6 ay · Online · Sürdürülebilir şekilde kilo vermek" — for list rows and the dashboard. */
export function useApplicationSummary() {
  const t = useTranslations('admin.leads.app');
  return (p: Record<string, unknown>) =>
    [pick(t, 'durations', p.duration), pick(t, 'formats', p.format), pick(t, 'goals', p.goal)]
      .filter(Boolean)
      .join(' · ');
}

/**
 * A programme application as the dietitian reads it, top to bottom in the order of the first
 * phone call: what they want (length, format, start), how to reach them, then the person —
 * goal, measures, health, their own words. Every question is listed; an unanswered one says so,
 * so nothing looks lost.
 */
export function ApplicationDetails({ lead }: { lead: Lead }) {
  const t = useTranslations('admin.leads.app');
  const tl = useTranslations('admin.leads');
  const format = useFormatter();
  const p = lead.payload ?? {};
  const none = t('none');
  const h = num(p.heightCm);
  const w = num(p.weightKg);
  const bmi = h && w ? Math.round((w / (h / 100) ** 2) * 10) / 10 : null;
  const conditions = Array.isArray(p.conditions)
    ? p.conditions.map((c) => pick(t, 'conditions', c)).filter((c): c is string => Boolean(c))
    : [];
  const phone = waNumber(lead.phone);
  const reach = [pick(t, 'channels', p.preferred), pick(t, 'times', p.contactTime)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-4">
      {/* what they ask for */}
      <section className="overflow-hidden rounded-[16px] bg-a-accent text-a-accent-text">
        <div className="grid grid-cols-3">
          {(
            [
              [t('duration'), pick(t, 'durations', p.duration)],
              [t('format'), pick(t, 'formats', p.format)],
              [t('start'), pick(t, 'starts', p.start)],
            ] as const
          ).map(([label, value], i) => (
            <motion.div
              key={label}
              className={cn('min-w-0 px-4 py-3.5', i > 0 && 'border-s border-current/15')}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: ease.out }}
            >
              <p className="text-[0.6875rem] font-semibold tracking-wide uppercase opacity-70">
                {label}
              </p>
              <p className="mt-1 truncate text-[1.125rem] leading-tight font-bold">
                {value ?? '—'}
              </p>
            </motion.div>
          ))}
        </div>
        {p.termsAccepted === true && (
          <p className="flex items-center gap-2 border-t border-current/15 px-4 py-2 text-[0.75rem] font-semibold">
            <Check /> {t('termsAccepted')}
          </p>
        )}
      </section>

      {/* how to reach them */}
      <section className="rounded-[16px] border border-a-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.75rem] font-semibold text-a-muted">{t('reach')}</p>
            <p className="mt-0.5 font-semibold">{reach || none}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lead.phone && (
              <a
                href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}
                className="inline-flex h-9 items-center rounded-pill border border-a-border px-3.5 text-[0.8125rem] font-semibold hover:bg-a-surface-2"
              >
                {t('call')}
              </a>
            )}
            {phone && (
              <a
                href={whatsappHref(phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center rounded-pill border border-a-border px-3.5 text-[0.8125rem] font-semibold hover:border-[#25d366] hover:bg-[#25d366]/10"
              >
                WhatsApp
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex h-9 items-center rounded-pill border border-a-border px-3.5 text-[0.8125rem] font-semibold hover:bg-a-surface-2"
              >
                {t('email')}
              </a>
            )}
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-a-border pt-3 text-[0.8125rem] sm:grid-cols-2">
          <Pair label={t('phone')}>
            <span className="num" dir="ltr">
              {lead.phone ?? none}
            </span>
          </Pair>
          <Pair label={t('email')}>
            <span className="break-all" dir="ltr">
              {lead.email ?? none}
            </span>
          </Pair>
          <Pair label={t('language')}>{localeNames[lead.locale]}</Pair>
          <Pair label={t('sent')}>
            {format.dateTime(new Date(lead.created_at), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Pair>
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title={t('goal')} icon="target">
          <p className="font-semibold">{pick(t, 'goals', p.goal) ?? none}</p>
          {text(p.goalNote) && (
            <p className="mt-2 text-[0.875rem] leading-relaxed whitespace-pre-wrap text-a-muted">
              “{text(p.goalNote)}”
            </p>
          )}
        </Card>

        <Card title={t('person')} icon="person">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Fact label={t('sex')}>{pick(t, 'sexes', p.sex) ?? none}</Fact>
            <Fact label={t('age')}>{num(p.age) ?? none}</Fact>
            <Fact label={t('height')}>{h ? `${h} cm` : none}</Fact>
            <Fact label={t('weight')}>{w ? `${w} kg` : none}</Fact>
            {bmi && (
              <Fact label={t('bmi')}>{format.number(bmi, { maximumFractionDigits: 1 })}</Fact>
            )}
            <Fact label={t('activity')}>{pick(t, 'activities', p.activity) ?? none}</Fact>
          </dl>
        </Card>

        <Card title={t('health')} icon="health" className="sm:col-span-2">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-[0.75rem] font-semibold text-a-muted">{t('conditionsLabel')}</dt>
              <dd className="mt-1.5">
                {conditions.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {conditions.map((c) => (
                      <Badge key={c} tone="warn">
                        {c}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-[0.875rem]">{none}</span>
                )}
              </dd>
            </div>
            <Fact label={t('prior')}>{pick(t, 'yesNo', p.priorDietitian) ?? none}</Fact>
            <Fact label={t('medications')}>{text(p.medications) ?? none}</Fact>
            <Fact label={t('allergies')}>{text(p.allergies) ?? none}</Fact>
          </dl>
        </Card>

        <Card title={t('message')} icon="note" className="sm:col-span-2">
          <p
            className={cn(
              'text-[0.9375rem] leading-relaxed whitespace-pre-wrap',
              !lead.message && 'text-a-muted',
            )}
          >
            {lead.message ?? none}
          </p>
        </Card>
      </div>

      <p className="text-[0.75rem] text-a-muted">
        KVKK ·{' '}
        {tl('consent', {
          date: format.dateTime(new Date(lead.consent_at), {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          version: lead.consent_version,
        })}
      </p>
    </div>
  );
}

const ICONS = {
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01',
  person: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c1.4-4 4.4-6 8-6s6.6 2 8 6',
  health: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10ZM9 11h6M12 8v6',
  note: 'M5 4h10l4 4v12H5V4ZM14 4v5h5M8 13h8M8 16.5h5',
} as const;

function Card({
  title,
  icon,
  className,
  children,
}: {
  title: string;
  icon: keyof typeof ICONS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('a-well p-4', className)}>
      <h3 className="mb-3 flex items-center gap-2 text-[0.8125rem] font-bold">
        <span className="grid size-7 place-items-center rounded-full bg-a-surface-2">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={ICONS[icon]} />
          </svg>
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.75rem] font-semibold text-a-muted">{label}</dt>
      <dd className="mt-0.5 text-[0.875rem] break-words">{children}</dd>
    </div>
  );
}

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="shrink-0 text-a-muted">{label}</dt>
      <dd className="min-w-0 font-semibold">{children}</dd>
    </div>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}
