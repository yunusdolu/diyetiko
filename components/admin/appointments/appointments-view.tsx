'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useLocale, useNow, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types/admin';
import { Badge, Button, EmptyState, PageTitle } from '@/components/admin/ui';
import { Tabs } from '@/components/ui/tabs';
import { AppointmentSheet } from './appointment-sheet';

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday first (tr/fr); fine for en/ar as a planning grid
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function AppointmentsView({
  appointments,
  clients,
  openNew,
}: {
  appointments: Appointment[];
  clients: { id: string; full_name: string }[];
  openNew: boolean;
}) {
  const t = useTranslations('admin.appointments');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const now = useNow();
  const locale = useLocale() as Locale;
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [dirn, setDirn] = useState(0);
  const [open, setOpen] = useState<Appointment | 'new' | null>(openNew ? 'new' : null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * 864e5)),
    [week],
  );
  const inWeek = (a: Appointment) => {
    const d = new Date(a.starts_at);
    return d >= days[0]! && d < new Date(days[6]!.getTime() + 864e5);
  };
  const upcoming = appointments.filter(
    (a) => new Date(a.starts_at) >= new Date(now.getTime() - 864e5),
  );
  const dayFmt = new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short', day: 'numeric' });
  const shift = (n: number) => {
    setDirn(n);
    setWeek((w) => new Date(w.getTime() + n * 7 * 864e5));
  };

  return (
    <div>
      <PageTitle
        title={t('title')}
        actions={
          <>
            <Tabs
              label={tc('view')}
              value={view}
              onChange={setView}
              items={[
                { value: 'calendar', label: t('calendar') },
                { value: 'list', label: t('list') },
              ]}
            />
            <Button variant="primary" onClick={() => setOpen('new')}>
              {t('new')}
            </Button>
          </>
        }
      />

      {view === 'calendar' ? (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Button size="sm" onClick={() => shift(-1)} aria-label={t('prevWeek')}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden className="mirror-rtl">
                <path
                  d="M15 6l-6 6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </Button>
            <p className="num text-[0.875rem] font-semibold">
              {format.dateTime(days[0]!, { day: 'numeric', month: 'short' })} –{' '}
              {format.dateTime(days[6]!, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <Button size="sm" onClick={() => shift(1)} aria-label={t('nextWeek')}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden className="mirror-rtl">
                <path
                  d="M9 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWeek(startOfWeek(new Date()))}>
              {tc('today')}
            </Button>
          </div>
          <div className="-my-4 overflow-hidden py-4">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={week.toISOString()}
                className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-7"
                initial={{ opacity: 0, x: 24 * dirn }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 * dirn }}
                transition={{ duration: admin.dur, ease: admin.ease }}
              >
                {days.map((d) => {
                  const list = appointments.filter(
                    (a) => inWeek(a) && new Date(a.starts_at).toDateString() === d.toDateString(),
                  );
                  const today = d.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={d.toISOString()}
                      className={cn(
                        'min-h-40 rounded-[14px] border bg-a-surface p-2.5',
                        today ? 'border-a-text/50' : 'border-a-border',
                      )}
                    >
                      <p
                        className={cn(
                          'mb-2 text-[0.75rem] font-bold',
                          today ? 'text-a-text' : 'text-a-muted',
                        )}
                      >
                        {dayFmt.format(d)}
                      </p>
                      <ul className="space-y-1.5">
                        {list.map((a) => (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => setOpen(a)}
                              className={cn(
                                'w-full rounded-[10px] px-2 py-1.5 text-start text-[0.75rem] transition-colors',
                                a.status === 'cancelled'
                                  ? 'bg-a-surface-2 text-a-muted line-through'
                                  : 'bg-a-accent text-a-accent-text hover:opacity-90',
                              )}
                            >
                              <span className="block num font-semibold">
                                {format.dateTime(new Date(a.starts_at), {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className="block truncate">
                                {a.client_name ?? a.title ?? '—'}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      ) : upcoming.length ? (
        <ul className="a-card divide-y divide-a-border">
          {upcoming.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setOpen(a)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-start hover:bg-a-surface-2"
              >
                <span className="flex items-center gap-4">
                  <span className="w-44 num font-semibold">
                    {format.dateTime(new Date(a.starts_at), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span>{a.client_name ?? a.title ?? '—'}</span>
                </span>
                <span className="flex gap-2">
                  <Badge>{t(`kinds.${a.kind}`)}</Badge>
                  <Badge
                    tone={
                      a.status === 'done' ? 'ok' : a.status === 'scheduled' ? 'accent' : 'neutral'
                    }
                  >
                    {t(`statuses.${a.status}`)}
                  </Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>{t('empty')}</EmptyState>
      )}

      <AppointmentSheet
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        appointment={open === 'new' ? null : open}
        clients={clients}
      />
    </div>
  );
}
