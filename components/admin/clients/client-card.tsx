'use client';

import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { localeNames } from '@/lib/i18n/config';
import { daysBetween } from '@/lib/admin/practice-logic';
import { cn } from '@/lib/utils';
import type { ClientListItem, ClientStatus } from '@/types/admin';
import { Avatar, Meter, Sparkline, Spotlight } from '@/components/admin/fx';
import { Badge } from '@/components/admin/ui';

const STATUS_TONE: Record<ClientStatus, 'ok' | 'warn' | 'neutral'> = {
  active: 'ok',
  paused: 'warn',
  completed: 'neutral',
  archived: 'neutral',
};
/** A measurement older than this is worth a nudge. */
const STALE_DAYS = 21;

/**
 * One client at a glance, the way a dietitian scans a list before the day: who, how they are
 * doing (weight, its direction against THEIR goal, the last few weigh-ins), how far along the
 * goal is, and what is next — appointment, a stale measurement, missing consent, unread messages.
 */
export function ClientCard({
  client: c,
  onRestore,
  restoreLabel,
}: {
  client: ClientListItem;
  /** archived list: bring the client back */
  onRestore?: () => void;
  restoreLabel?: string;
}) {
  const t = useTranslations('admin.clients');
  const tc = useTranslations('admin.clients.card');
  // an application's goal saved as its code before it was stored as words
  const tg = useTranslations('admin.leads.app.goals');
  const format = useFormatter();
  const now = useNow();
  const kg = (v: number, sign = false) =>
    format.number(v, { maximumFractionDigits: 1, signDisplay: sign ? 'exceptZero' : 'auto' });

  const delta =
    c.last_weight != null && c.first_weight != null ? c.last_weight - c.first_weight : null;
  const goal = c.goal_weight_kg;
  // direction: toward the goal is good; with no goal, no colour judgement
  const wantDown = goal != null && c.first_weight != null ? goal < c.first_weight : null;
  const good =
    delta == null || delta === 0 || wantDown == null ? null : wantDown ? delta < 0 : delta > 0;
  const progress =
    goal != null && c.first_weight != null && c.last_weight != null && c.first_weight !== goal
      ? Math.max(0, Math.min(1, (c.first_weight - c.last_weight) / (c.first_weight - goal)))
      : null;
  // whole calendar days in Istanbul (a measurement from this morning is "today", never "-1")
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now);
  const days = c.last_measured_at
    ? Math.max(0, daysBetween(c.last_measured_at.slice(0, 10), today))
    : null;
  const stale = days != null && days > STALE_DAYS && c.status === 'active';

  return (
    <Spotlight className="group a-card h-full transition-[box-shadow,translate] duration-300 fine:hover:-translate-y-0.5 fine:hover:shadow-[0_0_0_1px_var(--a-card-ring),0_18px_40px_-24px_rgb(15_27_23/0.5)]">
      <Link href={`/admin/clients/${c.id}`} className="flex h-full flex-col p-4 outline-none">
        {/* who */}
        <div className="flex items-start gap-3">
          <span className="relative shrink-0">
            <Avatar name={c.full_name} size={44} />
            {c.unread > 0 && (
              <span
                className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-pill bg-paprika px-1 num text-[0.6875rem] font-semibold text-ink ring-2 ring-a-surface"
                title={tc('unread', { n: c.unread })}
              >
                {c.unread}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[1rem] font-semibold">{c.full_name}</span>
              {c.on_portal && (
                <span
                  className="size-2 shrink-0 rounded-full bg-a-ok"
                  title={tc('portal')}
                  aria-label={tc('portal')}
                />
              )}
            </span>
            <span className="mt-0.5 block truncate text-[0.8125rem] text-a-muted">
              {(c.goal && (tg.has(c.goal as 'energy') ? tg(c.goal as 'energy') : c.goal)) ??
                c.email ??
                c.phone ??
                '—'}
            </span>
          </span>
          <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
        </div>

        {/* how they are doing */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold tracking-wide text-a-muted uppercase">
              {tc('weight')}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="num-wide text-[1.75rem] leading-none">
                {c.last_weight != null ? kg(c.last_weight) : '—'}
              </span>
              {c.last_weight != null && <span className="text-[0.8125rem] text-a-muted">kg</span>}
              {delta != null && delta !== 0 && (
                <span
                  className={cn(
                    'inline-flex h-6 items-center rounded-pill px-2 num text-[0.75rem] font-semibold',
                    good === true &&
                      'bg-[color-mix(in_oklab,var(--a-ok)_16%,transparent)] text-a-ok',
                    good === false &&
                      'bg-[color-mix(in_oklab,var(--a-danger)_14%,transparent)] text-a-danger',
                    good == null && 'bg-a-surface-2 text-a-text',
                  )}
                >
                  {delta < 0 ? '▼' : '▲'} {kg(Math.abs(delta))}
                </span>
              )}
            </p>
          </div>
          {c.weights.length > 1 && (
            <Sparkline values={c.weights} height={40} className="w-28 shrink-0 text-a-chart" />
          )}
        </div>

        {/* the way to the goal */}
        {goal != null && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-[0.75rem]">
              <span className="text-a-muted">{tc('goal', { kg: kg(goal) })}</span>
              {progress != null && (
                <span className="num font-semibold">
                  {format.number(progress, { style: 'percent' })}
                </span>
              )}
            </div>
            <Meter value={progress ?? 0} className="h-1.5" />
          </div>
        )}

        {/* what is next */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-a-border pt-3 text-[0.75rem] [&]:mt-4">
          <Chip tone={c.next_appointment ? 'accent' : 'muted'}>
            <Glyph d="M4 6h16v14H4V6ZM4 10h16M9 3v4M15 3v4" />
            {c.next_appointment
              ? format.dateTime(new Date(c.next_appointment), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hourCycle: 'h23',
                })
              : tc('noAppointment')}
          </Chip>
          <Chip tone={stale ? 'warn' : 'muted'}>
            <Glyph d="M3 17l14-14 4 4L7 21H3v-4Z" />
            {days == null
              ? tc('noMeasurement')
              : days === 0
                ? tc('measuredToday')
                : tc('measuredAgo', { days })}
          </Chip>
          {!c.kvkk_consent_at && <Chip tone="danger">{t('consentNo')}</Chip>}
          <span className="ms-auto text-a-muted">{localeNames[c.preferred_language]}</span>
        </div>

        {onRestore && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRestore();
            }}
            className="mt-3 self-start text-[0.8125rem] font-semibold underline"
          >
            {restoreLabel}
          </button>
        )}
      </Link>
    </Spotlight>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: 'accent' | 'muted' | 'warn' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-pill px-2.5 font-semibold whitespace-nowrap',
        tone === 'accent' && 'bg-a-accent text-a-accent-text',
        tone === 'muted' && 'bg-a-surface-2 text-a-text/80',
        tone === 'warn' &&
          'bg-[color-mix(in_oklab,#e9b949_28%,transparent)] text-[#7a5a0e] dark:text-mustard',
        tone === 'danger' &&
          'bg-[color-mix(in_oklab,var(--a-danger)_14%,transparent)] text-a-danger',
      )}
    >
      {children}
    </span>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
