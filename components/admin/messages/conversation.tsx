'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { markClientReadAction, replyAction } from '@/app/admin/_actions/portal';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { PORTAL_TZ, todayISO } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/portal';
import { Button, EmptyState } from '@/components/admin/ui';
import {
  ClipIcon,
  FileChip,
  fileSize,
  UPLOAD_ACCEPT,
  UPLOAD_MAX_BYTES,
} from '@/components/ui/file-chip';
import type { ActionState } from '@/components/ui/status-icon';

/**
 * One client's thread, for the dietitian: messages grouped by day, files shown in place (a lab
 * report as a PDF card, a photo as itself), and a composer that sends text or a file with a note.
 * Opening it marks the client's messages as read. Used on the messages page and in the client's
 * file.
 */
export function Conversation({
  clientId,
  messages,
  onPortal,
  uploads,
  className,
  fill,
}: {
  clientId: string;
  messages: Message[];
  onPortal: boolean;
  /** files can be sent and shown (the project has the uploads migration) */
  uploads: boolean;
  className?: string;
  /** take the height offered by the parent (the messages page) instead of a fixed share */
  fill?: boolean;
}) {
  const t = useTranslations('admin.portal.messages');
  const tm = useTranslations('meals');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const il = intlLocale(locale);
  const router = useRouter();
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ActionState>('idle');
  const list = useRef<HTMLOListElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const hasUnread = messages.some((m) => m.author === 'client' && !m.read_at);

  useEffect(() => {
    if (hasUnread) void markClientReadAction(clientId);
  }, [hasUnread, clientId]);
  // land on the newest message (only the list scrolls, never the page)
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, clientId]);
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [body]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > UPLOAD_MAX_BYTES) return void toast.error(t('fileTooLarge'));
    if (!UPLOAD_ACCEPT.split(',').includes(f.type)) return void toast.error(t('fileType'));
    setFile(f);
  };

  const fail = (error?: string) => {
    setState('error');
    toast.error(
      error === 'rateLimited'
        ? t('rateLimited')
        : error === 'tooLarge'
          ? t('fileTooLarge')
          : error === 'type'
            ? t('fileType')
            : tc('error'),
    );
    setTimeout(() => setState('idle'), 900);
  };

  const send = async () => {
    const text = body.trim();
    if ((!text && !file) || state === 'loading') return;
    setState('loading');
    if (file) {
      const form = new FormData();
      form.set('clientId', clientId);
      form.set('file', file);
      form.set('body', text);
      const res = await fetch('/api/admin/message-file', { method: 'POST', body: form }).catch(
        () => null,
      );
      if (!res?.ok) {
        const { error } = ((await res?.json().catch(() => ({}))) ?? {}) as { error?: string };
        return fail(error);
      }
    } else {
      const res = await replyAction(clientId, text);
      if (!res.ok) return fail(res.error);
    }
    setBody('');
    setFile(null);
    setState('idle');
    router.refresh();
  };

  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: PORTAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = todayISO();
  const rows = messages.map((m, i) => {
    const d = new Date(m.created_at);
    const iso = dayKey.format(d);
    const prev = messages[i - 1];
    const newDay = !prev || dayKey.format(new Date(prev.created_at)) !== iso;
    return { m, d, iso, newDay, newGroup: newDay || prev?.author !== m.author };
  });

  return (
    <div className={cn('flex min-h-0 flex-col', fill && 'h-full', className)}>
      {!onPortal && (
        <p className="mb-3 shrink-0 rounded-[12px] bg-a-surface-2 px-4 py-2.5 text-[0.8125rem] text-a-muted">
          {t('notOnPortal')}
        </p>
      )}
      {!messages.length ? (
        <div className={cn(fill && 'grid min-h-0 flex-1 place-items-center')}>
          <EmptyState>{t('empty')}</EmptyState>
        </div>
      ) : (
        <ol
          ref={list}
          aria-label={t('title')}
          className={cn(
            'a-scroll space-y-1 overflow-y-auto rounded-[16px] border border-a-border bg-a-surface px-4 py-4',
            fill ? 'min-h-0 flex-1' : 'max-h-[60dvh]',
          )}
        >
          {rows.map(({ m, d, iso, newDay, newGroup }) => {
            const mine = m.author === 'dietitian';
            return (
              <li key={m.id} className={cn(newGroup && !newDay && 'pt-2.5')}>
                {newDay && (
                  <p className="my-3 flex items-center gap-3 text-[0.6875rem] font-semibold tracking-wider text-a-muted uppercase first:mt-0">
                    <span className="h-px flex-1 bg-a-border" aria-hidden />
                    {iso === today
                      ? tc('today')
                      : format.dateTime(d, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          timeZone: PORTAL_TZ,
                        })}
                    <span className="h-px flex-1 bg-a-border" aria-hidden />
                  </p>
                )}
                <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-[16px] px-3.5 py-2 text-[0.9375rem] leading-relaxed',
                      mine
                        ? 'rounded-ee-[6px] bg-a-accent text-a-accent-text'
                        : 'rounded-es-[6px] bg-a-surface-2',
                    )}
                  >
                    {m.meal_slot && m.meal_day && (
                      <Link
                        href={`/admin/clients/${clientId}?tab=diary&dto=${m.meal_day}`}
                        className="mb-1 block text-[0.75rem] font-semibold underline-offset-2 hover:underline"
                      >
                        {t('about', {
                          meal: tm(m.meal_slot),
                          date: format.dateTime(new Date(`${m.meal_day}T12:00:00Z`), {
                            day: 'numeric',
                            month: 'short',
                            timeZone: 'UTC',
                          }),
                        })}
                      </Link>
                    )}
                    {m.file_name && m.file_mime && (
                      <FileChip
                        href={`/api/admin/message-file/${m.id}`}
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
                  <p className="mt-1 px-1 num text-[0.6875rem] text-a-muted">
                    {mine ? `${t('you')} · ` : ''}
                    {format.dateTime(d, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: PORTAL_TZ,
                    })}
                    {mine && m.read_at ? ` · ${t('seen')}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <form
        className="mt-3 shrink-0 rounded-[16px] border border-a-border bg-a-surface p-2 focus-within:border-a-text/40"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {file && (
          <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-2">
            <span className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-pill bg-a-surface-2 py-1 ps-3 pe-1 text-[0.8125rem] font-semibold">
              <ClipIcon size={14} />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 num text-[0.6875rem] font-normal text-a-muted">
                {fileSize(file.size, il)}
              </span>
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label={t('removeFile')}
                className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-a-surface"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </span>
          </div>
        )}
        <div className="flex items-end gap-1.5">
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
                className="grid size-10 shrink-0 place-items-center rounded-full text-a-muted transition-colors hover:bg-a-surface-2 hover:text-a-text"
              >
                <ClipIcon size={18} />
              </button>
            </>
          )}
          <label htmlFor={`reply-${clientId}`} className="sr-only">
            {t('placeholder')}
          </label>
          <textarea
            id={`reply-${clientId}`}
            ref={area}
            dir="auto"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={t('placeholder')}
            title={t('sendHint')}
            className="max-h-[180px] min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[0.9375rem] leading-snug text-a-text outline-none placeholder:text-a-muted"
          />
          <Button type="submit" variant="primary" state={state} disabled={!body.trim() && !file}>
            {t('send')}
          </Button>
        </div>
      </form>
    </div>
  );
}
