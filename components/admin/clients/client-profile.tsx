'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useNow, useTranslations, useLocale } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  addMeasurementAction,
  addNoteAction,
  archiveClientAction,
  deleteFileAction,
  deleteMeasurementAction,
  deleteNoteAction,
  hardDeleteClientAction,
  pinNoteAction,
} from '@/app/admin/_actions/clients';
import { localeNames } from '@/lib/i18n/config';
import { admin } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { HabitRow, PortalAccess } from '@/lib/admin/portal';
import type {
  Appointment,
  ClientFile,
  ClientNote,
  ClientRow,
  Measurement,
  ProgramMeta,
} from '@/types/admin';
import type { Checkin, DiaryMeal, Message } from '@/types/portal';
import { TrendChartLazy } from '@/components/admin/charts-lazy';
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageTitle,
  Panel,
  Sheet,
  Textarea,
} from '@/components/admin/ui';
import { Tabs } from '@/components/ui/tabs';
import type { ActionState } from '@/components/ui/status-icon';
import { AppointmentSheet } from '../appointments/appointment-sheet';
import { ClientForm } from './client-form';
import { PortalAccessPanel, type InviteText } from './portal-access';
import type { SharedFile } from '@/lib/admin/portal';
import type { PlanAdherence } from '@/lib/portal/logic';
import { FileChip } from '@/components/ui/file-chip';
import { DiaryTab, MessagesTab, TrackingTab } from './portal-tabs';
import { MeasurementCompare } from './compare';
import { ClientOverview } from './overview';
import { BillingTab } from './billing';
import { LabsTab } from './labs';
import type { Billing, LabRow } from '@/lib/admin/practice';
import { ProgressRing } from './progress-ring';
import type { TaskRow } from '@/lib/admin/insights';
import { goalJourney, type WeightSample } from '@/lib/admin/signals';
import type { ReminderTemplates } from '@/components/admin/dashboard/agenda';

type Tab =
  | 'overview'
  | 'general'
  | 'tracking'
  | 'diary'
  | 'messages'
  | 'measurements'
  | 'programs'
  | 'notes'
  | 'files'
  | 'appointments'
  | 'billing'
  | 'labs';
const TABS: Tab[] = [
  'overview',
  'general',
  'tracking',
  'diary',
  'messages',
  'measurements',
  'labs',
  'programs',
  'billing',
  'notes',
  'files',
  'appointments',
];

/** Client portal data for the dietitian's tabs (loaded by the page, all under RLS). */
export interface ClientPortalData {
  access: PortalAccess;
  /** false on Supabase without SUPABASE_SERVICE_ROLE_KEY: invites cannot be redeemed */
  ready: boolean;
  inviteText: InviteText;
  habits: HabitRow[];
  checkins: Checkin[];
  diary: { meals: DiaryMeal[]; from: string; to: string };
  /** planned meals logged over the last seven days; null without an active programme */
  adherence: PlanAdherence | null;
  messages: Message[];
  targetKcal: number | null;
  today: string;
}

