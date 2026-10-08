'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { setAppointmentStatusAction } from '@/app/admin/_actions/tasks';
import type { Agenda, AgendaItem } from '@/lib/admin/insights';
import { waNumber } from '@/lib/admin/signals';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { admin, ease } from '@/lib/motion';
import { useDir, usePrefersReducedMotion } from '@/lib/motion/hooks';
import { addDays, todayISO } from '@/lib/portal/logic';
import { cn, whatsappHref } from '@/lib/utils';
import type { Appointment } from '@/types/admin';
import { Avatar } from '@/components/admin/fx';
import { Badge, EmptyState } from '@/components/admin/ui';

/** What a reminder says, per client language (loaded on the server from the message files). */
export type ReminderTemplates = Record<
  Locale,
  {
    text: string;
    /** birthday wishes */
    birthday: string;
    kinds: Record<Appointment['kind'], string>;
    signature: string;
  }
>;

const TZ = 'Europe/Istanbul';

/** The WhatsApp text in the CLIENT's language, with their first name and the time in Istanbul. */
export function reminderText(item: AgendaItem, templates: ReminderTemplates, fallback: Locale) {
  const lang = item.language ?? fallback;
  const tpl = templates[lang] ?? templates[fallback];
  const at = new Date(item.starts_at);
  const loc = intlLocale(lang);
  const fill: Record<string, string> = {
    name:
      (item.client_name ?? '')
        .replace(/\(.*?\)/g, '')
        .trim()
        .split(/\s+/)[0] ?? '',
    day: new Intl.DateTimeFormat(loc, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: TZ,
    }).format(at),
    time: new Intl.DateTimeFormat(loc, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: TZ,
    }).format(at),
    kind: tpl.kinds[item.kind],
    signature: tpl.signature,
  };
  return tpl.text.replace(/\{(\w+)\}/g, (m, k: string) => fill[k] ?? m);
}

