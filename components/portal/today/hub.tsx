'use client';

import { motion, useInView } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { sendMessageAction } from '@/app/panel/_actions';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { appointmentIcs, PORTAL_TZ, WATER_GOAL_ML, type WeekDigest } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import type { Appointment, Checkin } from '@/types/portal';
import { ClipIcon, UPLOAD_ACCEPT, UPLOAD_MAX_BYTES } from '@/components/ui/file-chip';
import { CalendarIcon, ProgressIcon, SendIcon } from '../icons';

/* ------------------------------------------------------------------------------------------------
 * The dietitian, on the Today page: who they are, what they last said, and the shortest ways to
 * reach them — an answer typed right here, a lab report sent as a file, the week sent as a note —
 * plus the next meeting with a way into the client's own calendar.
 * ---------------------------------------------------------------------------------------------- */

export function DietitianCard({
  name,
  last,
  unread,
  next,
  uploads,
  digest,
}: {
  name: string | null;
  last: { body: string; at: string; hasFile: boolean } | null;
  unread: number;
  next: Appointment | null;
  uploads: boolean;
  digest: WeekDigest;
}) {
  const t = useTranslations('portal.hub');
  const tk = useTranslations('portal.appointmentKinds');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const il = intlLocale(locale);
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<'text' | 'file' | 'week' | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const who = name ?? t('dietitian');
  const initials = who
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toLocaleUpperCase(il);

  const send = async (text: string, kind: 'text' | 'week') => {
    if (!text.trim() || busy) return;
    setBusy(kind);
    const res = await sendMessageAction({ body: text.trim().slice(0, 2000), diaryMealId: null });
    setBusy(null);
    if (!res.ok)
      return void toast.error(res.error === 'rateLimited' ? t('rateLimited') : t('error'));
    if (kind === 'text') setBody('');
    toast.success(kind === 'week' ? t('weekSent') : t('sent'));
    router.refresh();
  };

  const sendFile = async (f: File | undefined) => {
    if (!f || busy) return;
    if (f.size > UPLOAD_MAX_BYTES) return void toast.error(t('fileTooLarge'));
    if (!UPLOAD_ACCEPT.split(',').includes(f.type)) return void toast.error(t('fileType'));
    setBusy('file');
    const form = new FormData();
    form.set('file', f);
    form.set('body', body.trim().slice(0, 2000));
    const res = await fetch('/api/portal/attachment', { method: 'POST', body: form }).catch(
      () => null,
    );
    setBusy(null);
    if (!res?.ok) {
      const { error } = ((await res?.json().catch(() => ({}))) ?? {}) as { error?: string };
      return void toast.error(
        error === 'tooLarge' ? t('fileTooLarge') : error === 'type' ? t('fileType') : t('error'),
      );
    }
    setBody('');
    toast.success(t('fileSent'));
    router.refresh();
  };

  const day = (iso: string) =>
    new Intl.DateTimeFormat(il, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${iso}T12:00:00Z`),
    );
  const nf = (v: number, d = 1) =>
    new Intl.NumberFormat(il, { maximumFractionDigits: d }).format(v);
  /** the week in one message, in the client's own words and language */
  const weekText = () =>
    [
      t('week.title', { from: day(digest.from), to: day(digest.to) }),
      t('week.days', { count: digest.days }),
      digest.waterAvg != null ? t('week.water', { litres: nf(digest.waterAvg / 1000) }) : null,
      digest.activityMin > 0
        ? t('week.activity', { min: digest.activityMin, days: digest.activeDays })
        : null,
      digest.weightFrom != null && digest.weightTo != null
        ? digest.weightFrom === digest.weightTo
          ? t('week.weightOne', { kg: nf(digest.weightTo) })
          : t('week.weight', { from: nf(digest.weightFrom), to: nf(digest.weightTo) })
        : null,
    ]
      .filter(Boolean)
      .join('\n');

  const addToCalendar = () => {
    if (!next) return;
    const ics = appointmentIcs({
      startsAt: next.startsAt,
      durationMin: next.durationMin,
      title: t('icsTitle', { name: who }),
      description: tk(next.kind),
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'randevu.ics';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const nextDate = next ? new Date(next.startsAt) : null;
  return (
    <section className="p-card flex h-full flex-col overflow-hidden">
      <header className="flex min-h-[3.375rem] items-center gap-3 border-b border-ink/10 px-5 py-2.5 sm:px-6">
        <span
          aria-hidden
          className="relative grid size-10 shrink-0 place-items-center rounded-full bg-green text-[0.9375rem] font-bold text-paper"
        >
          {initials}
          <span className="absolute -end-0.5 -bottom-0.5 size-3.5 rounded-full bg-citrus ring-2 ring-paper" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label text-ink-60">{t('yourDietitian')}</p>
          <h2 className="truncate text-[1.0625rem] leading-tight font-bold tracking-[-0.01em]">
            {who}
          </h2>
        </div>
        {unread > 0 && (
          <Link
            href="/panel/messages"
            className="shrink-0 rounded-pill bg-paprika px-2.5 py-1 text-[0.75rem] font-bold text-ink"
          >
            {t('unread', { count: unread })}
          </Link>
        )}
      </header>

      <div className="flex-1 space-y-4 px-5 py-5 sm:px-6">
        {/* what they last said */}
        <Link href="/panel/messages" className="group block">
          {last ? (
            <>
              <p
                dir="auto"
                className="relative line-clamp-3 rounded-[16px] rounded-es-[6px] bg-paper-2 px-4 py-3 text-[0.9375rem] leading-relaxed transition-colors group-hover:bg-paper-3"
              >
                {last.hasFile && (
                  <span className="me-1.5 inline-block align-[-2px]">
                    <ClipIcon size={14} />
                  </span>
                )}
                {last.body}
              </p>
              <p className="mt-1.5 px-1 text-[0.75rem] text-ink-60">
                {format.relativeTime(new Date(last.at))}
              </p>
            </>
          ) : (
            <p className="rounded-[16px] border-[1.5px] border-dashed border-ink/20 px-4 py-3 text-[0.9375rem] text-ink-60">
              {t('noMessages')}
            </p>
          )}
        </Link>

        {/* an answer typed right here */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(body, 'text');
          }}
          className="flex items-center gap-2 rounded-pill border-[1.5px] border-ink/20 bg-paper py-1 ps-4 pe-1 focus-within:border-ink"
        >
          <label htmlFor="hub-reply" className="sr-only">
            {t('replyPlaceholder')}
          </label>
          <input
            id="hub-reply"
            dir="auto"
            value={body}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('replyPlaceholder')}
            className="h-10 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-ink-60"
          />
          <button
            type="submit"
            disabled={!body.trim() || busy != null}
            aria-label={t('send')}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-paper transition-[opacity,scale] hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
          >
            <SendIcon size={17} />
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {uploads && (
            <>
              <input
                ref={picker}
                type="file"
                accept={UPLOAD_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  void sendFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <HubButton onClick={() => picker.current?.click()} busy={busy === 'file'}>
                <ClipIcon size={15} />
                {t('sendFile')}
              </HubButton>
            </>
          )}
          <HubButton
            onClick={() => void send(weekText(), 'week')}
            busy={busy === 'week'}
            disabled={digest.days === 0}
            title={digest.days === 0 ? t('weekEmpty') : undefined}
          >
            <ProgressIcon size={15} />
            {t('sendWeek')}
          </HubButton>
        </div>
      </div>

      {/* the next meeting */}
      <div className="on-dark flex flex-wrap items-center gap-x-4 gap-y-3 bg-green grain-light px-5 py-4 text-paper sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper/10 text-citrus">
          <CalendarIcon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label text-sage">{t('nextAppointment')}</p>
          {next && nextDate ? (
            <p className="mt-0.5 text-[0.9375rem] leading-snug font-semibold">
              {new Intl.DateTimeFormat(il, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: PORTAL_TZ,
              }).format(nextDate)}
              <span className="font-normal text-sage">
                {' · '}
                {tk(next.kind)} · {format.relativeTime(nextDate)}
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-[0.9375rem] text-sage">{t('noAppointment')}</p>
          )}
        </div>
        {next && (
          <button
            type="button"
            onClick={addToCalendar}
            className="inline-flex h-9 shrink-0 items-center rounded-pill border border-paper/25 px-3.5 text-[0.8125rem] font-semibold transition-colors hover:border-citrus hover:text-citrus"
          >
            {t('addToCalendar')}
          </button>
        )}
      </div>
    </section>
  );
}

function HubButton({
  children,
  onClick,
  busy,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      aria-busy={busy || undefined}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-pill border-[1.5px] border-ink/20 px-4 text-[0.8125rem] font-semibold transition-[border-color,background-color,scale] hover:border-ink hover:bg-ink/[0.03] active:scale-[0.97] disabled:opacity-40 disabled:hover:border-ink/20',
        busy && 'animate-pulse',
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The last seven days at a glance: was the day recorded, how much water, how much movement.
 * Each day opens its diary.
 * ---------------------------------------------------------------------------------------------- */

export function WeekStrip({
  days,
  today,
  activity,
}: {
  /** oldest first, seven of them; a day without a check-in has `checkin: null` */
  days: { day: string; checkin: Checkin | null }[];
  today: string;
  activity: boolean;
}) {
  const t = useTranslations('portal.hub');
  const locale = useLocale() as Locale;
  const il = intlLocale(locale);
  const reduced = usePrefersReducedMotion();
  const box = useRef<HTMLOListElement>(null);
  const inView = useInView(box, { once: true, margin: '-8% 0px' });
  const show = reduced || inView;
  const wd = new Intl.DateTimeFormat(il, { weekday: 'short', timeZone: 'UTC' });
  const dm = new Intl.DateTimeFormat(il, { day: 'numeric', timeZone: 'UTC' });
  const full = new Intl.DateTimeFormat(il, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const nf = new Intl.NumberFormat(il, { maximumFractionDigits: 1 });
  return (
    <>
      <ol ref={box} className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
        {days.map(({ day, checkin }, i) => {
          const d = new Date(`${day}T12:00:00Z`);
          const water = Math.min(1, (checkin?.water_ml ?? 0) / WATER_GOAL_ML);
          const moved = checkin?.activity_min ?? 0;
          const isToday = day === today;
          const summary = [
            full.format(d),
            checkin ? t('strip.recorded') : t('strip.empty'),
            checkin?.water_ml
              ? t('strip.water', { litres: nf.format(checkin.water_ml / 1000) })
              : null,
            moved ? t('strip.activity', { min: moved }) : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={day} className="min-w-0">
              <Link
                href={`/panel/diary?day=${day}`}
                aria-label={summary}
                title={summary}
                className={cn(
                  'group flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] px-1 pt-2.5 pb-2 transition-[border-color,background-color,translate] duration-200 hover:-translate-y-0.5',
                  isToday
                    ? 'border-ink bg-paper'
                    : 'border-transparent bg-paper/60 hover:border-ink/30',
                )}
              >
                <span
                  className={cn(
                    'max-w-full truncate label text-[0.5625rem]',
                    isToday ? 'text-ink' : 'text-ink-60',
                  )}
                >
                  {isToday ? t('strip.today') : wd.format(d)}
                </span>
                {/* water: a glass that fills */}
                <span
                  className="relative h-14 w-5 overflow-hidden rounded-[6px] bg-ink/8 sm:w-6"
                  aria-hidden
                >
                  <motion.span
                    className="absolute inset-x-0 bottom-0 origin-bottom bg-green-3"
                    style={{ height: `${water * 100}%` }}
                    initial={{ scaleY: reduced ? 1 : 0 }}
                    animate={{ scaleY: show ? 1 : 0 }}
                    transition={{
                      duration: reduced ? 0 : 0.6,
                      ease: ease.out,
                      delay: reduced ? 0 : i * 0.05,
                    }}
                  />
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'grid size-6 place-items-center rounded-full num text-[0.6875rem] font-semibold',
                    checkin
                      ? 'bg-ink text-paper'
                      : 'border-[1.5px] border-dashed border-ink/25 text-ink-60',
                  )}
                >
                  {dm.format(d)}
                </span>
                {activity && (
                  <span
                    aria-hidden
                    className={cn(
                      'h-4 num text-[0.625rem] leading-4 font-semibold',
                      moved ? 'text-paprika-deep' : 'text-ink/25',
                    )}
                  >
                    {moved ? t('strip.min', { min: moved }) : '—'}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      <ul className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.75rem] text-ink-60">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-2 rounded-[3px] bg-green-3" />
          {t('strip.legendWater')}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full bg-ink" />
          {t('strip.legendDay')}
        </li>
        {activity && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="num font-semibold text-paprika-deep">
              {t('strip.min', { min: 30 })}
            </span>
            {t('strip.legendMove')}
          </li>
        )}
      </ul>
    </>
  );
}
