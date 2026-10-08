'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { localeNames, type Locale } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { useDir } from '@/lib/motion/hooks';
import { Badge, EmptyState, PageTitle, Panel } from '@/components/admin/ui';
import { ProgressRing } from './progress-ring';

export interface ExplorerClient {
  id: string;
  full_name: string;
  goal: string | null;
  goal_weight_kg: number | null;
  status: string;
  preferred_language: Locale;
  allergies: string | null;
  weights: { d: string; w: number }[];
  latest: { d: string; w: number | null; f: number | null; waist: number | null } | null;
  program: { id: string; title: string } | null;
  next_appointment: string | null;
  pinned_note: string | null;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 320;
  const h = 80;
  const pts = values.map(
    (v, i) =>
      [(i / (values.length - 1)) * w, h - 8 - ((v - min) / (max - min || 1)) * (h - 16)] as const,
  );
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full rtl:-scale-x-100" aria-hidden>
      <motion.path
        d={d}
        fill="none"
        stroke="var(--a-chart)"
        strokeWidth="2"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: admin.ease }}
      />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="4" fill="var(--a-chart)" />
    </svg>
  );
}

export function ClientExplorer({
  clients,
  startIndex,
}: {
  clients: ExplorerClient[];
  startIndex: number;
}) {
  const t = useTranslations('admin.explorer');
  const tm = useTranslations('admin.measurements');
  const tc = useTranslations('admin.common');
  const tcl = useTranslations('admin.clients');
  const format = useFormatter();
  const dir = useDir();
  const [[index, direction], setState] = useState<[number, number]>([startIndex, 0]);

  const go = useCallback(
    (delta: number) => {
      if (!clients.length) return;
      setState(([i]) => [(i + delta + clients.length) % clients.length, delta]);
    },
    [clients.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      // Visual direction: → shows the next card in LTR, the previous one in RTL.
      if (e.key === 'ArrowRight') go(dir === 1 ? 1 : -1);
      if (e.key === 'ArrowLeft') go(dir === 1 ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, dir]);

  useEffect(() => {
    const c = clients[index];
    if (!c) return;
    const url = new URL(window.location.href);
    url.searchParams.set('id', c.id);
    window.history.replaceState(null, '', url);
  }, [index, clients]);

  if (!clients.length) return <EmptyState>{t('empty')}</EmptyState>;
  const c = clients[index]!;
  const weights = c.weights.map((w) => w.w);
  const start = weights[0];
  const now = weights.at(-1);
  const progress =
    start != null && now != null && c.goal_weight_kg != null && start !== c.goal_weight_kg
      ? (start - now) / (start - c.goal_weight_kg)
      : null;

  return (
    <div>
      <PageTitle
        title={t('title')}
        eyebrow={t('hint')}
        actions={
          <div className="flex items-center gap-2" role="group" aria-label={t('title')}>
            <button
              type="button"
              onClick={() => go(-1)}
              className="grid size-10 place-items-center rounded-[10px] border border-a-border bg-a-surface hover:bg-a-surface-2"
              aria-label={tc('prev')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="mirror-rtl">
                <path
                  d="M15 6l-6 6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span className="min-w-16 text-center num text-[0.875rem]" aria-live="polite">
              {t('position', { current: index + 1, total: clients.length })}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              className="grid size-10 place-items-center rounded-[10px] border border-a-border bg-a-surface hover:bg-a-surface-2"
              aria-label={tc('next')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="mirror-rtl">
                <path
                  d="M9 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        }
      />

      {/* Rail of initials: the whole caseload at a glance, click to jump. */}
      <ol className="-mx-1.5 mb-[1.125rem] scrollbar-none flex gap-1.5 overflow-x-auto p-1.5">
        {clients.map((x, i) => (
          <li key={x.id}>
            <button
              type="button"
              onClick={() => setState(([cur]) => [i, i > cur ? 1 : -1])}
              aria-current={i === index ? 'true' : undefined}
              title={x.full_name}
              className="relative grid size-9 place-items-center rounded-pill border border-a-border text-[0.8125rem] font-semibold"
            >
              {i === index && (
                <motion.span
                  layoutId="explorer-dot"
                  className="absolute inset-0 rounded-pill bg-a-accent"
                  transition={admin.spring}
                />
              )}
              <span className={i === index ? 'relative text-a-accent-text' : 'relative'}>
                {x.full_name.slice(0, 1)}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="relative -my-5 overflow-hidden py-5">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.article
            key={c.id}
            custom={direction}
            initial={{ opacity: 0, x: 48 * direction * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -48 * direction * dir }}
            transition={{ duration: 0.24, ease: admin.ease }}
            className="grid grid-cols-1 gap-5 xl:grid-cols-3"
            aria-live="polite"
          >
            <Panel className="xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-[clamp(2rem,4vw,3.25rem)] leading-none ar:leading-[1.3] ar:font-bold">
                    {c.full_name}
                  </h2>
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.8125rem] text-a-muted">
                    <Badge tone={c.status === 'active' ? 'ok' : 'warn'}>
                      {tcl(`status.${c.status as 'active'}`)}
                    </Badge>
                    {localeNames[c.preferred_language]}
                    {c.allergies && <Badge tone="danger">{c.allergies}</Badge>}
                  </p>
                </div>
                <Link
                  href={`/admin/clients/${c.id}`}
                  className="inline-flex h-10 items-center rounded-[10px] bg-a-accent px-4 text-[0.875rem] font-semibold text-a-accent-text"
                >
                  {t('openProfile')}
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-[0.75rem] font-semibold text-a-muted">{t('goal')}</p>
                  <p className="mt-1 text-[1.0625rem] leading-relaxed">{c.goal ?? '—'}</p>
                  <div className="mt-5">
                    <Sparkline values={weights} />
                  </div>
                </div>
                {progress != null && (
                  <ProgressRing value={progress} size={150} label={t('progress')}>
                    <span>
                      <span className="block num-wide text-[1.6rem] leading-none">
                        {format.number(Math.max(0, Math.min(1, progress)), { style: 'percent' })}
                      </span>
                      <span className="text-[0.6875rem] text-a-muted">{t('progress')}</span>
                    </span>
                  </ProgressRing>
                )}
              </div>
            </Panel>

            <div className="grid content-start gap-5">
              <Panel title={t('latest')}>
                {c.latest ? (
                  <dl className="grid grid-cols-3 gap-3 text-center">
                    {[
                      [tm('weight'), c.latest.w],
                      [tm('bodyFat'), c.latest.f],
                      [tm('waist'), c.latest.waist],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="rounded-[12px] bg-a-surface-2 px-2 py-3">
                        <dt className="text-[0.6875rem] text-a-muted">{k}</dt>
                        <dd className="mt-1 num-wide text-[1.25rem]">{v ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[0.875rem] text-a-muted">—</p>
                )}
              </Panel>
              <Panel title={t('activeProgram')}>
                {c.program ? (
                  <Link
                    href={`/admin/programs/${c.program.id}`}
                    className="font-semibold hover:underline"
                  >
                    {c.program.title}
                  </Link>
                ) : (
                  <p className="text-[0.875rem] text-a-muted">{t('noProgram')}</p>
                )}
                <p className="mt-4 text-[0.75rem] font-semibold text-a-muted">
                  {t('nextAppointment')}
                </p>
                <p className="mt-1 num">
                  {c.next_appointment
                    ? format.dateTime(new Date(c.next_appointment), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—'}
                </p>
              </Panel>
              {c.pinned_note && (
                <Panel title={t('pinnedNote')}>
                  <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                    {c.pinned_note}
                  </p>
                </Panel>
              )}
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
    </div>
  );
}
