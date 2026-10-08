'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addHabitAction, deleteHabitAction, updateHabitAction } from '@/app/admin/_actions/portal';
import type { HabitRow } from '@/lib/admin/portal';
import { addDays, diaryTotals, type PlanAdherence } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import {
  MEAL_SLOTS,
  type Checkin,
  type DiaryItem,
  type DiaryMeal,
  type Message,
} from '@/types/portal';
import { TrendChartLazy } from '@/components/admin/charts-lazy';
import { Conversation } from '@/components/admin/messages/conversation';
import { Badge, Button, EmptyState, Input, Panel, Sheet, Stat } from '@/components/admin/ui';
import type { ActionState } from '@/components/ui/status-icon';

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const utc = { timeZone: 'UTC' } as const;

// ---------------------------------------------------------------------------------------------
// Tracking: check-ins (weight / water / habits / energy / note) + habit goals
// ---------------------------------------------------------------------------------------------

export function TrackingTab({
  clientId,
  onPortal,
  habits,
  checkins,
  adherence,
  goalWeight,
  today,
}: {
  clientId: string;
  onPortal: boolean;
  habits: HabitRow[];
  checkins: Checkin[];
  /** planned meals logged over the last seven days; null without an active programme */
  adherence: PlanAdherence | null;
  goalWeight: number | null;
  today: string;
}) {
  const t = useTranslations('admin.portal.tracking');
  const format = useFormatter();
  const levels = t.raw('energyLevels') as string[];
  const last14 = checkins.filter((c) => c.day > addDays(today, -14));
  const water = last14.filter((c) => c.water_ml != null).map((c) => c.water_ml!);
  const energy = last14.filter((c) => c.energy != null).map((c) => c.energy!);
  // movement: minutes over the last 7 days, and on how many of them
  const last7 = checkins.filter((c) => c.day >= addDays(today, -6));
  const moved = last7.filter((c) => (c.activity_min ?? 0) > 0);
  const movedMin = moved.reduce((a, c) => a + (c.activity_min ?? 0), 0);
  const weights = checkins.filter((c) => c.weight_kg != null);
  const lastWeight = weights.at(-1);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const active = habits.filter((h) => h.active);
  const last28 = checkins.filter((c) => c.day > addDays(today, -28));

  return (
    <div className="space-y-5">
      {!onPortal && !checkins.length ? (
        <EmptyState>{t('notOnPortal')}</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label={t('logged')}
              value={<span className="num">{t('days', { count: last14.length })}</span>}
            />
            <Stat
              label={t('avgWater')}
              value={
                <span className="num">
                  {avg(water) != null
                    ? `${format.number(avg(water)! / 1000, { maximumFractionDigits: 1 })} L`
                    : '—'}
                </span>
              }
            />
            <Stat
              label={t('lastWeight')}
              value={
                <span className="num">
                  {lastWeight
                    ? `${format.number(lastWeight.weight_kg!, { maximumFractionDigits: 1 })} kg`
                    : '—'}
                </span>
              }
              hint={
                lastWeight
                  ? format.dateTime(at(lastWeight.day), { day: 'numeric', month: 'short', ...utc })
                  : undefined
              }
            />
            <Stat
              label={t('adherence7')}
              value={
                <span className="num">
                  {adherence && adherence.planned
                    ? format.number(adherence.logged / adherence.planned, {
                        style: 'percent',
                        maximumFractionDigits: 0,
                      })
                    : '—'}
                </span>
              }
              hint={
                adherence && adherence.planned
                  ? t('adherenceMeals', { logged: adherence.logged, planned: adherence.planned })
                  : t('adherenceNone')
              }
            />
            <Stat
              label={t('activity')}
              value={
                <span className="num">
                  {moved.length ? t('activityValue', { min: movedMin }) : '—'}
                </span>
              }
              hint={moved.length ? t('activityDays', { count: moved.length }) : undefined}
            />
            <Stat
              label={t('avgEnergy')}
              value={
                <span className="num">
                  {avg(energy) != null
                    ? `${format.number(avg(energy)!, { maximumFractionDigits: 1 })} / 5`
                    : '—'}
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel className="xl:col-span-2" title={t('weightChart')}>
              {weights.length ? (
                <TrendChartLazy
                  data={weights.map((c) => ({
                    x: format.dateTime(at(c.day), { day: 'numeric', month: 'short', ...utc }),
                    y: c.weight_kg,
                  }))}
                  unit="kg"
                  decimals={1}
                  goal={goalWeight}
                  xLabel={t('table.day')}
                  yLabel={t('table.weight')}
                />
              ) : (
                <p className="text-[0.875rem] text-a-muted">{t('noCheckins')}</p>
              )}
            </Panel>
            <Panel title={t('adherence')}>
              {active.length ? (
                <ul className="space-y-3.5">
                  {active.map((h) => {
                    const done = last28.filter((c) => c.habits.includes(h.id)).length;
                    const pct = last28.length ? done / last28.length : 0;
                    return (
                      <li key={h.id}>
                        <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                          <span className="min-w-0 font-semibold">{h.label}</span>
                          <span className="shrink-0 num text-a-muted">
                            {t('adherenceValue', { done, total: last28.length })}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-a-surface-2">
                          <div
                            className="h-full origin-left rounded-pill bg-a-chart transition-transform duration-500 rtl:origin-right"
                            style={{ transform: `scaleX(${pct})` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[0.875rem] text-a-muted">{t('noHabits')}</p>
              )}
            </Panel>
          </div>

          <Panel title={t('checkins')} padded={false}>
            {checkins.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[0.8125rem]">
                  <thead>
                    <tr className="border-b border-a-border text-a-muted">
                      <th className="px-4 py-2.5 text-start font-semibold">{t('table.day')}</th>
                      <th className="px-3 py-2.5 text-end font-semibold">{t('table.weight')}</th>
                      <th className="px-3 py-2.5 text-end font-semibold">{t('table.water')}</th>
                      <th className="px-3 py-2.5 text-end font-semibold">{t('table.habits')}</th>
                      <th className="px-3 py-2.5 text-start font-semibold">
                        {t('table.activity')}
                      </th>
                      <th className="px-3 py-2.5 text-start font-semibold">{t('table.energy')}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t('table.note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...checkins]
                      .reverse()
                      .slice(0, 21)
                      .map((c) => {
                        const done = c.habits.filter((id) =>
                          active.some((h) => h.id === id),
                        ).length;
                        return (
                          <tr
                            key={c.day}
                            className="border-b border-a-border align-top last:border-0"
                          >
                            <td className="px-4 py-2 whitespace-nowrap">
                              {format.dateTime(at(c.day), {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                ...utc,
                              })}
                            </td>
                            <td className="px-3 py-2 text-end num-narrow whitespace-nowrap">
                              {c.weight_kg != null
                                ? format.number(c.weight_kg, { maximumFractionDigits: 1 })
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-end num-narrow whitespace-nowrap">
                              {c.water_ml != null
                                ? `${format.number(c.water_ml / 1000, { maximumFractionDigits: 2 })} L`
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-end num-narrow whitespace-nowrap">
                              {active.length ? `${done}/${active.length}` : '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {c.activity_min ? (
                                <>
                                  <span className="num-narrow">
                                    {t('activityValue', { min: c.activity_min })}
                                  </span>
                                  {c.activity_note && (
                                    <span className="text-a-muted"> · {c.activity_note}</span>
                                  )}
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {c.energy != null ? levels[c.energy - 1] : '—'}
                            </td>
                            <td className="max-w-[22rem] px-4 py-2 text-a-muted">{c.note ?? ''}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-5 text-[0.875rem] text-a-muted">{t('noCheckins')}</p>
            )}
          </Panel>
        </>
      )}
      <HabitsPanel clientId={clientId} habits={habits} />
    </div>
  );
}

function HabitsPanel({ clientId, habits }: { clientId: string; habits: HabitRow[] }) {
  const t = useTranslations('admin.portal.tracking');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [pending, start] = useTransition();

  const add = async () => {
    if (!label.trim()) return;
    setState('loading');
    const res = await addHabitAction(clientId, label);
    if (!res.ok) {
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setLabel('');
    setState('success');
    setTimeout(() => setState('idle'), 700);
    router.refresh();
  };
  const run = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(tc('error'));
      router.refresh();
    });

  return (
    <Panel title={t('habits')}>
      <p className="mb-4 text-[0.8125rem] text-a-muted">{t('habitsHint')}</p>
      {habits.length ? (
        <ul
          className={cn(
            'mb-4 divide-y divide-a-border rounded-[12px] border border-a-border',
            pending && 'opacity-70',
          )}
        >
          {habits.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <span
                className={cn(
                  'min-w-0 font-semibold',
                  !h.active && 'text-a-muted line-through decoration-1',
                )}
              >
                {h.label}
              </span>
              <span className="flex items-center gap-2">
                {!h.active && <Badge>{t('paused')}</Badge>}
                <button
                  type="button"
                  onClick={() =>
                    run(() => updateHabitAction(clientId, h.id, { active: !h.active }))
                  }
                  className="text-[0.8125rem] font-semibold text-a-muted hover:text-a-text"
                >
                  {h.active ? t('pause') : t('resume')}
                </button>
                <button
                  type="button"
                  onClick={() => run(() => deleteHabitAction(clientId, h.id))}
                  className="text-[0.8125rem] font-semibold text-a-muted hover:text-a-danger"
                >
                  {tc('delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-[0.875rem] text-a-muted">{t('noHabits')}</p>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div className="min-w-[14rem] flex-1">
          <Input
            label={t('habitLabel')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('habitPlaceholder')}
            maxLength={80}
          />
        </div>
        <Button type="submit" variant="primary" state={state} disabled={!label.trim()}>
          {tc('add')}
        </Button>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Diary: 14 days per page, newest first, with photos and day totals vs the program targets
// ---------------------------------------------------------------------------------------------

export function DiaryTab({
  clientId,
  meals,
  from,
  to,
  today,
  targetKcal,
}: {
  clientId: string;
  meals: DiaryMeal[];
  from: string;
  to: string;
  today: string;
  targetKcal: number | null;
}) {
  const t = useTranslations('admin.portal.diary');
  const tm = useTranslations('meals');
  const tmac = useTranslations('macros');
  const tu = useTranslations('units');
  const format = useFormatter();
  const [photo, setPhoto] = useState<DiaryMeal | null>(null);
  const days = [...new Set(meals.map((m) => m.eaten_on))].sort().reverse();
  const short = (iso: string) =>
    format.dateTime(at(iso), { day: 'numeric', month: 'short', ...utc });
  const qty = (i: DiaryItem) =>
    i.servings != null
      ? `${format.number(i.servings, { maximumFractionDigits: 1 })} ${tu('portion')}`
      : i.unit_key && i.unit_qty
        ? `${format.number(i.unit_qty, { maximumFractionDigits: 1 })} ${tu(i.unit_key as 'piece')}`
        : i.grams
          ? `${format.number(i.grams, { maximumFractionDigits: 0 })} ${tu('g')}`
          : t('freeText');
  const href = (end: string) => `/admin/clients/${clientId}?tab=diary&dto=${end}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="num text-[0.875rem] font-semibold">
          {t('range', { from: short(from), to: short(to) })}
        </p>
        <div className="flex gap-2">
          <Link
            href={href(addDays(from, -1))}
            scroll={false}
            className="inline-flex h-9 items-center rounded-[10px] border border-a-border px-3 text-[0.8125rem] font-semibold hover:bg-a-surface-2"
          >
            {t('prev')}
          </Link>
          {to < today && (
            <Link
              href={href([addDays(to, 14), today].sort()[0]!)}
              scroll={false}
              className="inline-flex h-9 items-center rounded-[10px] border border-a-border px-3 text-[0.8125rem] font-semibold hover:bg-a-surface-2"
            >
              {t('next')}
            </Link>
          )}
        </div>
      </div>

      {!days.length ? (
        <EmptyState>{t('empty')}</EmptyState>
      ) : (
        days.map((d) => {
          const dayMeals = meals
            .filter((m) => m.eaten_on === d)
            .sort((a, b) => MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot));
          const total = diaryTotals(dayMeals);
          return (
            <Panel
              key={d}
              title={format.dateTime(at(d), {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                ...utc,
              })}
              action={
                <span className="num text-[0.8125rem] text-a-muted">
                  <span className="font-semibold text-a-text">
                    {format.number(total.kcal)} kcal
                  </span>
                  {targetKcal ? ` · ${t('target', { value: format.number(targetKcal) })}` : ''} ·{' '}
                  {tmac('short.protein')}{' '}
                  {format.number(total.protein, { maximumFractionDigits: 0 })} ·{' '}
                  {tmac('short.carb')} {format.number(total.carb, { maximumFractionDigits: 0 })} ·{' '}
                  {tmac('short.fat')} {format.number(total.fat, { maximumFractionDigits: 0 })}
                </span>
              }
            >
              <ul className="divide-y divide-a-border">
                {dayMeals.map((m) => (
                  <li
                    key={m.id}
                    className="grid grid-cols-1 gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
                  >
                    <div>
                      <p className="font-semibold">{tm(m.slot)}</p>
                      {m.time_label && (
                        <p className="num text-[0.75rem] text-a-muted">{m.time_label}</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      {m.items.length ? (
                        <ul className="space-y-1 text-[0.875rem]">
                          {m.items.map((i) => (
                            <li key={i.id} className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0">
                                {i.name}{' '}
                                <span className="num text-[0.75rem] text-a-muted">· {qty(i)}</span>
                              </span>
                              <span className="shrink-0 num text-[0.8125rem] text-a-muted">
                                {i.kcal != null
                                  ? `${format.number(i.kcal, { maximumFractionDigits: 0 })} kcal`
                                  : '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {m.note && (
                        <p className="mt-2 border-s-2 border-a-text/30 ps-3 text-[0.8125rem] text-a-muted">
                          {m.note}
                        </p>
                      )}
                    </div>
                    {m.photo_key && (
                      <button
                        type="button"
                        onClick={() => setPhoto(m)}
                        aria-label={t('openPhoto')}
                        className="size-20 overflow-hidden rounded-[10px] border border-a-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route */}
                        <img
                          src={`/api/admin/diary-photo/${m.id}?v=${m.photo_key}`}
                          alt={t('photo')}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {total.unknown > 0 && (
                <p className="mt-3 text-[0.75rem] text-a-muted">
                  {t('noValues', { count: total.unknown })}
                </p>
              )}
            </Panel>
          );
        })
      )}

      <Sheet
        open={photo !== null}
        onOpenChange={(o) => !o && setPhoto(null)}
        side="center"
        width="lg"
        title={photo ? `${tm(photo.slot)} · ${short(photo.eaten_on)}` : t('photo')}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route
          <img
            src={`/api/admin/diary-photo/${photo.id}?v=${photo.photo_key}`}
            alt={t('photo')}
            className="mx-auto max-h-[70dvh] w-auto rounded-[12px]"
          />
        )}
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Messages with one client
// ---------------------------------------------------------------------------------------------

export function MessagesTab({
  clientId,
  messages,
  onPortal,
  uploads,
}: {
  clientId: string;
  messages: Message[];
  onPortal: boolean;
  uploads: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <Conversation clientId={clientId} messages={messages} onPortal={onPortal} uploads={uploads} />
    </div>
  );
}