export function ClientProfile({
  client,
  measurements,
  notes,
  files,
  appointments,
  programs,
  initialTab,
  portal,
  weights,
  tasks,
  templates,
  billing,
  labs,
  shared,
  uploads,
}: {
  /** packages + payments; null while the practice migration is not applied */
  billing: Billing | null;
  /** lab results; null while the practice migration is not applied */
  labs: LabRow[] | null;
  shared: SharedFile[];
  uploads: boolean;
  /** every weight of the client: clinic measurements + portal check-ins */
  weights: WeightSample[];
  /** this client's tasks (null: tasks table not created yet) */
  tasks: TaskRow[] | null;
  templates: ReminderTemplates;
  client: ClientRow;
  measurements: Measurement[];
  notes: ClientNote[];
  files: ClientFile[];
  appointments: Appointment[];
  programs: (ProgramMeta & { day_count: number; link_count: number })[];
  initialTab?: string;
  portal: ClientPortalData;
}) {
  const t = useTranslations('admin.clients');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const now = useNow();
  const [tab, setTab] = useState<Tab>(
    TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'overview',
  );
  // sheets the overview's quick actions open
  const [measuring, setMeasuring] = useState(false);
  const [booking, setBooking] = useState(false);
  const age = client.birth_date
    ? Math.floor((now.getTime() - new Date(client.birth_date).getTime()) / (365.25 * 864e5))
    : null;
  const last = [...measurements].reverse().find((m) => m.weight_kg != null);

  const changeTab = (v: Tab) => {
    setTab(v);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', v);
    window.history.replaceState(null, '', url);
  };

  return (
    <div>
      <PageTitle
        eyebrow={
          <span className="flex flex-wrap items-center gap-2 tracking-normal normal-case">
            <Link href="/admin/clients" className="hover:underline">
              {t('title')}
            </Link>
            <span aria-hidden>/</span>
            <Badge tone={client.status === 'active' ? 'ok' : 'neutral'}>
              {t(`status.${client.status}`)}
            </Badge>
            {age != null && <span className="num">{t('age', { age })}</span>}
            <span>{localeNames[client.preferred_language]}</span>
            {client.deleted_at && <Badge tone="danger">{t('deletedList')}</Badge>}
          </span>
        }
        title={client.full_name}
        actions={
          <>
            <Link
              href={`/admin/explorer?id=${client.id}`}
              className="inline-flex h-10 items-center rounded-[10px] border border-a-border bg-a-surface px-4 text-[0.875rem] font-semibold hover:bg-a-surface-2"
            >
              {t('openExplorer')}
            </Link>
            <Link
              href={`/admin/programs?new=1&client=${client.id}`}
              className="inline-flex h-10 items-center rounded-[10px] bg-a-accent px-4 text-[0.875rem] font-semibold text-a-accent-text hover:opacity-90"
            >
              {tc('new')} · {t('tabs.programs')}
            </Link>
          </>
        }
      />
      {last && (
        <p className="-mt-3 mb-5 text-[0.8125rem] text-a-muted">
          {t('lastMeasurement')}:{' '}
          <span className="num">
            {format.dateTime(new Date(last.measured_at), { dateStyle: 'medium' })}
          </span>{' '}
          · <span className="num">{last.weight_kg} kg</span>
        </p>
      )}

      <Tabs
        label={client.full_name}
        variant="line"
        value={tab}
        onChange={changeTab}
        idPrefix="client"
        items={TABS.map((v) => ({
          value: v,
          label: t(`tabs.${v}`),
          count:
            v === 'messages'
              ? portal.messages.filter((m) => m.author === 'client' && !m.read_at).length ||
                undefined
              : v === 'measurements'
                ? measurements.length
                : v === 'notes'
                  ? notes.length
                  : v === 'files'
                    ? files.length
                    : v === 'appointments'
                      ? appointments.length
                      : v === 'programs'
                        ? programs.length
                        : v === 'labs'
                          ? labs?.length || undefined
                          : v === 'billing'
                            ? billing?.packages.length || undefined
                            : undefined,
        }))}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          id={`client-panel-${tab}`}
          aria-labelledby={`client-tab-${tab}`}
          className="pt-6"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: admin.dur }}
        >
          {tab === 'overview' && (
            <ClientOverview
              client={client}
              measurements={measurements}
              weights={weights}
              checkins={portal.checkins}
              habits={portal.habits}
              onPortal={portal.access.state === 'active'}
              appointments={appointments}
              programs={programs}
              messages={portal.messages}
              notes={notes}
              tasks={tasks}
              today={portal.today}
              templates={templates}
              billing={billing}
              labs={labs}
              onTab={(v) => changeTab(v)}
              onMeasure={() => setMeasuring(true)}
              onBook={() => setBooking(true)}
            />
          )}
          {tab === 'general' && (
            <div className="space-y-6">
              <PortalAccessPanel
                client={client}
                access={portal.access}
                inviteText={portal.inviteText}
                ready={portal.ready}
              />
              <ClientForm client={client} />
              <DangerZone client={client} />
            </div>
          )}
          {tab === 'tracking' && (
            <TrackingTab
              clientId={client.id}
              onPortal={portal.access.linked}
              habits={portal.habits}
              checkins={portal.checkins}
              adherence={portal.adherence}
              goalWeight={client.goal_weight_kg}
              today={portal.today}
            />
          )}
          {tab === 'diary' && (
            <DiaryTab
              clientId={client.id}
              meals={portal.diary.meals}
              from={portal.diary.from}
              to={portal.diary.to}
              today={portal.today}
              targetKcal={portal.targetKcal}
            />
          )}
          {tab === 'messages' && (
            <MessagesTab
              clientId={client.id}
              messages={portal.messages}
              onPortal={portal.access.state === 'active'}
              uploads={uploads}
            />
          )}
          {tab === 'measurements' && (
            <Measurements client={client} measurements={measurements} weights={weights} />
          )}
          {tab === 'programs' && <Programs programs={programs} clientId={client.id} />}
          {tab === 'notes' && <Notes clientId={client.id} notes={notes} />}
          {tab === 'billing' && (
            <BillingTab clientId={client.id} billing={billing} today={portal.today} />
          )}
          {tab === 'labs' && <LabsTab clientId={client.id} labs={labs} today={portal.today} />}
          {tab === 'files' && <Files clientId={client.id} files={files} shared={shared} />}
          {tab === 'appointments' && (
            <Appointments
              clientId={client.id}
              clientName={client.full_name}
              appointments={appointments}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <MeasurementSheet open={measuring} onOpenChange={setMeasuring} clientId={client.id} />
      <AppointmentSheet
        open={booking}
        onOpenChange={setBooking}
        appointment={null}
        clients={[{ id: client.id, full_name: client.full_name }]}
        defaultClientId={client.id}
      />
    </div>
  );
}

