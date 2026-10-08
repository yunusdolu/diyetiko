import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { dashboard } from '@/lib/admin/clients';
import { agenda, listTasks, practiceSignals, pulse } from '@/lib/admin/insights';
import { inbox, recentActivity, unreadTotal } from '@/lib/admin/portal';
import { reminderTemplates } from '@/lib/admin/reminders';
import { requireUser } from '@/lib/auth';
import { asUser } from '@/lib/db';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/config';
import { todayISO } from '@/lib/portal/logic';
import { AgendaPanel } from '@/components/admin/dashboard/agenda';
import { AttentionPanel } from '@/components/admin/dashboard/attention';
import { BirthdaysPanel } from '@/components/admin/dashboard/birthdays';
import {
  ClientMixCard,
  OutcomesCard,
  TrendCard,
  type OutcomeWindow,
} from '@/components/admin/dashboard/chart-cards';
import { GoalBoard } from '@/components/admin/dashboard/goals';
import { DashboardHero } from '@/components/admin/dashboard/hero';
import { InboxPanel } from '@/components/admin/dashboard/inbox';
import { KpiCard } from '@/components/admin/dashboard/kpi';
import { OverviewCard, type OverviewTile } from '@/components/admin/dashboard/overview';
import { LeadsPanel } from '@/components/admin/dashboard/leads';
import { TaskPanel } from '@/components/admin/dashboard/tasks';
import { MoneyPanel } from '@/components/admin/dashboard/money';
import { practiceMoney } from '@/lib/admin/practice';
import { Avatar, Rise } from '@/components/admin/fx';
import { Badge, EmptyState, Panel } from '@/components/admin/ui';

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations('admin');
  const locale = (await getLocale()) as Locale;
  const format = await getFormatter();
  const today = todayISO();
  // the task list feeds both the task card and the "needs attention" signals: loaded once
  const tasksLoad = listTasks(user.id);
  const [d, activity, unread, day, tasks, beat, templates, clients, signals, threads, cash] =
    await Promise.all([
      dashboard(user.id),
      recentActivity(user.id, 8),
      unreadTotal(user.id),
      agenda(user.id, today),
      tasksLoad,
      pulse(user.id, today),
      reminderTemplates(),
      asUser(user.id, (tx) =>
        tx.query<{ id: string; full_name: string }>(
          `select id, full_name from clients where deleted_at is null and status in ('active', 'paused') order by full_name`,
        ),
      ),
      practiceSignals(user.id, today, tasksLoad),
      inbox(user.id),
      practiceMoney(user.id, today),
    ]);
  const unreadThreads = threads.filter((r) => r.unread > 0).slice(0, 5);

  const activityTab = { checkin: 'tracking', diary: 'diary', message: 'messages' } as const;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Europe/Istanbul',
    }).format(new Date()),
  );
  const greet =
    hour < 12
      ? t('dashboard.title')
      : hour < 18
        ? t('dashboard.titleAfternoon')
        : t('dashboard.titleEvening');

  // headline numbers + how they moved
  const last = <T,>(xs: T[], i = 1) => xs[xs.length - i];
  const sum = (xs: { count: number }[]) => xs.reduce((a, b) => a + b.count, 0);
  const todayCount = day.items.filter(
    (a) => todayISO(new Date(a.starts_at)) === today && a.status !== 'cancelled',
  ).length;
  const weekNow = last(beat.appointmentsByWeek)?.count ?? 0;
  const weekPrev = last(beat.appointmentsByWeek, 2)?.count ?? 0;
  const clientsNow = last(d.clientsByMonth)?.count ?? 0;
  const clientsPrev = last(d.clientsByMonth, 2)?.count ?? 0;
  const leadsNow = last(d.leadsByWeek)?.count ?? 0;
  const leadsPrev = last(d.leadsByWeek, 2)?.count ?? 0;
  const checkins7 = sum(beat.checkins.slice(7));
  const checkinsPrev7 = sum(beat.checkins.slice(0, 7));
  const kpis = [
    {
      label: t('dashboard.kpi.activeClients'),
      value: d.activeClients,
      delta: clientsNow - clientsPrev,
      deltaLabel: t('dashboard.kpi.vsLastMonth'),
      series: d.clientsByMonth.slice(-6).map((m) => m.count),
      href: '/admin/clients',
      icon: 'clients' as const,
      viz: 'line' as const,
    },
    {
      label: t('dashboard.kpi.weekAppointments'),
      value: weekNow,
      delta: weekNow - weekPrev,
      deltaLabel: t('dashboard.kpi.vsLastWeek'),
      series: beat.appointmentsByWeek.map((w) => w.count),
      href: '/admin/appointments',
      icon: 'appointments' as const,
      viz: 'bars' as const,
    },
    {
      label: t('dashboard.kpi.newLeads'),
      value: d.newLeads,
      delta: leadsNow - leadsPrev,
      deltaLabel: t('dashboard.kpi.vsLastWeek'),
      series: d.leadsByWeek.slice(-8).map((w) => w.count),
      href: '/admin/leads',
      icon: 'leads' as const,
      viz: 'line' as const,
    },
    {
      label: t('dashboard.kpi.checkins'),
      value: checkins7,
      delta: checkins7 - checkinsPrev7,
      deltaLabel: t('dashboard.kpi.vsPrevious'),
      series: beat.checkins.map((c) => c.count),
      href: '/admin/messages',
      icon: 'messages' as const,
      viz: 'bars' as const,
    },
  ];

  // the opening card: clients month by month, appointments week by week
  const overview: OverviewTile[] = [
    {
      key: 'clients',
      label: t('dashboard.kpi.activeClients'),
      icon: 'clients',
      href: '/admin/clients',
      value: d.activeClients,
      delta: clientsNow - clientsPrev,
      deltaLabel: t('dashboard.kpi.vsLastMonth'),
      series: d.clientsByMonth.map((m) => ({ at: `${m.month}-01`, count: m.count })),
      unit: 'month',
      ranges: [3, 6, 12],
      initial: 6,
      kind: 'area',
    },
    {
      key: 'appointments',
      label: t('dashboard.kpi.weekAppointments'),
      icon: 'appointments',
      href: '/admin/appointments',
      value: weekNow,
      delta: weekNow - weekPrev,
      deltaLabel: t('dashboard.kpi.vsLastWeek'),
      series: beat.appointmentsByWeek.map((w) => ({ at: w.week, count: w.count })),
      unit: 'week',
      ranges: [4, 8, 12],
      initial: 8,
      kind: 'bar',
    },
  ];

  const quick = [
    { href: '/admin/clients?new=1', label: t('dashboard.quickClient'), icon: 'clients' as const },
    {
      href: '/admin/appointments?new=1',
      label: t('dashboard.quickAppointment'),
      icon: 'appointments' as const,
    },
    {
      href: '/admin/programs?new=1',
      label: t('dashboard.quickProgram'),
      icon: 'programs' as const,
    },
  ];

  const mixColor = {
    active: 'var(--a-chart)',
    paused: '#e9b949',
    completed: 'color-mix(in srgb, var(--a-muted) 55%, transparent)',
  } as const;
  const mix = (['active', 'paused', 'completed'] as const).map((s) => ({
    label: t(`clients.status.${s}`),
    value: d.clientMix.find((x) => x.status === s)?.count ?? 0,
    color: mixColor[s],
  }));
  const outcome = (status: string) => d.outcomes.find((o) => o.status === status);
  const windows: OutcomeWindow[] = ([30, 90, 365] as const).map((days) => {
    const key = days === 30 ? 'd30' : days === 90 ? 'd90' : 'd365';
    return {
      days,
      done: outcome('done')?.[key] ?? 0,
      noShow: outcome('no_show')?.[key] ?? 0,
      cancelled: outcome('cancelled')?.[key] ?? 0,
    };
  });

  return (
    <div className="space-y-4">
      <Rise>
        <DashboardHero
          eyebrow={format.dateTime(new Date(), { dateStyle: 'full' })}
          greeting={greet}
          counts={{ appointments: todayCount, unread, attention: signals.attention.length }}
          items={day.items}
          actions={quick}
        />
      </Rise>

      {/* The opening row: the two numbers the practice runs on, with the chart of whichever is
          being read, and the four headline numbers beside them (2×2 from laptops). */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
        <Rise i={1} className="min-w-0 xl:col-span-7 2xl:col-span-8">
          <OverviewCard title={t('dashboard.overview')} tiles={overview} />
        </Rise>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:col-span-5 2xl:col-span-4">
          {kpis.map((k, i) => (
            <Rise key={k.href} i={i + 2}>
              <KpiCard {...k} sameLabel={t('dashboard.kpi.same')} />
            </Rise>
          ))}
        </div>
      </div>

      {/* medium (a third) and large (two thirds) cards on one grid, every row one height; a card
          with more than fits scrolls inside itself under its own title (.dash-card) */}
      <div className="grid grid-cols-1 gap-4 md:grid-flow-dense md:grid-cols-2 xl:grid-cols-12">
        <Slot size="lg" tall i={3} id="agenda">
          <AgendaPanel agenda={day} templates={templates} locale={locale} />
        </Slot>
        <Slot tall i={4}>
          <TaskPanel tasks={tasks} clients={clients} />
        </Slot>

        <Slot size="lg" i={4}>
          <TrendCard
            title={t('dashboard.clientsTrend')}
            series={d.clientsByMonth.map((m) => ({ at: `${m.month}-01`, count: m.count }))}
            unit="month"
            ranges={[3, 6, 12]}
            initial={6}
            kind="area"
            xLabel={t('common.createdAt')}
            yLabel={t('dashboard.clientsTrend')}
          />
        </Slot>
        <Slot i={5}>
          <ClientMixCard
            title={t('dashboard.mix.title')}
            segments={mix}
            totalLabel={t('dashboard.mix.total')}
            empty={t('dashboard.mix.empty')}
          />
        </Slot>

        <Slot i={5} id="attention">
          <AttentionPanel rows={signals.attention} />
        </Slot>
        <Slot i={5} id="inbox">
          <InboxPanel rows={unreadThreads} />
        </Slot>
        <Slot i={5}>
          <LeadsPanel leads={d.latestLeads} />
        </Slot>

        <Slot i={6} id="money">
          <MoneyPanel data={cash} />
        </Slot>
        <Slot i={6}>
          <TrendCard
            title={t('dashboard.leadsTrend')}
            series={d.leadsByWeek.map((w) => ({ at: w.week, count: w.count }))}
            unit="week"
            ranges={[4, 8, 12]}
            initial={8}
            kind="bar"
            xLabel={t('appointments.week')}
            yLabel={t('nav.leads')}
          />
        </Slot>
        <Slot i={6}>
          <OutcomesCard windows={windows} />
        </Slot>

        <Slot i={7}>
          <Panel
            className="rounded-[18px]"
            padded={false}
            title={t('dashboard.activity')}
            action={
              <Link
                href="/admin/messages"
                className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold hover:underline"
              >
                {t('nav.messages')}
                {unread > 0 && (
                  <Badge tone="accent">{t('portal.messages.unread', { count: unread })}</Badge>
                )}
              </Link>
            }
          >
            {activity.length ? (
              <ul className="divide-y divide-a-border">
                {activity.map((a) => (
                  <li key={`${a.client_id}-${a.kind}`}>
                    <Link
                      href={`/admin/clients/${a.client_id}?tab=${activityTab[a.kind]}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-a-surface-2/50"
                    >
                      <Avatar name={a.full_name} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{a.full_name}</span>{' '}
                        <span className="text-a-muted">
                          {t(`dashboard.activityKinds.${a.kind}`)}
                        </span>
                      </span>
                      <span className="shrink-0 num text-[0.75rem] text-a-muted">
                        {format.relativeTime(new Date(a.at))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact>{t('dashboard.noActivity')}</EmptyState>
            )}
          </Panel>
        </Slot>
        <Slot i={7}>
          <GoalBoard rows={signals.goals} />
        </Slot>
        <Slot i={7} className="md:col-span-2 md:max-xl:h-auto">
          <BirthdaysPanel rows={signals.birthdays} templates={templates} locale={locale} />
        </Slot>
      </div>
    </div>
  );
}

/**
 * A card's place on the dashboard grid. Sizes: medium = a third of the row, large = two thirds
 * (tablets: half / full; phones: one column, natural height). `tall` rows hold the day's work
 * (agenda, tasks); every other row is the standard height.
 */
function Slot({
  size = 'md',
  tall,
  i,
  id,
  className,
  children,
}: {
  size?: 'md' | 'lg';
  tall?: boolean;
  i?: number;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Rise
      i={i}
      id={id}
      className={cn(
        'dash-card min-w-0 scroll-mt-20',
        size === 'lg' ? 'md:col-span-2 xl:col-span-8' : 'xl:col-span-4',
        tall ? 'md:h-[31rem]' : 'md:h-[25.5rem]',
        className,
      )}
    >
      {children}
    </Rise>
  );
}
