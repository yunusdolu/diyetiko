'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { TaskRow } from '@/lib/admin/insights';
import type { HabitRow } from '@/lib/admin/portal';
import {
  adherenceDays,
  clinical,
  dailyWeights,
  goalJourney,
  waNumber,
  type WeightSample,
} from '@/lib/admin/signals';
import type { Locale } from '@/lib/i18n/config';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn, whatsappHref } from '@/lib/utils';
import type { Appointment, ClientNote, ClientRow, Measurement, ProgramMeta } from '@/types/admin';
import type { Checkin, Message } from '@/types/portal';
import { TrendChartLazy } from '@/components/admin/charts-lazy';
import {
  reminderText,
  WhatsAppIcon,
  type ReminderTemplates,
} from '@/components/admin/dashboard/agenda';
import { TaskPanel } from '@/components/admin/dashboard/tasks';
import { Rise, Spotlight } from '@/components/admin/fx';
import { Badge, Button, EmptyState } from '@/components/admin/ui';
import type { Billing, LabRow } from '@/lib/admin/practice';
import { labSeries } from '@/lib/admin/practice-logic';
import { SessionTrack, useMoney } from './billing';
import { testName } from './labs';

export type OverviewTab =
  'general' | 'tracking' | 'messages' | 'measurements' | 'notes' | 'programs' | 'billing' | 'labs';

/**
 * The client at a glance — what the dietitian wants on screen when the client walks in: where
 * they are on the way to the goal, what the formulas say about the latest measurements, how the
 * last four weeks went, and what is next. Everything is computed from the client's own records
 * (signals.ts); nothing is sent anywhere.
 */