const METRICS = [
  ['weight_kg', 'weight', 'kg', 1],
  ['body_fat_pct', 'bodyFat', '%', 1],
  ['muscle_kg', 'muscle', 'kg', 1],
  ['waist_cm', 'waist', 'cm', 1],
  ['hip_cm', 'hip', 'cm', 1],
  ['chest_cm', 'chest', 'cm', 1],
  ['arm_cm', 'arm', 'cm', 1],
  ['thigh_cm', 'thigh', 'cm', 1],
] as const;
type MetricKey = (typeof METRICS)[number][0];

function Measurements({
  client,
  measurements,
  weights: allWeights,
}: {
  /** clinic + portal weights: the same journey as the overview tab (one number everywhere) */
  weights: WeightSample[];
  client: ClientRow;
  measurements: Measurement[];
}) {
  const t = useTranslations('admin.measurements');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const [metric, setMetric] = useState<MetricKey>('weight_kg');
  const [adding, setAdding] = useState(false);
  const def = METRICS.find((m) => m[0] === metric)!;
  const available = METRICS.filter(([k]) => measurements.some((m) => m[k] != null));
  const series = measurements.map((m) => ({
    x: format.dateTime(new Date(m.measured_at), { day: 'numeric', month: 'short' }),
    y: m[metric],
  }));
  const goal = client.goal_weight_kg;
  const journey = goalJourney(allWeights, goal);
  const start = journey?.start.kg ?? null;
  const current = journey?.current.kg ?? null;
  const progress = journey && journey.direction !== 'maintain' ? journey.progress : null;
  const kg = (v: number) => format.number(v, { maximumFractionDigits: 1 });

  const remove = async (id: string) => {
    const res = await deleteMeasurementAction(client.id, id);
    if (res.ok) {
      toast.success(tc('deleted'));
      router.refresh();
    }
  };

  if (!measurements.length)
    return (
      <>
        <EmptyState
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              {t('add')}
            </Button>
          }
        >
          {t('empty')}
        </EmptyState>
        <MeasurementSheet open={adding} onOpenChange={setAdding} clientId={client.id} />
      </>
    );

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <Panel
        className="xl:col-span-2"
        title={t('chart')}
        action={
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
            {t('add')}
          </Button>
        }
      >
        <div className="mb-4">
          <Tabs
            label={t('metric')}
            value={metric}
            onChange={setMetric}
            items={(available.length ? available : METRICS.slice(0, 1)).map(([k, key]) => ({
              value: k,
              label: t(key),
            }))}
          />
        </div>
        <TrendChartLazy
          data={series}
          unit={def[2]}
          decimals={def[3]}
          goal={metric === 'weight_kg' ? goal : null}
          xLabel={t('date')}
          yLabel={t(def[1])}
        />
      </Panel>
      <Panel title={t('progressToGoal')}>
        {progress != null ? (
          <div className="flex flex-col items-center gap-4">
            <ProgressRing value={progress} size={160} label={t('progressToGoal')}>
              <span className="num-wide text-[1.75rem] leading-none">
                {format.number(Math.max(0, Math.min(1, progress)), { style: 'percent' })}
              </span>
            </ProgressRing>
            <dl className="grid w-full grid-cols-3 gap-2 text-center text-[0.8125rem]">
              {[
                ['start', start],
                ['now', current],
                ['goal', goal],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-[10px] bg-a-surface-2 py-2">
                  <dt className="text-a-muted">
                    {k === 'start' ? t('start') : k === 'now' ? t('current') : t('target')}
                  </dt>
                  <dd className="mt-0.5 num font-semibold">{kg(v as number)} kg</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="text-[0.875rem] text-a-muted">{t('noGoal')}</p>
        )}
      </Panel>
      <Panel className="xl:col-span-3" title={t('compare.title')}>
        <MeasurementCompare measurements={measurements} metrics={METRICS} />
      </Panel>
      <Panel className="xl:col-span-3" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[0.8125rem]">
            <thead>
              <tr className="border-b border-a-border text-a-muted">
                <th className="px-4 py-2.5 text-start font-semibold">{t('date')}</th>
                {METRICS.map(([k, key]) => (
                  <th key={k} className="px-3 py-2.5 text-end font-semibold">
                    {t(key)}
                  </th>
                ))}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {[...measurements].reverse().map((m) => (
                <tr key={m.id} className="border-b border-a-border last:border-0">
                  <td className="px-4 py-2 num-narrow whitespace-nowrap">
                    {format.dateTime(new Date(`${m.measured_at}T12:00:00Z`), {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </td>
                  {METRICS.map(([k]) => (
                    <td key={k} className="px-3 py-2 text-end num-narrow">
                      {m[k] != null ? kg(m[k]) : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-end">
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="text-a-muted hover:text-a-danger"
                      aria-label={tc('delete')}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                        <path
                          d="M6 6l12 12M18 6L6 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <MeasurementSheet open={adding} onOpenChange={setAdding} clientId={client.id} />
    </div>
  );
}

function MeasurementSheet({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
}) {
  const t = useTranslations('admin.measurements');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = async (form: FormData) => {
    setState('loading');
    const res = await addMeasurementAction(clientId, Object.fromEntries(form.entries()));
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    toast.success(tc('saved'));
    router.refresh();
    setTimeout(() => {
      setState('idle');
      onOpenChange(false);
    }, 400);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('add')} width="sm">
      <form action={submit} className="grid grid-cols-2 gap-4">
        <Input
          name="measured_at"
          type="date"
          label={t('date')}
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
          className="col-span-2"
          error={errors.measured_at && tc('required')}
        />
        {METRICS.map(([k, key]) => (
          <Input
            key={k}
            name={k}
            type="number"
            step="0.1"
            inputMode="decimal"
            label={t(key)}
            error={errors[k] && tc('error')}
          />
        ))}
        <Textarea name="note" label={t('note')} rows={2} className="col-span-2" />
        <div className="col-span-2 flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" variant="primary" state={state}>
            {tc('save')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function Programs({
  programs,
  clientId,
}: {
  programs: (ProgramMeta & { day_count: number; link_count: number })[];
  clientId: string;
}) {
  const t = useTranslations('admin.programs');
  const format = useFormatter();
  if (!programs.length)
    return (
      <EmptyState
        action={
          <Link
            href={`/admin/programs?new=1&client=${clientId}`}
            className="font-semibold underline"
          >
            {t('new')}
          </Link>
        }
      >
        {t('empty')}
      </EmptyState>
    );
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {programs.map((p) => (
        <li key={p.id}>
          <Link
            href={`/admin/programs/${p.id}`}
            className="a-card block p-4 transition-[box-shadow,translate] duration-300 fine:hover:-translate-y-0.5 fine:hover:shadow-[0_0_0_1px_var(--a-card-ring),0_18px_36px_-22px_rgb(15_27_23/0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold">{p.title}</span>
              <Badge tone={p.status === 'active' ? 'ok' : 'neutral'}>
                {t(`status.${p.status}`)}
              </Badge>
            </div>
            <p className="mt-2 text-[0.8125rem] text-a-muted">
              {localeNames[p.language]} · {t('day', { n: p.day_count })} ·{' '}
              {format.relativeTime(new Date(p.updated_at))}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Notes({ clientId, notes }: { clientId: string; notes: ClientNote[] }) {
  const t = useTranslations('admin.notes');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const [text, setText] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const add = async () => {
    if (!text.trim()) return;
    setState('loading');
    const res = await addNoteAction(clientId, text);
    if (res.ok) {
      setText('');
      setState('success');
      router.refresh();
      setTimeout(() => setState('idle'), 800);
    } else {
      setState('error');
      setTimeout(() => setState('idle'), 800);
    }
  };
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.4fr]">
      <Panel title={t('add')}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('placeholder')}
          rows={5}
          aria-label={t('add')}
        />
        <div className="mt-3 flex justify-end">
          <Button variant="primary" state={state} onClick={add} disabled={!text.trim()}>
            {t('add')}
          </Button>
        </div>
      </Panel>
      <div>
        {!notes.length ? (
          <EmptyState>{t('empty')}</EmptyState>
        ) : (
          <motion.ul layout className="space-y-3">
            <AnimatePresence initial={false}>
              {notes.map((n) => (
                <motion.li
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={admin.spring}
                  className={cn(
                    'rounded-[16px] border bg-a-surface p-4',
                    n.pinned ? 'border-a-text/40' : 'border-a-border',
                  )}
                >
                  <div className="flex items-center justify-between gap-3 text-[0.75rem] text-a-muted">
                    <span className="num">
                      {format.dateTime(new Date(n.created_at), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                    <span className="flex items-center gap-3">
                      <button
                        type="button"
                        className="font-semibold hover:text-a-text"
                        onClick={async () => {
                          await pinNoteAction(clientId, n.id, !n.pinned);
                          router.refresh();
                        }}
                      >
                        {n.pinned ? t('unpin') : t('pin')}
                      </button>
                      <button
                        type="button"
                        className="font-semibold hover:text-a-danger"
                        onClick={async () => {
                          await deleteNoteAction(clientId, n.id);
                          toast.success(tc('deleted'));
                          router.refresh();
                        }}
                      >
                        {tc('delete')}
                      </button>
                    </span>
                  </div>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                    {n.body}
                  </p>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}

function Files({
  clientId,
  files,
  shared,
}: {
  clientId: string;
  files: ClientFile[];
  /** files exchanged with the client in messages (lab reports they sent, plans sent to them) */
  shared: SharedFile[];
}) {
  const locale = useLocale();
  const t = useTranslations('admin.files');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    for (const file of Array.from(list)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('tooLarge'));
        continue;
      }
      const body = new FormData();
      body.set('file', file);
      body.set('kind', 'client');
      body.set('clientId', clientId);
      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      if (!res.ok)
        toast.error(
          res.status === 415 ? t('badType') : res.status === 413 ? t('tooLarge') : tc('error'),
        );
    }
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {shared.length > 0 && (
        <section className="a-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-a-border px-5 py-3.5">
            <div>
              <h2 className="text-[0.9375rem] font-bold">{t('shared.title')}</h2>
              <p className="mt-0.5 text-[0.75rem] text-a-muted">{t('shared.lead')}</p>
            </div>
            <Link
              href={`/admin/clients/${clientId}?tab=labs`}
              className="inline-flex h-8 items-center rounded-pill border border-a-border px-3 text-[0.8125rem] font-semibold hover:bg-a-surface-2"
            >
              {t('shared.toLabs')}
            </Link>
          </header>
          <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {shared.map((f) => (
              <li key={f.id} className="min-w-0">
                <FileChip
                  href={`/api/admin/message-file/${f.id}`}
                  name={f.name}
                  mime={f.mime}
                  size={f.size}
                  locale={locale}
                  openLabel={t('shared.open')}
                />
                <p className="mt-1.5 px-1 text-[0.75rem] text-a-muted">
                  <span className="font-semibold text-a-text">
                    {f.author === 'client' ? t('shared.fromClient') : t('shared.fromYou')}
                  </span>
                  {' · '}
                  <span className="num">
                    {format.dateTime(new Date(f.created_at), { dateStyle: 'medium' })}
                  </span>
                  {f.body !== f.name && (
                    <span className="mt-0.5 block truncate" title={f.body}>
                      {f.body}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void upload(e.dataTransfer.files);
        }}
        className={cn(
          'grid cursor-pointer place-items-center gap-2 rounded-[16px] border-2 border-dashed px-6 py-10 text-center transition-colors',
          drag
            ? 'border-a-text bg-a-surface-2'
            : 'border-a-border bg-a-surface hover:border-a-text/40',
        )}
      >
        <input
          ref={input}
          type="file"
          className="sr-only"
          multiple
          accept="application/pdf,image/*,text/plain"
          onChange={(e) => void upload(e.target.files)}
        />
        <span className="font-semibold">{busy ? tc('uploading') : tc('dropHere')}</span>
        <span className="text-[0.8125rem] text-a-muted">{t('private')}</span>
      </label>
      {!files.length ? (
        <EmptyState>{t('empty')}</EmptyState>
      ) : (
        <ul className="a-card divide-y divide-a-border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <a
                href={`/api/admin/files/${f.id}`}
                className="min-w-0 truncate font-semibold hover:underline"
              >
                {f.file_name}
              </a>
              <span className="flex shrink-0 items-center gap-4 text-[0.8125rem] text-a-muted">
                <span className="num">
                  {format.number(f.size_bytes / 1024, { maximumFractionDigits: 0 })} KB
                </span>
                <span className="num">
                  {format.dateTime(new Date(f.created_at), { dateStyle: 'short' })}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteFileAction(clientId, f.id);
                    toast.success(tc('deleted'));
                    router.refresh();
                  }}
                  className="font-semibold hover:text-a-danger"
                >
                  {tc('delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Appointments({
  clientId,
  clientName,
  appointments,
}: {
  clientId: string;
  clientName: string;
  appointments: Appointment[];
}) {
  const t = useTranslations('admin.appointments');
  const format = useFormatter();
  const [open, setOpen] = useState<Appointment | 'new' | null>(null);
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setOpen('new')}>
          {t('new')}
        </Button>
      </div>
      {!appointments.length ? (
        <EmptyState>{t('empty')}</EmptyState>
      ) : (
        <ul className="a-card divide-y divide-a-border">
          {appointments.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setOpen(a)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-a-surface-2"
              >
                <span className="num font-semibold">
                  {format.dateTime(new Date(a.starts_at), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                <span className="flex items-center gap-2">
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
      )}
      <AppointmentSheet
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        appointment={open === 'new' ? null : open}
        clients={[{ id: clientId, full_name: clientName }]}
        defaultClientId={clientId}
      />
    </div>
  );
}

function DangerZone({ client }: { client: ClientRow }) {
  const t = useTranslations('admin.clients');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const archive = async () => {
    const res = await archiveClientAction(client.id, !client.deleted_at);
    if (res.ok) {
      toast.success(client.deleted_at ? tc('restored') : t('softDeleted'));
      router.refresh();
    }
  };
  const destroy = async () => {
    setState('loading');
    const res = await hardDeleteClientAction(client.id, name);
    if (!res.ok) {
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    toast.success(tc('deleted'));
    router.push('/admin/clients');
  };
  return (
    <Panel title={tc('actions')}>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`/api/admin/export/client/${client.id}`}
          className="inline-flex h-10 items-center rounded-[10px] border border-a-border px-4 text-[0.875rem] font-semibold hover:bg-a-surface-2"
        >
          {t('export')}
        </a>
        <Button onClick={archive}>{client.deleted_at ? t('restore') : t('softDelete')}</Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          {t('hardDelete')}
        </Button>
      </div>
      <Sheet
        open={confirm}
        onOpenChange={setConfirm}
        side="center"
        width="sm"
        title={t('hardDeleteTitle')}
        description={t('hardDeleteBody')}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>{tc('cancel')}</Button>
            <Button
              variant="danger"
              state={state}
              disabled={name.trim() !== client.full_name.trim()}
              onClick={destroy}
            >
              {t('hardDelete')}
            </Button>
          </>
        }
      >
        <Input
          label={t('hardDeleteConfirm', { name: client.full_name })}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </Sheet>
    </Panel>
  );
}
