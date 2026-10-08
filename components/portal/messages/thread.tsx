'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { markMessagesReadAction, sendMessageAction } from '@/app/panel/_actions';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { dur, ease } from '@/lib/motion';
import { PORTAL_TZ, addDays, todayISO } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import {
  ClipIcon,
  FileChip,
  fileSize,
  UPLOAD_ACCEPT,
  UPLOAD_MAX_BYTES,
} from '@/components/ui/file-chip';
import type { MealSlot, Message } from '@/types/portal';
import { CloseIcon, MessageIcon, SendIcon } from '../icons';

const MAX = 2000;

type MealRef = { id: string; slot: MealSlot; day: string };
type Shown = Message & { pending?: boolean };

/**
 * Client ↔ dietitian notes. Not a live chat: newest at the bottom, a sticky composer above the
 * tab bar, optimistic send, read receipts on your own messages. Ctrl/⌘ + Enter sends.
 */
export function Thread({
  messages,
  dietitianName,
  meal,
  markRead,
  uploads,
}: {
  messages: Message[];
  dietitianName: string | null;
  meal: MealRef | null;
  markRead: boolean;
  /** files can be sent (the project has the uploads migration) */
  uploads: boolean;
}) {
  const t = useTranslations('portal.messages');
  const tm = useTranslations('meals');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const il = intlLocale(locale);
  const [body, setBody] = useState('');
  const [attached, setAttached] = useState<MealRef | null>(meal);
  // a new ?meal= (from the diary) replaces the attachment — adjusted during render, not in an effect
  const [seenMeal, setSeenMeal] = useState(meal?.id ?? null);
  if ((meal?.id ?? null) !== seenMeal) {
    setSeenMeal(meal?.id ?? null);
    if (meal) setAttached(meal);
  }
  const [pending, start] = useTransition();
  const [shown, addShown] = useOptimistic<Shown[], Shown>(messages, (cur, m) => [...cur, m]);
  const area = useRef<HTMLTextAreaElement>(null);
  // a file waiting to be sent with the next message (a lab report, a photo of a result)
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > UPLOAD_MAX_BYTES) return void toast.error(t('fileTooLarge'));
    if (!UPLOAD_ACCEPT.split(',').includes(f.type)) return void toast.error(t('fileType'));
    setFile(f);
  };
  async function sendFile(f: File) {
    setUploading(true);
    const text = body.trim().slice(0, MAX);
    const form = new FormData();
    form.set('file', f);
    form.set('body', text);
    try {
      const res = await fetch('/api/portal/attachment', { method: 'POST', body: form });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          error === 'tooLarge'
            ? t('fileTooLarge')
            : error === 'type'
              ? t('fileType')
              : error === 'rateLimited'
                ? t('rateLimited')
                : t('error'),
        );
        return;
      }
      setBody('');
      setFile(null);
      router.refresh();
    } catch {
      toast.error(t('error'));
    } finally {
      setUploading(false);
    }
  }

  // Opening the thread marks the dietitian's notes as read (badge updates via revalidation).
  useEffect(() => {
    if (markRead) void markMessagesReadAction();
  }, [markRead]);

  // Land on the newest message (page bottom, so the sticky composer sits below it) and keep
  // following while sending. After paint: the router's own scroll handling runs in layout effects.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight }),
    );
    return () => cancelAnimationFrame(id);
  }, [shown.length]);

  // auto-grow up to ~8 lines
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [body]);

  const time = new Intl.DateTimeFormat(il, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PORTAL_TZ,
  });
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: PORTAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const longDay = new Intl.DateTimeFormat(il, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: PORTAL_TZ,
  });
  const shortDay = new Intl.DateTimeFormat(il, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const today = todayISO();
  const dayLabel = (iso: string, d: Date) =>
    iso === today ? t('today') : iso === addDays(today, -1) ? t('yesterday') : longDay.format(d);
  const mealLabel = (slot: MealSlot, day: string) =>
    t('aboutMeal', { meal: tm(slot), date: shortDay.format(new Date(`${day}T12:00:00Z`)) });
  const lastReadOwn = [...shown].reverse().find((m) => m.author === 'client' && m.read_at)?.id;

  function send() {
    if (uploading) return;
    if (file) return void sendFile(file);
    const text = body.trim();
    if (!text || pending) return;
    if (text.length > MAX) {
      toast.error(t('tooLong'));
      return;
    }
    const ref = attached;
    // clear the composer now (outside the transition, so it doesn't wait for the server)
    setBody('');
    setAttached(null);
    start(async () => {
      addShown({
        id: `tmp-${Date.now()}`,
        author: 'client',
        body: text,
        diary_meal_id: ref?.id ?? null,
        meal_slot: ref?.slot ?? null,
        meal_day: ref?.day ?? null,
        read_at: null,
        created_at: new Date().toISOString(),
        file_name: null,
        file_mime: null,
        file_size: null,
        pending: true,
      });
      const res = await sendMessageAction({ body: text, diaryMealId: ref?.id ?? null });
      if (!res.ok) {
        toast.error(res.error === 'rateLimited' ? t('rateLimited') : t('error'));
        setBody(text);
        setAttached(ref);
        return;
      }
      if (ref) router.replace('/panel/messages', { scroll: false });
    });
  }

  // day dividers + sender groups, derived from the previous message
  const rows = shown.map((m, i) => {
    const d = new Date(m.created_at);
    const iso = dayKey.format(d);
    const prev = shown[i - 1];
    const newDay = !prev || dayKey.format(new Date(prev.created_at)) !== iso;
    return { m, d, iso, newDay, newGroup: newDay || prev?.author !== m.author };
  });

  return (
    <div>
      {shown.length === 0 ? (
        <div className="grid place-items-center gap-4 rounded-[20px] border-[1.5px] border-dashed border-ink/20 px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-paper-2">
            <MessageIcon size={26} />
          </span>
          <p className="max-w-sm text-ink-70">{t('empty')}</p>
        </div>
      ) : (
        <ol className="space-y-1.5" aria-label={t('title')}>
          {rows.map(({ m, d, iso, newDay, newGroup }) => {
            const mine = m.author === 'client';
            return (
              <li key={m.id} className={cn(newGroup && 'pt-3')}>
                {newDay && (
                  <p className="mt-4 mb-4 flex items-center gap-3 label text-ink-60 first:mt-0">
                    <span className="h-px flex-1 bg-ink/10" aria-hidden />
                    {dayLabel(iso, d)}
                    <span className="h-px flex-1 bg-ink/10" aria-hidden />
                  </p>
                )}
                <motion.div
                  initial={m.pending ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur.sm, ease: ease.out }}
                  className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}
                >
                  {newGroup && !mine && (
                    <p className="mb-1 ps-1 text-[0.75rem] font-semibold text-ink-70">
                      {dietitianName ?? t('dietitian')}
                    </p>
                  )}
                  <div
                    className={cn(
                      'max-w-[88%] rounded-[18px] px-4 py-2.5 text-[0.9375rem] leading-relaxed sm:max-w-[75%]',
                      mine ? 'rounded-ee-[6px] bg-ink text-paper' : 'rounded-es-[6px] bg-paper-2',
                      m.pending && 'opacity-70',
                    )}
                  >
                    {m.meal_slot && m.meal_day && (
                      <Link
                        href={`/panel/diary?day=${m.meal_day}`}
                        className={cn(
                          'mb-1.5 inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[0.75rem] font-semibold',
                          mine
                            ? 'bg-paper/12 text-citrus hover:bg-paper/20'
                            : 'bg-ink/6 text-ink hover:bg-ink/10',
                        )}
                      >
                        {mealLabel(m.meal_slot, m.meal_day)}
                      </Link>
                    )}
                    {m.file_name && m.file_mime && (
                      <FileChip
                        href={`/api/portal/attachment/${m.id}`}
                        name={m.file_name}
                        mime={m.file_mime}
                        size={m.file_size}
                        locale={il}
                        onDark={mine}
                        openLabel={t('openFile')}
                        className={cn('my-1', m.body !== m.file_name && 'mb-2')}
                      />
                    )}
                    {m.body !== m.file_name && (
                      <p dir="auto" className="break-words whitespace-pre-wrap">
                        {m.body}
                      </p>
                    )}
                  </div>
                  <p className="mt-1 px-1 num text-[0.6875rem] text-ink-60">
                    {m.pending ? t('sending') : time.format(d)}
                    {mine && m.id === lastReadOwn && ` · ${t('seen')}`}
                  </p>
                </motion.div>
              </li>
            );
          })}
        </ol>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom)+0.75rem)] z-20 mt-6 rounded-[22px] border-[1.5px] border-ink/15 bg-paper/95 p-2 shadow-[0_18px_40px_-24px_rgb(15_27_23/0.45)] backdrop-blur-[6px] lg:bottom-6"
      >
        <AnimatePresence initial={false}>
          {attached && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: dur.sm, ease: ease.out }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-2 pt-1 pb-2">
                <span className="text-[0.75rem] text-ink-60">{t('attached')}:</span>
                <span className="inline-flex min-w-0 items-center gap-1 rounded-pill bg-citrus py-1 ps-3 pe-1 text-[0.75rem] font-semibold text-ink">
                  <span className="truncate">{mealLabel(attached.slot, attached.day)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttached(null);
                      router.replace('/panel/messages', { scroll: false });
                    }}
                    aria-label={t('detach')}
                    className="grid size-6 place-items-center rounded-full hover:bg-ink/10"
                  >
                    <CloseIcon size={13} />
                  </button>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {file && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: dur.sm, ease: ease.out }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-2 pt-1 pb-2">
                <span className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-pill bg-paper-2 py-1 ps-3 pe-1 text-[0.8125rem] font-semibold">
                  <ClipIcon size={14} />
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 num text-[0.6875rem] font-normal text-ink-60">
                    {fileSize(file.size, il)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    aria-label={t('removeFile')}
                    className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-ink/10"
                  >
                    <CloseIcon size={13} />
                  </button>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* one-tap openers: they fill the box, the client finishes the sentence */}
        {!body && !file && (
          <div className="-mx-0.5 scrollbar-none flex gap-1.5 overflow-x-auto px-2 pt-1.5 pb-2">
            {(t.raw('quick') as string[]).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setBody(q);
                  area.current?.focus();
                }}
                className="inline-flex h-8 shrink-0 items-center rounded-pill bg-paper-2 px-3 text-[0.8125rem] font-semibold transition-colors hover:bg-paper-3"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
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
                  pickFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => picker.current?.click()}
                aria-label={t('attachFile')}
                title={t('attachFile')}
                className="grid size-11 shrink-0 place-items-center rounded-full text-ink-70 transition-[background-color,transform] hover:bg-ink/6 hover:text-ink active:scale-95"
              >
                <ClipIcon size={20} />
              </button>
            </>
          )}
          <label htmlFor="portal-message" className="sr-only">
            {t('placeholder')}
          </label>
          <textarea
            id="portal-message"
            dir="auto"
            ref={area}
            rows={1}
            value={body}
            maxLength={MAX + 200}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t('placeholder')}
            aria-describedby="portal-message-hint"
            className="max-h-[220px] min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[1rem] leading-snug outline-none placeholder:text-ink-60"
          />
          <button
            type="submit"
            disabled={(!body.trim() && !file) || pending || uploading}
            aria-label={t('send')}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-paper transition-[opacity,transform] hover:scale-[1.04] active:scale-95 disabled:opacity-35 disabled:hover:scale-100"
          >
            <SendIcon size={19} />
          </button>
        </div>
        <p
          id="portal-message-hint"
          className="flex justify-between gap-3 px-3 pt-1 pb-1 text-[0.6875rem] text-ink-60"
        >
          <span>{t('emergency')}</span>
          {body.length > MAX - 200 ? (
            <span
              className={cn('shrink-0 num', body.length > MAX && 'font-semibold text-paprika-deep')}
            >
              {body.length}/{MAX}
            </span>
          ) : (
            <span className="hidden shrink-0 sm:inline">{t('sendHint')}</span>
          )}
        </p>
      </form>
    </div>
  );
}
