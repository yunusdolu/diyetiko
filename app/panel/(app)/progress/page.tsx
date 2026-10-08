import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import {
  addDays,
  checkinStreak,
  todayISO,
  weightSummary,
  type WeightPoint,
} from '@/lib/portal/logic';
import { goalJourney, milestones } from '@/lib/portal/insights';
import { Achievements, GoalJourney } from '@/components/portal/progress/insights';
import { PortalCard } from '@/components/portal/card';
import { HabitGrid } from '@/components/portal/progress/habit-grid';
import { WaterBars } from '@/components/portal/progress/water-bars';
import { WeightChart } from '@/components/portal/progress/weight-chart';
import { PortalHeader, PortalPage } from '@/components/portal/shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.progress');
  return { title: t('title') };
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="p-card p-4 sm:p-5">
      <p className="label text-ink-60">{label}</p>
      <p className="mt-2 num text-[clamp(1.35rem,4.5vw,1.75rem)] leading-none font-semibold tracking-[-0.02em] whitespace-nowrap">
        {value}
      </p>
      {hint && <p className="mt-2 text-[0.75rem] text-ink-60">{hint}</p>}
    </div>
  );
}

export default async function ProgressPage() {
  const { user } = await requireClient();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const t = await getTranslations('portal.progress');
  const tu = await getTranslations('units');
  const today = todayISO();
  const [checkins, measurements, habits, profile] = await Promise.all([
    portal.getCheckins(user.id, addDays(today, -89), today),
    portal.getMeasurements(user.id),
    portal.getHabits(user.id),
    portal.getProfile(user.id),
  ]);

  const il = intlLocale(locale);
  const kg = new Intl.NumberFormat(il, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signed = new Intl.NumberFormat(il, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  const nf1 = new Intl.NumberFormat(il, { maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(il, { style: 'percent', maximumFractionDigits: 1 });
  const short = new Intl.DateTimeFormat(il, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const long = new Intl.DateTimeFormat(il, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

  // all weights (clinic history can be older than 90 days — it counts for "since start")
  const allPoints: WeightPoint[] = [
    ...checkins
      .filter((c) => c.weight_kg != null)
      .map((c) => ({ day: c.day, kg: c.weight_kg!, source: 'self' as const })),
    ...measurements
      .filter((m) => m.weightKg != null)
      .map((m) => ({ day: m.date, kg: m.weightKg!, source: 'clinic' as const })),
  ];
  const summary = weightSummary(allPoints);
  const chartFrom = addDays(today, -89);
  const chartPoints = allPoints.filter((p) => p.day >= chartFrom && p.day <= today);
  const goal = profile?.goalWeightKg ?? null;
  const streak = checkinStreak(checkins, today);
  const measured = [...measurements].reverse();
  const ti = await getTranslations('portal.insights');
  const journey = goalJourney(
    allPoints.map((p) => ({ day: p.day, kg: p.kg })),
    goal,
    today,
  );
  const badges = milestones({ checkins, journey, today });

  return (
    <PortalPage wide>
      <PortalHeader help="progress" eyebrow={t('title')} title={t('title')} lead={t('lead')} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label={t('current')}
          value={summary ? `${kg.format(summary.latest.kg)} ${tu('kg')}` : '—'}
          hint={
            summary
              ? `${short.format(at(summary.latest.day))} · ${summary.latest.source === 'clinic' ? t('clinic') : t('selfReported')}`
              : undefined
          }
        />
        <Stat
          label={t('change')}
          value={
            summary && summary.first.day !== summary.latest.day
              ? `${signed.format(summary.change)} ${tu('kg')}`
              : '—'
          }
          hint={summary ? t('first', { date: short.format(at(summary.first.day)) }) : undefined}
        />
        <Stat
          label={t('goal')}
          value={goal != null ? `${kg.format(goal)} ${tu('kg')}` : t('noGoal')}
        />
        <Stat label={t('streak')} value={t('streakValue', { count: streak })} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-12">
        {journey && (
          <PortalCard title={ti('journeyTitle')} className="xl:col-span-5">
            <GoalJourney journey={journey} />
          </PortalCard>
        )}
        <PortalCard
          title={ti('achievementsTitle')}
          className={journey ? 'xl:col-span-7' : 'xl:col-span-12'}
        >
          <Achievements badges={badges} />
        </PortalCard>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6">
        <PortalCard title={t('weight')}>
          {chartPoints.length ? (
            <WeightChart points={chartPoints} goal={goal} to={today} />
          ) : (
            <p className="rounded-[14px] border-[1.5px] border-dashed border-ink/20 px-4 py-10 text-center text-ink-60">
              {t('noWeight')}
            </p>
          )}
        </PortalCard>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <PortalCard title={t('habits')}>
            <HabitGrid habits={habits} checkins={checkins} to={today} />
          </PortalCard>
          <PortalCard title={t('water')}>
            <WaterBars checkins={checkins} to={today} />
          </PortalCard>
        </div>

        <PortalCard title={t('measurements')}>
          {measured.length ? (
            <>
              {/* phones: one compact row per visit */}
              <ul className="divide-y divide-ink/10 sm:hidden">
                {measured.map((m) => (
                  <li key={m.date} className="py-3 first:pt-0">
                    <p className="text-[0.875rem] font-semibold">{long.format(at(m.date))}</p>
                    <dl className="mt-2 grid grid-cols-4 gap-2">
                      {(
                        [
                          [
                            'weight',
                            m.weightKg != null ? `${kg.format(m.weightKg)} ${tu('kg')}` : '—',
                          ],
                          ['bodyFat', m.bodyFatPct != null ? pct.format(m.bodyFatPct / 100) : '—'],
                          [
                            'waist',
                            m.waistCm != null ? `${nf1.format(m.waistCm)} ${tu('cm')}` : '—',
                          ],
                          ['hip', m.hipCm != null ? `${nf1.format(m.hipCm)} ${tu('cm')}` : '—'],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-[0.6875rem] text-ink-60">{t(`table.${k}`)}</dt>
                          <dd className="mt-0.5 num text-[0.8125rem] whitespace-nowrap">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
                <table className="w-full text-[0.9375rem] [&_td]:whitespace-nowrap">
                  <thead>
                    <tr className="border-b-[2px] border-ink text-[0.8125rem] text-ink-60">
                      <th scope="col" className="py-2 pe-3 text-start font-semibold">
                        {t('table.date')}
                      </th>
                      <th scope="col" className="px-3 py-2 text-end font-semibold">
                        {t('table.weight')}
                      </th>
                      <th scope="col" className="px-3 py-2 text-end font-semibold">
                        {t('table.bodyFat')}
                      </th>
                      <th scope="col" className="px-3 py-2 text-end font-semibold">
                        {t('table.waist')}
                      </th>
                      <th scope="col" className="py-2 ps-3 text-end font-semibold">
                        {t('table.hip')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {measured.map((m) => (
                      <tr key={m.date} className="border-b border-ink/10">
                        <th scope="row" className="py-3 pe-3 text-start font-normal">
                          {long.format(at(m.date))}
                        </th>
                        <td className="px-3 py-3 text-end num">
                          {m.weightKg != null ? `${kg.format(m.weightKg)} ${tu('kg')}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-end num">
                          {m.bodyFatPct != null ? pct.format(m.bodyFatPct / 100) : '—'}
                        </td>
                        <td className="px-3 py-3 text-end num">
                          {m.waistCm != null ? `${nf1.format(m.waistCm)} ${tu('cm')}` : '—'}
                        </td>
                        <td className="py-3 ps-3 text-end num">
                          {m.hipCm != null ? `${nf1.format(m.hipCm)} ${tu('cm')}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-ink-60">{t('noMeasurements')}</p>
          )}
        </PortalCard>
      </div>
    </PortalPage>
  );
}
