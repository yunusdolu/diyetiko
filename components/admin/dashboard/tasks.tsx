'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  addTaskAction,
  deleteTaskAction,
  setTaskDoneAction,
  setTaskDueAction,
} from '@/app/admin/_actions/tasks';
import type { TaskRow } from '@/lib/admin/insights';
import { admin, ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { addDays, daysBetween, todayISO } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import { Button } from '@/components/admin/ui';
import type { ActionState } from '@/components/ui/status-icon';

type Preset = 'none' | 'today' | 'tomorrow' | 'nextWeek' | 'pick';

/**
 * The dietitian's to-do list. On the dashboard every task (with a client picker); on a client's
 * overview only that client's. Ticks, snoozes and deletions show at once and are confirmed by
 * the server; a finished task stays (struck through) for a day so a mis-tap can be undone.
 */
export function TaskPanel({
  tasks,
  clients,
  clientId,
  className,
}: {
  /** null: the tasks table does not exist yet (migration not applied) */
  tasks: TaskRow[] | null;
  clients?: { id: string; full_name: string }[];
  clientId?: string;
  className?: string;
}) {
  const t = useTranslations('admin.dashboard.tasks');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const now = useNow({ updateInterval: 60_000 });
  const today = todayISO(now);
  const uid = useId();
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState<Preset>('none');
  const [picked, setPicked] = useState('');
  const [client, setClient] = useState(clientId ?? '');
  // shown to the client in their portal, where they tick it themselves
  const [share, setShare] = useState(false);
  const [state, setState] = useState<ActionState>('idle');
  // optimistic overlay: id → patch (or null = deleted); temp rows for new tasks
  const [patch, setPatch] = useState<Record<string, Partial<TaskRow> | null>>({});
  const [temp, setTemp] = useState<TaskRow[]>([]);
  const [showDone, setShowDone] = useState(false);

  if (tasks === null)
    return (
      <section className={cn('a-card', className)}>
        <header className="border-b border-a-border px-5 py-3.5">
          <h2 className="text-[0.9375rem] font-bold">{t('title')}</h2>
        </header>
        <p className="m-5 rounded-[12px] bg-a-surface-2 px-4 py-3 text-[0.8125rem] text-a-muted">
          {t('migration')}
        </p>
      </section>
    );

  // a temporary row disappears as soon as the server copy (same title, still open) arrives
  const rows = [
    ...tasks,
    ...temp.filter((x) => !tasks.some((y) => y.title === x.title && !y.done_at)),
  ]
    .filter((r) => patch[r.id] !== null)
    .map((r) => ({ ...r, ...(patch[r.id] ?? {}) }) as TaskRow);
  const open = rows
    .filter((r) => !r.done_at)
    .sort(
      (a, b) =>
        (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') ||
        a.created_at.localeCompare(b.created_at),
    );
  const done = rows.filter((r) => r.done_at);

  const due = (): string | null =>
    preset === 'today'
      ? today
      : preset === 'tomorrow'
        ? addDays(today, 1)
        : preset === 'nextWeek'
          ? addDays(today, 7)
          : preset === 'pick' && picked
            ? picked
            : null;

  const run = async (
    id: string,
    change: Partial<TaskRow> | null,
    action: () => Promise<{ ok: boolean }>,
  ) => {
    setPatch((p) => ({ ...p, [id]: change }));
    const res = await action();
    if (!res.ok) {
      setPatch(({ [id]: _drop, ...rest }) => rest);
      toast.error(tc('error'));
      return;
    }
    router.refresh();
    // by then the refreshed server rows say the same; drop the overlay so they rule again
    setTimeout(() => setPatch(({ [id]: _done, ...rest }) => rest), 4000);
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const value = title.trim();
    if (!value) {
      input.current?.focus();
      return;
    }
    const row: TaskRow = {
      id: `tmp-${++seq.current}`,
      title: value,
      due_on: due(),
      done_at: null,
      client_id: client || null,
      client_name: clients?.find((c) => c.id === client)?.full_name ?? null,
      created_at: new Date().toISOString(),
      shared: share && Boolean(client),
    };
    setState('loading');
    setTemp((x) => [...x, row]);
    setTitle('');
    const res = await addTaskAction({
      title: value,
      due_on: row.due_on,
      client_id: row.client_id,
      shared: row.shared,
    });
    if (!res.ok) {
      setTemp((x) => x.filter((r) => r.id !== row.id));
      setTitle(value);
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    setTimeout(() => setState('idle'), 500);
    router.refresh();
    // the server copy replaces the temporary row on the next render
    setTimeout(() => setTemp((x) => x.filter((r) => r.id !== row.id)), 1500);
  };

  const dueChip = (r: TaskRow) => {
    if (!r.due_on) return null;
    const diff = daysBetween(today, r.due_on);
    const label =
      diff < 0
        ? t('overdue', { days: -diff })
        : diff === 0
          ? t('due.today')
          : diff === 1
            ? t('due.tomorrow')
            : format.dateTime(new Date(`${r.due_on}T12:00:00Z`), {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              });
    return (
      <span
        className={cn(
          'inline-flex h-5 items-center rounded-pill px-2 text-[0.6875rem] font-semibold whitespace-nowrap',
          r.done_at
            ? 'bg-a-surface-2 text-a-muted'
            : diff < 0
              ? 'bg-[color-mix(in_oklab,var(--a-danger)_14%,transparent)] text-a-danger'
              : diff === 0
                ? 'bg-a-accent text-a-accent-text'
                : 'bg-a-surface-2 text-a-text',
        )}
      >
        {label}
      </span>
    );
  };

  const row = (r: TaskRow) => {
    const isTemp = r.id.startsWith('tmp-');
    const isDone = Boolean(r.done_at);
    return (
      <motion.li
        key={r.id}
        layout={!reduced}
        initial={{ opacity: 0, y: reduced ? 0 : -6 }}
        animate={{ opacity: isTemp ? 0.6 : 1, y: 0 }}
        exit={{ opacity: 0, x: reduced ? 0 : 24, transition: { duration: 0.2 } }}
        transition={{ duration: 0.25, ease: ease.out }}
        className="group flex items-start gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-a-surface-2/60"
      >
        <button
          type="button"
          disabled={isTemp}
          onClick={() =>
            run(r.id, { done_at: isDone ? null : new Date().toISOString() }, () =>
              setTaskDoneAction(r.id, !isDone, r.client_id),
            )
          }
          aria-pressed={isDone}
          aria-label={
            isDone ? t('markOpen', { title: r.title }) : t('markDone', { title: r.title })
          }
          className={cn(
            'relative mt-0.5 tap-44 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
            isDone ? 'border-a-ok bg-a-ok text-a-surface' : 'border-a-text/35 hover:border-a-text',
          )}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: isDone ? 1 : 0 }}
              transition={{ duration: reduced ? 0 : 0.3, ease: ease.out }}
            />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="relative inline text-[0.875rem] leading-snug">
            <span className={cn(isDone && 'text-a-muted')}>{r.title}</span>
            {/* strike line drawn from the reading-start side */}
            <motion.span
              aria-hidden
              className="absolute inset-x-0 top-1/2 h-px origin-left bg-a-muted rtl:origin-right"
              initial={false}
              animate={{ scaleX: isDone ? 1 : 0 }}
              transition={{ duration: reduced ? 0 : 0.35, ease: ease.out }}
            />
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {dueChip(r)}
            {r.shared && (
              <span
                title={t('sharedHint')}
                className="inline-flex h-5 items-center gap-1 rounded-pill bg-[color-mix(in_oklab,var(--a-ok)_16%,transparent)] px-2 text-[0.6875rem] font-semibold text-a-ok"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden>
                  <path
                    d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle cx="12" cy="12" r="2.6" fill="currentColor" />
                </svg>
                {isDone ? t('sharedDone') : t('shared')}
              </span>
            )}
            {!clientId && r.client_id && r.client_name && (
              <Link
                href={`/admin/clients/${r.client_id}?tab=overview`}
                className="inline-flex h-5 items-center rounded-pill border border-a-border px-2 text-[0.6875rem] font-semibold hover:bg-a-surface-2"
              >
                {r.client_name}
              </Link>
            )}
          </div>
        </div>
        {!isDone && !isTemp && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity fine:opacity-0 fine:group-focus-within:opacity-100 fine:group-hover:opacity-100">
            <IconButton
              label={t('snooze')}
              onClick={() =>
                run(r.id, { due_on: addDays(today, 1) }, () =>
                  setTaskDueAction(r.id, addDays(today, 1), r.client_id),
                )
              }
            >
              <path d="M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
            </IconButton>
            <IconButton
              label={tc('delete')}
              danger
              onClick={() => run(r.id, null, () => deleteTaskAction(r.id, r.client_id))}
            >
              <path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </IconButton>
          </div>
        )}
      </motion.li>
    );
  };

  return (
    <section className={cn('a-card', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-a-border px-5 py-3.5">
        <h2 className="text-[0.9375rem] font-bold">{t('title')}</h2>
        <span className="num text-[0.75rem] text-a-muted">{t('open', { count: open.length })}</span>
      </header>
      <div className="p-3 sm:p-4">
        <form
          onSubmit={add}
          className="space-y-2.5 rounded-[14px] border border-a-border bg-a-bg/40 p-2.5"
        >
          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-t`} className="sr-only">
              {t('add')}
            </label>
            <input
              ref={input}
              id={`${uid}-t`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t('placeholder')}
              className="h-10 min-w-0 flex-1 rounded-[10px] bg-transparent px-2.5 text-[0.9375rem] outline-none placeholder:text-a-muted/70"
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              state={state}
              aria-label={t('add')}
              className="h-9"
            >
              {tc('add')}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <LayoutGroup id={`${uid}-due`}>
              {(['none', 'today', 'tomorrow', 'nextWeek'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={preset === p}
                  onClick={() => setPreset(p)}
                  className={cn(
                    'relative h-7 rounded-pill px-2.5 text-[0.75rem] font-semibold transition-colors',
                    preset === p ? 'text-a-accent-text' : 'text-a-muted hover:text-a-text',
                  )}
                >
                  {preset === p && (
                    <motion.span
                      layoutId={`${uid}-due-pill`}
                      className="absolute inset-0 rounded-pill bg-a-accent"
                      transition={admin.spring}
                    />
                  )}
                  <span className="relative">{t(`due.${p}`)}</span>
                </button>
              ))}
            </LayoutGroup>
            <label
              className={cn(
                'relative inline-flex h-7 items-center gap-1 rounded-pill border px-2 text-[0.75rem] font-semibold',
                preset === 'pick' && picked
                  ? 'border-a-text text-a-text'
                  : 'border-a-border text-a-muted',
              )}
            >
              <span className="sr-only">{t('due.pick')}</span>
              <input
                type="date"
                value={picked}
                min={today}
                onChange={(e) => {
                  setPicked(e.target.value);
                  setPreset(e.target.value ? 'pick' : 'none');
                }}
                className="h-6 bg-transparent num text-[0.75rem] outline-none"
              />
            </label>
            {clients && !clientId && (
              <>
                <label htmlFor={`${uid}-c`} className="sr-only">
                  {t('client')}
                </label>
                <select
                  id={`${uid}-c`}
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className="h-7 max-w-[11rem] rounded-pill border border-a-border bg-a-surface px-2 text-[0.75rem] font-semibold text-a-text"
                >
                  <option value="">{t('noClient')}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {Boolean(client) && (
              <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-pill border border-a-border px-2.5 text-[0.75rem] font-semibold select-none has-[:checked]:border-transparent has-[:checked]:bg-a-accent has-[:checked]:text-a-accent-text">
                <input
                  type="checkbox"
                  checked={share}
                  onChange={(e) => setShare(e.target.checked)}
                  className="sr-only"
                />
                <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
                  <path
                    d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle cx="12" cy="12" r="2.6" fill="currentColor" />
                </svg>
                {t('share')}
              </label>
            )}
          </div>
        </form>

        {open.length === 0 && done.length === 0 ? (
          <p className="px-2 pt-4 pb-1 text-[0.8125rem] text-a-muted">{t('empty')}</p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            <AnimatePresence initial={false}>{open.map(row)}</AnimatePresence>
          </ul>
        )}

        {done.length > 0 && (
          <div className="mt-2 border-t border-a-border pt-2">
            <button
              type="button"
              aria-expanded={showDone}
              onClick={() => setShowDone((v) => !v)}
              className="flex w-full items-center justify-between rounded-[10px] px-2 py-1.5 text-[0.75rem] font-semibold text-a-muted hover:text-a-text"
            >
              {t('recentlyDone')} ({done.length})
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                aria-hidden
                className={cn('transition-transform', showDone && 'rotate-180')}
              >
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <AnimatePresence initial={false}>
              {showDone && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: ease.out }}
                  className="overflow-hidden"
                >
                  <AnimatePresence initial={false}>{done.map(row)}</AnimatePresence>
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'tap-44 grid size-8 place-items-center rounded-[8px] text-a-muted transition-colors hover:bg-a-surface',
        danger ? 'hover:text-a-danger' : 'hover:text-a-text',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}
