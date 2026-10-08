import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import { schemaFeatures } from '@/lib/db/features';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import { addDays, planAdherence, todayISO, weekDigest } from '@/lib/portal/logic';
import { PortalCard as Card } from '@/components/portal/card';
import { PortalHeader, PortalPage } from '@/components/portal/shell';
import { WeekStrip } from '@/components/portal/today/hub';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.week');
  return { title: t('title') };
}

/**
 * The last seven days in one place (DESIGN.md v1.35): how many days were recorded, water, movement,
 * weight, how closely the diary followed the plan — then the days one by one. Everything here is
 * the client's own record; nothing is computed that they did not enter.
 */
export default async function WeekPage() {
  const { user } = await requireClient();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const il = intlLocale(locale);
  const t = await getTranslations('portal.week');
  const format = await getFormatter();
  const today = todayISO();
  const from = addDays(today, -6);
  const [checkins, habits, program, diary, features] = await Promise.all([
    portal.getCheckins(user.id, from, today),
    portal.getHabits(user.id),
    portal.getProgram(user.id),
    portal.getDiary(user.id, from, today),
    schemaFeatures(user.id),
  ]);
  const digest = weekDigest(checkins, today);
  const adherence = program
    ? planAdherence({ startsOn: program.startsOn, days: program.days }, diary, today)
    : null;
  const days = Array.from({ length: 7 }, (_, k) => {
    const day = addDays(from, k);
    return { day, checkin: checkins.find((c) => c.day === day) ?? null };
  });
  const nf1 = new Intl.NumberFormat(il, { maximumFractionDigits: 1 });
  const dayFmt = new Intl.DateTimeFormat(il, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const habitDone = checkins.reduce(
    (a, c) => a + c.habits.filter((h) => habits.some((x) => x.id === h)).length,
    0,
  );
  const weightChange =
    digest.weightFrom != null && digest.weightTo != null
      ? Math.round((digest.weightTo - digest.weightFrom) * 10) / 10
      : null;

  const stats = [
    { key: 'days', value: `${digest.days}/7`, hint: t('daysHint') },
    {
      key: 'water',
      value: digest.waterAvg != null ? `${nf1.format(digest.waterAvg / 1000)} L` : '—',
      hint: t('waterHint'),
    },
    ...(features.activity
      ? [
          {
            key: 'activity',
            value: t('minutes', { n: digest.activityMin }),
            hint: t('activityHint', { days: digest.activeDays }),
          },
        ]
      : []),
    {
      key: 'weight',
      value:
        weightChange == null
          ? '—'
          : `${weightChange > 0 ? '+' : weightChange < 0 ? '−' : ''}${nf1.format(Math.abs(weightChange))} kg`,
      hint:
        digest.weightTo != null ? t('weightHint', { kg: nf1.format(digest.weightTo) }) : t('none'),
    },
    {
      key: 'plan',
      value:
        adherence && adherence.planned
          ? format.number(adherence.logged / adherence.planned, {
              style: 'percent',
              maximumFractionDigits: 0,
            })
          : '—',
      hint:
        adherence && adherence.planned
          ? t('planHint', { logged: adherence.logged, planned: adherence.planned })
          : t('noPlan'),
    },
    ...(habits.length
      ? [
          {
            key: 'habits',
            value: `${habitDone}/${habits.length * 7}`,
            hint: t('habitsHint'),
          },
        ]
      : []),
  ] as const;

  return (
    <PortalPage wide>
      <PortalHeader help="week" eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />

      <dl className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.key} className="p-card px-4 py-3.5">
            <dt className="label text-[0.625rem] text-ink-60">{t(`stats.${s.key as 'days'}`)}</dt>
            <dd className="mt-1.5 num text-[1.5rem] leading-none font-semibold tracking-[-0.02em]">
              {s.value}
            </dd>
            <dd className="mt-1.5 text-[0.75rem] leading-snug text-ink-60">{s.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-4">
          <Card className="h-full" title={t('strip')}>
            <WeekStrip days={days} today={today} activity={features.activity} />
          </Card>
        </div>
        <div className="min-w-0 xl:col-span-8">
          <Card
            className="h-full"
            title={t('daily')}
            action={
              <Link
                href="/panel/messages"
                className="text-[0.8125rem] font-semibold underline-offset-4 hover:underline"
              >
                {t('tell')}
              </Link>
            }
          >
            <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
              <table className="w-full min-w-[30rem] text-[0.875rem]">
                <thead>
                  <tr className="text-start text-[0.6875rem] tracking-wider text-ink-60 uppercase">
                    <th scope="col" className="pb-2 text-start font-semibold">
                      {t('cols.day')}
                    </th>
                    <th scope="col" className="pb-2 text-end font-semibold">
                      {t('cols.water')}
                    </th>
                    <th scope="col" className="pb-2 text-end font-semibold">
                      {t('cols.energy')}
                    </th>
                    {features.activity && (
                      <th scope="col" className="pb-2 text-end font-semibold">
                        {t('cols.activity')}
                      </th>
                    )}
                    <th scope="col" className="pb-2 text-end font-semibold">
                      {t('cols.meals')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10 border-t border-ink/10">
                  {[...days].reverse().map(({ day, checkin }) => {
                    const meals = diary.filter((m) => m.eaten_on === day && m.items.length).length;
                    return (
                      <tr key={day}>
                        <th scope="row" className="py-2.5 text-start font-semibold">
                          <Link
                            href={`/panel/diary?day=${day}`}
                            className="underline-offset-4 first-letter:uppercase hover:underline"
                          >
                            {dayFmt.format(new Date(`${day}T12:00:00Z`))}
                          </Link>
                        </th>
                        <td className="py-2.5 text-end num">
                          {checkin?.water_ml ? `${nf1.format(checkin.water_ml / 1000)} L` : '—'}
                        </td>
                        <td className="py-2.5 text-end num">
                          {checkin?.energy != null ? `${checkin.energy}/5` : '—'}
                        </td>
                        {features.activity && (
                          <td className="py-2.5 text-end num">
                            {checkin?.activity_min
                              ? t('minutes', { n: checkin.activity_min })
                              : '—'}
                          </td>
                        )}
                        <td className="py-2.5 text-end num">{meals || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </PortalPage>
  );
}