export function AgendaPanel({
  agenda,
  templates,
  locale,
}: {
  agenda: Agenda;
  templates: ReminderTemplates;
  locale: Locale;
}) {
  const t = useTranslations('admin.dashboard.agenda');
  const ta = useTranslations('admin.appointments');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const dir = useDir();
  // ticks every 30 s: moves the "now" line and turns past appointments into "how did it go?"
  const now = useNow({ updateInterval: 30_000 });
  const today = todayISO(now);
  // the week ahead, starting today; the strip picks the day shown below it
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [picked, setPicked] = useState(0);
  const day = week[picked]!;
  const isToday = picked === 0;
  const [direction, setDirection] = useState(1);
  const [status, setStatus] = useState<Record<string, Appointment['status']>>({});

  const dayOf = (iso: string) => todayISO(new Date(iso));
  const byDay = new Map(week.map((d) => [d, agenda.items.filter((a) => dayOf(a.starts_at) === d)]));
  const items = byDay.get(day) ?? [];
  const pick = (i: number) => {
    setDirection(i >= picked ? 1 : -1);
    setPicked(i);
  };
  const weekday = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), { weekday: 'short', timeZone: 'UTC' });
  const dateNum = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), { day: 'numeric', timeZone: 'UTC' });
  const time = (iso: string, plusMin = 0) =>
    format.dateTime(new Date(Date.parse(iso) + plusMin * 6e4), {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  // the "now" line sits before the first appointment that has not started yet
  const nowIndex = isToday
    ? (() => {
        const i = items.findIndex((a) => Date.parse(a.starts_at) > now.getTime());
        return i === -1 ? items.length : i;
      })()
    : -1;

  const mark = async (a: AgendaItem, next: Appointment['status']) => {
    setStatus((s) => ({ ...s, [a.id]: next }));
    const res = await setAppointmentStatusAction(a.id, next);
    if (!res.ok) {
      setStatus(({ [a.id]: _drop, ...rest }) => rest);
      toast.error(tc('error'));
      return;
    }
    toast.success(t('updated'));
    router.refresh();
  };

  const nowLine = (
    <motion.li
      key="now"
      layoutId={reduced ? undefined : 'agenda-now'}
      className="relative flex items-center gap-3 py-1 ps-[3.75rem]"
      aria-label={`${t('now')} ${time(now.toISOString())}`}
    >
      <span className="absolute start-[3.25rem] grid size-3 -translate-x-1/2 place-items-center rtl:translate-x-1/2">
        <span className="absolute inline-flex size-3 rounded-full bg-paprika opacity-60 motion-safe:animate-ping" />
        <span className="relative size-2 rounded-full bg-paprika" />
      </span>
      <span className="h-px flex-1 bg-paprika/60" />
      <span className="num text-[0.6875rem] font-semibold text-paprika-deep dark:text-paprika">
        {t('now')} · {time(now.toISOString())}
      </span>
    </motion.li>
  );

  return (
    <section className="a-card">
      <header className="border-b border-a-border px-4 pt-3.5 pb-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[0.9375rem] font-bold">{t('title')}</h2>
          <Link
            href="/admin/appointments"
            className="text-[0.75rem] font-semibold text-a-muted underline-offset-4 hover:text-a-text hover:underline"
          >
            {t('all')}
          </Link>
        </div>
        <LayoutGroup id="agenda-week">
          <div
            role="tablist"
            aria-label={t('title')}
            className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5"
          >
            {week.map((d, i) => {
              const on = i === picked;
              const n = (byDay.get(d) ?? []).filter((a) => a.status !== 'cancelled').length;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={`${format.dateTime(new Date(`${d}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}: ${n}`}
                  onClick={() => pick(i)}
                  className={cn(
                    'relative flex min-w-0 flex-col items-center rounded-[14px] py-2 transition-colors',
                    on
                      ? 'text-a-accent-text'
                      : 'text-a-muted hover:bg-a-surface-2 hover:text-a-text',
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId="agenda-week-pill"
                      className="absolute inset-0 rounded-[14px] bg-a-accent shadow-[0_10px_22px_-14px_rgb(15_27_23/0.7)]"
                      transition={admin.spring}
                    />
                  )}
                  <span className="relative truncate text-[0.625rem] font-bold tracking-[0.04em] uppercase sm:text-[0.6875rem]">
                    {i === 0 ? t('today') : weekday(d)}
                  </span>
                  <span className="relative num-wide text-[1.125rem] leading-tight sm:text-[1.25rem]">
                    {dateNum(d)}
                  </span>
                  {/* one dot per appointment (up to three) */}
                  <span className="relative mt-1 flex h-1.5 gap-0.5" aria-hidden>
                    {Array.from({ length: Math.min(n, 3) }, (_, k) => (
                      <motion.span
                        key={k}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: reduced ? 0 : 0.3 + i * 0.04 + k * 0.05,
                          type: 'spring',
                          stiffness: 500,
                          damping: 22,
                        }}
                        className={cn(
                          'size-1.5 rounded-full',
                          on ? 'bg-a-accent-text' : 'bg-paprika',
                        )}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      </header>

      <div className={items.length ? 'p-3 sm:p-4' : undefined}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={day}
            initial={{ opacity: 0, x: reduced ? 0 : 18 * direction * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduced ? 0 : -12 * direction * dir }}
            transition={{ duration: 0.22, ease: ease.out }}
          >
            {items.length === 0 ? (
              <EmptyState
                compact
                action={
                  agenda.next ? (
                    <p className="text-[0.8125rem] text-a-text">
                      {t('next', {
                        when: format.dateTime(new Date(agenda.next.starts_at), {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hourCycle: 'h23',
                        }),
                      })}{' '}
                      · {agenda.next.client_name ?? agenda.next.title}
                    </p>
                  ) : (
                    <Link
                      href="/admin/appointments?new=1"
                      className="text-[0.8125rem] font-semibold underline-offset-4 hover:underline"
                    >
                      {t('add')}
                    </Link>
                  )
                }
              >
                {isToday ? t('empty') : t('emptyDay')}
              </EmptyState>
            ) : (
              <ol className="relative">
                {/* the rail */}
                <span
                  aria-hidden
                  className="absolute start-[3.25rem] top-3 bottom-3 w-px bg-a-border"
                />
                {items.map((a, i) => {
                  const s = status[a.id] ?? a.status;
                  const started = Date.parse(a.starts_at) <= now.getTime();
                  const phone = waNumber(a.phone);
                  return (
                    <Fragment key={a.id}>
                      {i === nowIndex && nowLine}
                      <motion.li layout={!reduced} className="relative flex gap-3 py-1.5">
                        <span className="w-10 shrink-0 pt-3 text-end num text-[0.8125rem] font-semibold">
                          {time(a.starts_at)}
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            'relative z-10 mt-[1.05rem] size-2.5 shrink-0 rounded-full ring-4 ring-a-surface',
                            s === 'done'
                              ? 'bg-a-ok'
                              : s === 'scheduled'
                                ? started
                                  ? 'bg-a-warn'
                                  : 'bg-a-text'
                                : 'bg-a-muted/50',
                          )}
                        />
                        <div
                          className={cn(
                            'min-w-0 flex-1 rounded-[14px] border border-a-border bg-a-bg/40 px-3.5 py-3 transition-colors',
                            s === 'cancelled' && 'opacity-60',
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <Avatar name={a.client_name ?? a.title ?? '?'} size={32} />
                            <div className="min-w-[min(100%,13rem)] flex-1 basis-0">
                              {a.client_id ? (
                                <Link
                                  href={`/admin/clients/${a.client_id}?tab=overview`}
                                  className={cn(
                                    'block truncate font-semibold underline-offset-4 hover:underline',
                                    s === 'cancelled' && 'line-through',
                                  )}
                                >
                                  {a.client_name}
                                </Link>
                              ) : (
                                <span className="block truncate font-semibold">
                                  {a.title ?? '—'}
                                </span>
                              )}
                              <span className="text-[0.75rem] text-a-muted">
                                {ta(`kinds.${a.kind}`)} ·{' '}
                                <bdi dir="ltr" className="num">
                                  {time(a.starts_at)}–{time(a.starts_at, a.duration_min)}
                                </bdi>
                              </span>
                            </div>
                            <AnimatePresence mode="popLayout" initial={false}>
                              {s !== 'scheduled' ? (
                                <motion.span
                                  key={s}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={admin.spring}
                                >
                                  <Badge
                                    tone={
                                      s === 'done' ? 'ok' : s === 'no_show' ? 'warn' : 'neutral'
                                    }
                                  >
                                    {s === 'done' && <CheckIcon />}
                                    {ta(`statuses.${s}`)}
                                  </Badge>
                                </motion.span>
                              ) : started ? (
                                <motion.div
                                  key="mark"
                                  className="flex items-center gap-1.5"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                >
                                  <span className="sr-only">{t('mark')}</span>
                                  <button
                                    type="button"
                                    onClick={() => mark(a, 'done')}
                                    className="tap-44 inline-flex h-8 items-center gap-1.5 rounded-pill bg-a-accent px-3 text-[0.75rem] font-semibold text-a-accent-text transition-transform hover:opacity-90 active:scale-95"
                                  >
                                    <CheckIcon />
                                    {t('came')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => mark(a, 'no_show')}
                                    className="tap-44 inline-flex h-8 items-center rounded-pill border border-a-border px-3 text-[0.75rem] font-semibold transition-transform hover:bg-a-surface-2 active:scale-95"
                                  >
                                    {t('noShow')}
                                  </button>
                                </motion.div>
                              ) : phone ? (
                                <motion.a
                                  key="remind"
                                  href={whatsappHref(phone, reminderText(a, templates, locale))}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={t('remindLabel', { name: a.client_name ?? '' })}
                                  className="tap-44 inline-flex h-8 items-center gap-1.5 rounded-pill border border-a-border px-3 text-[0.75rem] font-semibold transition-colors hover:border-[#25d366] hover:bg-[#25d366]/10"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                >
                                  <WhatsAppIcon />
                                  {t('remind')}
                                </motion.a>
                              ) : null}
                            </AnimatePresence>
                          </div>
                          {a.note && (
                            <p className="mt-2 line-clamp-2 text-[0.75rem] text-a-muted">
                              {a.note}
                            </p>
                          )}
                        </div>
                      </motion.li>
                    </Fragment>
                  );
                })}
                {nowIndex === items.length && nowLine}
              </ol>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        fill="#25d366"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3Z"
      />
    </svg>
  );
}