export function ClientOverview({
  client,
  measurements,
  weights,
  checkins,
  habits,
  onPortal,
  appointments,
  programs,
  messages,
  notes,
  tasks,
  today,
  templates,
  billing,
  labs,
  onTab,
  onMeasure,
  onBook,
}: {
  /** null: the practice migration is not applied yet (the cards are left out) */
  billing: Billing | null;
  labs: LabRow[] | null;
  client: ClientRow;
  measurements: Measurement[];
  weights: WeightSample[];
  checkins: Checkin[];
  habits: HabitRow[];
  onPortal: boolean;
  appointments: Appointment[];
  programs: (ProgramMeta & { day_count: number })[];
  messages: Message[];
  notes: ClientNote[];
  tasks: TaskRow[] | null;
  today: string;
  templates: ReminderTemplates;
  onTab: (tab: OverviewTab) => void;
  onMeasure: () => void;
  onBook: () => void;
}) {
  const t = useTranslations('admin.clients.overview');
  const tp = useTranslations('admin.programs');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const kg = (v: number, sign = false) =>
    format.number(v, { maximumFractionDigits: 1, signDisplay: sign ? 'exceptZero' : 'auto' });

  const journey = goalJourney(weights, client.goal_weight_kg);
  const days = dailyWeights(weights);
  const latestWeight = days.at(-1)?.kg ?? null;
  const waistM = [...measurements].reverse().find((m) => m.waist_cm != null);
  const hipM =
    waistM?.hip_cm != null ? waistM : [...measurements].reverse().find((m) => m.hip_cm != null);
  const c = clinical(
    {
      sex: client.sex,
      birth_date: client.birth_date,
      height_cm: client.height_cm,
      activity_level: client.activity_level,
      goal_weight_kg: client.goal_weight_kg,
    },
    { weight_kg: latestWeight, waist_cm: waistM?.waist_cm ?? null, hip_cm: hipM?.hip_cm ?? null },
    today,
  );
  const next = appointments
    .filter(
      (a) =>
        a.status === 'scheduled' && Date.parse(a.starts_at) > Date.parse(`${today}T00:00:00+03:00`),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const program = programs.find((p) => p.status === 'active');
  const lastMessage = messages.at(-1);
  const unread = messages.filter((m) => m.author === 'client' && !m.read_at).length;
  const note = notes.find((n) => n.pinned) ?? notes[0];
  const phone = waNumber(client.phone);

  return (
    <div className="space-y-4">
      {(client.allergies || client.medical_notes) && (
        <Rise>
          <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[color-mix(in_oklab,var(--a-danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--a-danger)_8%,transparent)] px-4 py-3 text-[0.875rem]">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="text-a-danger">
              <path
                d="M12 3l9 16H3l9-16ZM12 10v4M12 17h.01"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {client.allergies && (
              <span>
                <span className="font-semibold">{t('allergies')}:</span> {client.allergies}
              </span>
            )}
            {client.medical_notes && (
              <button
                type="button"
                onClick={() => onTab('general')}
                className="ms-auto inline-flex h-6 items-center rounded-pill bg-a-surface px-2.5 text-[0.75rem] font-semibold text-a-danger hover:underline"
              >
                {t('medical')}
              </button>
            )}
          </div>
        </Rise>
      )}

      {/* quick actions */}
      <Rise i={1}>
        <div className="-mx-1 -mt-1.5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 pt-1.5 pb-1">
          <QuickAction icon="measure" onClick={onMeasure} primary>
            {t('quick.measure')}
          </QuickAction>
          <QuickAction icon="note" onClick={() => onTab('notes')}>
            {t('quick.note')}
          </QuickAction>
          <QuickAction icon="appointment" onClick={onBook}>
            {t('quick.appointment')}
          </QuickAction>
          {onPortal && (
            <QuickAction icon="message" onClick={() => onTab('messages')}>
              {t('quick.message')}
            </QuickAction>
          )}
          {phone && (
            <QuickAction icon="whatsapp" href={whatsappHref(phone)} external>
              {t('quick.whatsapp')}
            </QuickAction>
          )}
          {client.phone && (
            <QuickAction icon="call" href={`tel:${client.phone.replace(/[^\d+]/g, '')}`}>
              {t('quick.call')}
            </QuickAction>
          )}
          {client.email && (
            <QuickAction icon="email" href={`mailto:${client.email}`}>
              {t('quick.email')}
            </QuickAction>
          )}
          <QuickAction icon="report" href={`/admin/report/${client.id}`} external>
            {t('quick.report')}
          </QuickAction>
        </div>
      </Rise>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        {/* goal journey */}
        <Rise i={2} className="xl:col-span-7">
          <Card
            title={t('journey')}
            hint={journey?.trend ? t('trendHint', { n: journey.trend.samples }) : undefined}
          >
            {!days.length ? (
              <EmptyState
                action={
                  <Button variant="primary" size="sm" onClick={onMeasure}>
                    {t('quick.measure')}
                  </Button>
                }
              >
                {t('noWeight')}
              </EmptyState>
            ) : (
              <div className="space-y-5">
                {journey ? (
                  <>
                    <dl className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ['start', journey.start.kg, journey.start.day],
                          ['now', journey.current.kg, journey.current.day],
                          ['goal', journey.goal, null],
                        ] as const
                      ).map(([k, v, d]) => (
                        <div
                          key={k}
                          className={cn(
                            'rounded-[14px] px-3 py-2.5',
                            k === 'now' ? 'bg-a-accent text-a-accent-text' : 'bg-a-surface-2',
                          )}
                        >
                          <dt className="text-[0.75rem] font-semibold opacity-75">{t(k)}</dt>
                          <dd className="mt-0.5 num-wide text-[1.375rem] leading-tight sm:text-[1.625rem]">
                            {kg(v)}
                            <span className="ms-1 text-[0.75rem] opacity-70">kg</span>
                          </dd>
                          {d && (
                            <dd className="text-[0.6875rem] opacity-70">
                              {format.dateTime(new Date(`${d}T12:00:00Z`), {
                                day: 'numeric',
                                month: 'short',
                                timeZone: 'UTC',
                              })}
                            </dd>
                          )}
                        </div>
                      ))}
                    </dl>
                    <JourneyTrack progress={journey.progress} reached={journey.reached} />
                    <div className="flex flex-wrap gap-2 text-[0.8125rem]">
                      <Pill>
                        {t('change')}: <b className="num">{kg(journey.change, true)} kg</b>
                      </Pill>
                      <Pill>
                        {journey.reached ? t('reached') : t('left', { kg: kg(journey.remaining) })}
                      </Pill>
                      {journey.trend && (
                        <Pill>
                          {t('perWeek', {
                            kg: kg(Math.round(journey.trend.perWeek * 100) / 100, true),
                          })}
                        </Pill>
                      )}
                    </div>
                    {!journey.reached && (
                      <p className="text-[0.8125rem] text-a-muted">
                        {journey.etaDays != null ? (
                          <>
                            <span className="font-semibold text-a-text">
                              {t('eta', {
                                date: format.dateTime(
                                  new Date(
                                    Date.parse(`${today}T12:00:00Z`) + journey.etaDays * 864e5,
                                  ),
                                  {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    timeZone: 'UTC',
                                  },
                                ),
                              })}
                            </span>{' '}
                            · {t('etaHint')}
                          </>
                        ) : journey.trend ? null : (
                          t('noTrend')
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="flex flex-wrap items-center gap-2 text-[0.875rem] text-a-muted">
                    {t('noGoal')}
                    <button
                      type="button"
                      onClick={() => onTab('general')}
                      className="font-semibold text-a-text underline-offset-4 hover:underline"
                    >
                      {t('complete')}
                    </button>
                  </p>
                )}
                <TrendChartLazy
                  height={170}
                  data={days.map((d) => ({
                    x: format.dateTime(new Date(`${d.day}T12:00:00Z`), {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    }),
                    y: d.kg,
                  }))}
                  unit="kg"
                  decimals={1}
                  goal={client.goal_weight_kg}
                  xLabel={t('weights')}
                  yLabel="kg"
                />
              </div>
            )}
          </Card>
        </Rise>

        {/* clinical indicators */}
        <Rise i={3} className="xl:col-span-5">
          <Card title={t('clinical')} hint={t('clinicalHint')}>
            <div className="grid grid-cols-2 gap-2.5">
              <Indicator
                label={t('bmi')}
                value={
                  c.bmi != null
                    ? format.number(c.bmi, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                    : '—'
                }
                note={c.bmiCategory ? <BmiLabel category={c.bmiCategory} /> : undefined}
              >
                {c.bmi != null && <Scale value={c.bmi} min={15} max={40} marks={[18.5, 25, 30]} />}
              </Indicator>
              <Indicator
                label={t('healthyRange')}
                value={c.healthyRange ? `${kg(c.healthyRange[0])}–${kg(c.healthyRange[1])}` : '—'}
                unit={c.healthyRange ? 'kg' : undefined}
              />
              <Indicator
                label={t('whtr')}
                value={c.whtr != null ? format.number(c.whtr, { minimumFractionDigits: 2 }) : '—'}
                note={
                  c.whtrBand ? <Band tone={c.whtrBand}>{t(`bands.${c.whtrBand}`)}</Band> : undefined
                }
                sub={t('threshold', { value: format.number(0.5, { minimumFractionDigits: 1 }) })}
              />
              <Indicator
                label={t('whr')}
                value={c.whr != null ? format.number(c.whr, { minimumFractionDigits: 2 }) : '—'}
                note={
                  c.whrBand ? <Band tone={c.whrBand}>{t(`bands.${c.whrBand}`)}</Band> : undefined
                }
                sub={
                  client.sex === 'female' || client.sex === 'male'
                    ? t('threshold', {
                        value: format.number(client.sex === 'male' ? 0.9 : 0.85, {
                          minimumFractionDigits: 2,
                        }),
                      })
                    : undefined
                }
              />
            </div>

            {c.energy ? (
              <div className="mt-3 rounded-[14px] bg-a-surface-2 p-3.5">
                <dl className="grid grid-cols-2 gap-3 text-[0.8125rem]">
                  <div>
                    <dt className="text-a-muted">{t('bmr')}</dt>
                    <dd className="num font-semibold">
                      {format.number(Math.round(c.energy.bmr))} kcal
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-muted">{t('tdee')}</dt>
                    <dd className="num font-semibold">
                      {format.number(Math.round(c.energy.tdee))} kcal
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-a-muted">
                      {t('range', { goal: t(`goals.${c.energy.goal}`) })}
                    </dt>
                    <dd className="num-wide text-[1.25rem] leading-tight">
                      <bdi dir="ltr">
                        {format.number(c.energy.range.min)}–{format.number(c.energy.range.max)}
                      </bdi>{' '}
                      <span className="text-[0.75rem] text-a-muted">kcal</span>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-a-muted">{t('macros')}</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      <MacroChip label="P" grams={c.energy.macros.protein} />
                      <MacroChip label="K" grams={c.energy.macros.carb} />
                      <MacroChip label="Y" grams={c.energy.macros.fat} />
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            {c.missing.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-a-muted">
                {t('missing', {
                  fields: c.missing.map((f) => t(`fields.${f}`)).join(', '),
                })}
                <button
                  type="button"
                  onClick={() =>
                    onTab(
                      c.missing.every((f) => f === 'waist' || f === 'hip' || f === 'weight')
                        ? 'measurements'
                        : 'general',
                    )
                  }
                  className="font-semibold text-a-text underline-offset-4 hover:underline"
                >
                  {t('complete')}
                </button>
              </p>
            )}
          </Card>
        </Rise>

        {/* last four weeks */}
        <Rise i={4} className="xl:col-span-7">
          <Adherence
            checkins={checkins}
            habits={habits}
            onPortal={onPortal}
            today={today}
            onOpen={() => onTab(onPortal ? 'tracking' : 'general')}
          />
        </Rise>

        <Rise i={5} className="xl:col-span-5">
          <TaskPanel tasks={tasks} clientId={client.id} />
        </Rise>
      </div>

      {/* what is next / latest */}
      <Rise i={6} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniCard title={t('nextAppointment')}>
          {next ? (
            <>
              <p className="num font-semibold">
                {format.dateTime(new Date(next.starts_at), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hourCycle: 'h23',
                })}
              </p>
              <p className="text-[0.75rem] text-a-muted">
                {format.relativeTime(new Date(next.starts_at))}
              </p>
              {phone && (
                <a
                  href={whatsappHref(
                    phone,
                    reminderText(
                      {
                        ...next,
                        phone: client.phone,
                        language: client.preferred_language,
                        client_name: client.full_name,
                      },
                      templates,
                      locale,
                    ),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-pill border border-a-border px-3 text-[0.75rem] font-semibold hover:border-[#25d366] hover:bg-[#25d366]/10"
                >
                  <WhatsAppIcon />
                  {t('quick.whatsapp')}
                </a>
              )}
            </>
          ) : (
            <>
              <p className="text-[0.8125rem] text-a-muted">{t('noAppointment')}</p>
              <button
                type="button"
                onClick={onBook}
                className="mt-2 text-[0.8125rem] font-semibold underline-offset-4 hover:underline"
              >
                {t('quick.appointment')}
              </button>
            </>
          )}
        </MiniCard>
        <MiniCard title={t('program')}>
          {program ? (
            <Link href={`/admin/programs/${program.id}`} className="group block">
              <p className="font-semibold group-hover:underline group-hover:underline-offset-4">
                {program.title}
              </p>
              {program.target_kcal != null && (
                <p className="num text-[0.75rem] text-a-muted">
                  {t('kcal', { kcal: format.number(program.target_kcal) })}
                </p>
              )}
            </Link>
          ) : (
            <>
              <p className="text-[0.8125rem] text-a-muted">{t('noProgram')}</p>
              <Link
                href={`/admin/programs?new=1&client=${client.id}`}
                className="mt-2 inline-block text-[0.8125rem] font-semibold underline-offset-4 hover:underline"
              >
                {tp('new')}
              </Link>
            </>
          )}
        </MiniCard>
        <MiniCard
          title={t('lastMessage')}
          badge={unread > 0 ? <Badge tone="accent">{unread}</Badge> : undefined}
        >
          {lastMessage ? (
            <button type="button" onClick={() => onTab('messages')} className="block text-start">
              <p className="line-clamp-3 text-[0.8125rem]">{lastMessage.body}</p>
              <p className="mt-1 text-[0.6875rem] text-a-muted">
                {format.relativeTime(new Date(lastMessage.created_at))}
              </p>
            </button>
          ) : (
            <p className="text-[0.8125rem] text-a-muted">{t('noMessages')}</p>
          )}
        </MiniCard>
        <MiniCard title={note?.pinned ? t('pinned') : t('latestNote')}>
          {note ? (
            <button type="button" onClick={() => onTab('notes')} className="block text-start">
              <p className="line-clamp-3 text-[0.8125rem] whitespace-pre-line">{note.body}</p>
              <p className="mt-1 text-[0.6875rem] text-a-muted">
                {format.relativeTime(new Date(note.created_at))}
              </p>
            </button>
          ) : (
            <>
              <p className="text-[0.8125rem] text-a-muted">{t('noNotes')}</p>
              <button
                type="button"
                onClick={() => onTab('notes')}
                className="mt-2 text-[0.8125rem] font-semibold underline-offset-4 hover:underline"
              >
                {t('quick.note')}
              </button>
            </>
          )}
        </MiniCard>
      </Rise>

      {(billing || labs) && (
        <Rise i={7} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {billing && <PackageMini billing={billing} onOpen={() => onTab('billing')} />}
          {labs && <LabsMini labs={labs} onOpen={() => onTab('labs')} />}
        </Rise>
      )}
    </div>
  );
}

/** The package the client is in: sessions left and anything still owed. */
function PackageMini({ billing, onOpen }: { billing: Billing; onOpen: () => void }) {
  const t = useTranslations('admin.billing');
  const money = useMoney();
  const pkg =
    billing.packages.find((p) => p.state === 'active' || p.state === 'ending') ??
    billing.packages.find((p) => !p.closed_at && p.state !== 'upcoming');
  return (
    <MiniCard
      title={t('title')}
      badge={
        pkg ? (
          <Badge tone={pkg.state === 'ending' ? 'warn' : pkg.state === 'done' ? 'neutral' : 'ok'}>
            {t(`state.${pkg.state}`)}
          </Badge>
        ) : undefined
      }
    >
      <button type="button" onClick={onOpen} className="block w-full text-start">
        {pkg ? (
          <>
            <p className="font-semibold">{pkg.name}</p>
            {pkg.sessions_total != null ? (
              <div className="mt-2">
                <SessionTrack
                  total={pkg.sessions_total}
                  used={Math.min(pkg.used, pkg.sessions_total)}
                />
                <p className="mt-1.5 text-[0.75rem] text-a-muted">
                  {t('used', {
                    used: Math.min(pkg.used, pkg.sessions_total),
                    total: pkg.sessions_total,
                  })}
                </p>
              </div>
            ) : (
              <p className="text-[0.75rem] text-a-muted">{t('usedOpen', { used: pkg.used })}</p>
            )}
          </>
        ) : (
          <p className="text-[0.8125rem] text-a-muted">{t('noOpen')}</p>
        )}
        {billing.due.length > 0 && (
          <p className="mt-2 text-[0.8125rem] font-semibold text-a-danger">
            {t('due')}{' '}
            <span className="num">
              {billing.due.map((d) => money(d.amount, d.currency)).join(' + ')}
            </span>
          </p>
        )}
      </button>
    </MiniCard>
  );
}

/** Lab values outside the lab's own range, from each test's latest result. */
function LabsMini({ labs, onOpen }: { labs: LabRow[]; onOpen: () => void }) {
  const t = useTranslations('admin.labs');
  const format = useFormatter();
  const series = labSeries(labs);
  const out = series.filter((s) => s.flag === 'low' || s.flag === 'high');
  const latest = labs.reduce<string | null>(
    (d, l) => (!d || l.taken_on > d ? l.taken_on : d),
    null,
  );
  return (
    <MiniCard
      title={t('title')}
      badge={out.length ? <Badge tone="danger">{out.length}</Badge> : undefined}
    >
      <button type="button" onClick={onOpen} className="block w-full text-start">
        {!series.length ? (
          <p className="text-[0.8125rem] text-a-muted">{t('emptyShort')}</p>
        ) : (
          <>
            {out.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {out.slice(0, 6).map((s) => (
                  <li key={s.test}>
                    <Badge tone="danger">
                      {testName(t, s.test)} {s.flag === 'high' ? '↑' : '↓'}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : series.some((s) => s.flag) ? (
              <p className="text-[0.8125rem] font-semibold text-a-ok">{t('allInRange')}</p>
            ) : null}
            {latest && (
              <p className="mt-2 text-[0.75rem] text-a-muted">
                {t('latestReport', {
                  date: format.dateTime(new Date(`${latest}T12:00:00`), { dateStyle: 'medium' }),
                })}
              </p>
            )}
          </>
        )}
      </button>
    </MiniCard>
  );
}

// ---- pieces ---------------------------------------------------------------------------------------

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="a-card">
      <header className="border-b border-a-border px-5 py-3.5">
        <h2 className="text-[0.9375rem] font-bold">{title}</h2>
        {hint && <p className="mt-0.5 text-[0.75rem] text-a-muted">{hint}</p>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function MiniCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Spotlight className="a-well">
      <div className="p-4">
        <p className="mb-2 flex items-center justify-between gap-2 text-[0.75rem] font-semibold text-a-muted">
          {title}
          {badge}
        </p>
        {children}
      </div>
    </Spotlight>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-pill bg-a-surface-2 px-3 text-[0.8125rem]">
      {children}
    </span>
  );
}

/** Start ●──────●──────⚑ goal; the filled part is the distance covered. */
function JourneyTrack({ progress, reached }: { progress: number; reached: boolean }) {
  const reduced = usePrefersReducedMotion();
  const format = useFormatter();
  return (
    <div className="relative pt-7" aria-hidden>
      <motion.span
        className="absolute top-0 num text-[0.75rem] font-semibold ltr:-translate-x-1/2 rtl:translate-x-1/2"
        style={{ insetInlineStart: `${progress * 100}%` }}
        initial={{ opacity: 0, y: reduced ? 0 : 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : 0.9, duration: 0.3 }}
      >
        {format.number(progress, { style: 'percent' })}
      </motion.span>
      <div className="relative h-3 rounded-pill bg-a-surface-2">
        <motion.div
          className={cn(
            'absolute inset-y-0 start-0 w-full origin-left rounded-pill rtl:origin-right',
            reached ? 'bg-a-ok' : 'bg-a-chart',
          )}
          initial={{ scaleX: reduced ? progress : 0 }}
          animate={{ scaleX: Math.max(progress, 0.02) }}
          transition={{ duration: reduced ? 0 : 1.1, ease: ease.out, delay: reduced ? 0 : 0.2 }}
        />
        <motion.span
          className="shadow absolute top-1/2 size-5 -translate-y-1/2 rounded-full border-[3px] border-a-surface bg-a-text ltr:-translate-x-1/2 rtl:translate-x-1/2"
          initial={{ insetInlineStart: reduced ? `${progress * 100}%` : '0%' }}
          animate={{ insetInlineStart: `${progress * 100}%` }}
          transition={{ duration: reduced ? 0 : 1.1, ease: ease.out, delay: reduced ? 0 : 0.2 }}
        />
        <span className="absolute end-0 -top-1.5 h-6 w-[3px] rounded-pill bg-a-text" />
      </div>
    </div>
  );
}

function Indicator({
  label,
  value,
  unit,
  note,
  sub,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: ReactNode;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-a-border p-3">
      <p className="text-[0.75rem] font-semibold text-a-muted">{label}</p>
      <p className="mt-1 num-wide text-[1.25rem] leading-tight">
        <bdi dir="ltr">{value}</bdi>
        {unit && <span className="ms-1 text-[0.75rem] text-a-muted">{unit}</span>}
      </p>
      {note && <div className="mt-1">{note}</div>}
      {sub && <p className="mt-1 text-[0.6875rem] text-a-muted">{sub}</p>}
      {children}
    </div>
  );
}

function Band({ tone, children }: { tone: 'ok' | 'raised' | 'high'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-pill px-2 text-[0.6875rem] font-semibold',
        tone === 'ok'
          ? 'bg-[color-mix(in_oklab,var(--a-ok)_14%,transparent)] text-a-ok'
          : tone === 'raised'
            ? 'bg-[color-mix(in_oklab,var(--a-warn)_18%,transparent)] text-a-warn'
            : 'bg-[color-mix(in_oklab,var(--a-danger)_14%,transparent)] text-a-danger',
      )}
    >
      {children}
    </span>
  );
}

function BmiLabel({ category }: { category: 'under' | 'normal' | 'over' | 'obese' }) {
  const t = useTranslations('admin.clients.overview.bmiCategories');
  return <span className="text-[0.75rem] text-a-muted">{t(category)}</span>;
}

/** A thin scale with cut-off ticks and a marker at the value (BMI 15…40). */
function Scale({
  value,
  min,
  max,
  marks,
}: {
  value: number;
  min: number;
  max: number;
  marks: number[];
}) {
  const reduced = usePrefersReducedMotion();
  const pos = (v: number) => `${((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100}%`;
  return (
    <div className="relative mt-2.5 h-1.5 rounded-pill bg-a-surface-2" aria-hidden>
      {marks.map((m) => (
        <span
          key={m}
          className="absolute -top-0.5 h-2.5 w-px bg-a-muted/50"
          style={{ insetInlineStart: pos(m) }}
        />
      ))}
      <motion.span
        className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-a-text ring-2 ring-a-surface ltr:-translate-x-1/2 rtl:translate-x-1/2"
        initial={{ insetInlineStart: reduced ? pos(value) : '0%' }}
        animate={{ insetInlineStart: pos(value) }}
        transition={{ duration: reduced ? 0 : 0.9, ease: ease.out, delay: reduced ? 0 : 0.3 }}
      />
    </div>
  );
}

function MacroChip({ label, grams }: { label: string; grams: number }) {
  const format = useFormatter();
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-a-surface px-2.5 text-[0.75rem]">
      <b>{label}</b>
      <span className="num">{format.number(grams)} g</span>
    </span>
  );
}

/** 28 squares, oldest first: nothing / logged / most habits done. */
function Adherence({
  checkins,
  habits,
  onPortal,
  today,
  onOpen,
}: {
  checkins: Checkin[];
  habits: HabitRow[];
  onPortal: boolean;
  today: string;
  onOpen: () => void;
}) {
  const t = useTranslations('admin.clients.overview');
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const active = habits.filter((h) => h.active).map((h) => h.id);
  const marks = adherenceDays(checkins, active, today);
  const logged = marks.filter((m) => m.logged).length;
  const recent = checkins.filter((c) => c.day >= marks[0]!.day);
  const habitShares = marks.filter((m) => m.habits != null).map((m) => m.habits!);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const habitAvg = avg(habitShares);
  const water = avg(recent.filter((c) => c.water_ml != null).map((c) => c.water_ml!));
  const energy = avg(recent.filter((c) => c.energy != null).map((c) => c.energy!));
  const state = (m: (typeof marks)[number]) =>
    !m.logged ? 'none' : m.habits != null && m.habits >= 0.5 ? 'most' : 'some';

  return (
    <Card title={t('adherence')}>
      {!onPortal && !checkins.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.875rem] text-a-muted">{t('notOnPortal')}</p>
          <Button size="sm" onClick={onOpen}>
            {t('openPortal')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ol
            className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 md:grid-cols-[repeat(28,minmax(0,1fr))] md:gap-1.5"
            aria-label={t('logged', { n: logged })}
          >
            {marks.map((m, i) => {
              const s = state(m);
              const label = t('dayLabel', {
                day: format.dateTime(new Date(`${m.day}T12:00:00Z`), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                }),
                state: t(`legend.${s}`),
              });
              return (
                <motion.li
                  key={m.day}
                  title={label}
                  aria-label={label}
                  initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, ease: ease.out, delay: reduced ? 0 : i * 0.015 }}
                  className={cn(
                    'aspect-square max-h-7 rounded-[5px]',
                    s === 'none'
                      ? 'bg-a-surface-2'
                      : s === 'some'
                        ? 'bg-[color-mix(in_oklab,var(--a-chart)_45%,var(--a-surface))]'
                        : 'bg-a-chart',
                    m.day === today &&
                      'ring-[1.5px] ring-a-text ring-offset-1 ring-offset-a-surface',
                  )}
                />
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-a-muted">
            {(['none', 'some', 'most'] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    'size-2.5 rounded-[3px]',
                    s === 'none'
                      ? 'bg-a-surface-2 ring-1 ring-a-border'
                      : s === 'some'
                        ? 'bg-[color-mix(in_oklab,var(--a-chart)_45%,var(--a-surface))]'
                        : 'bg-a-chart',
                  )}
                />
                {t(`legend.${s}`)}
              </span>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat2 label={t('logged', { n: logged })} value={`${logged}/28`} />
            <Stat2
              label={t('habitsAvg')}
              value={habitAvg != null ? format.number(habitAvg, { style: 'percent' }) : '—'}
            />
            <Stat2
              label={t('waterAvg')}
              value={
                water != null
                  ? `${format.number(water / 1000, { maximumFractionDigits: 1 })} L`
                  : '—'
              }
            />
            <Stat2
              label={t('energyAvg')}
              value={
                energy != null ? `${format.number(energy, { maximumFractionDigits: 1 })}/5` : '—'
              }
            />
          </dl>
        </div>
      )}
    </Card>
  );
}

function Stat2({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-a-surface-2 px-3 py-2">
      <dd className="num-wide text-[1.125rem] leading-tight">
        <bdi dir="ltr">{value}</bdi>
      </dd>
      <dt className="text-[0.6875rem] text-a-muted">{label}</dt>
    </div>
  );
}

const QUICK_ICONS = {
  measure: 'M3 17l14-14 4 4L7 21H3v-4ZM12 8l2 2M9 11l2 2M15 5l2 2',
  note: 'M5 4h10l4 4v12H5V4ZM14 4v5h5M8 13h8M8 16.5h5',
  appointment: 'M4 6h16v14H4V6ZM4 10h16M9 3v4M15 3v4M12 13v4M10 15h4',
  message: 'M4 5h16v11H9l-5 4V5Z',
  call: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  email: 'M3 6h18v12H3V6ZM3 7l9 6 9-6',
  report: 'M6 3h9l4 4v14H6V3ZM14 3v5h5M9 17v-3M12 17v-6M15 17v-4',
} as const;

function QuickAction({
  icon,
  children,
  onClick,
  href,
  external,
  primary,
}: {
  icon: keyof typeof QUICK_ICONS | 'whatsapp';
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  primary?: boolean;
}) {
  const cls = cn(
    'inline-flex h-10 shrink-0 items-center gap-2 rounded-pill px-4 text-[0.8125rem] font-semibold whitespace-nowrap transition-[background-color,border-color,translate] active:translate-y-px',
    primary
      ? 'bg-a-accent text-a-accent-text hover:opacity-90'
      : 'border border-a-border bg-a-surface hover:bg-a-surface-2',
  );
  const glyph =
    icon === 'whatsapp' ? (
      <WhatsAppIcon size={15} />
    ) : (
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
        <path d={QUICK_ICONS[icon]} />
      </svg>
    );
  if (href)
    return (
      <a
        href={href}
        className={cls}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {glyph}
        {children}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {glyph}
      {children}
    </button>
  );
}
