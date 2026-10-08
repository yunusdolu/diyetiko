import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import { schemaFeatures } from '@/lib/db/features';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import {
  PORTAL_TZ,
  addDays,
  checkinStreak,
  dayScore,
  diaryTotals,
  programDayIndex,
  todayISO,
  weekDigest,
} from '@/lib/portal/logic';
import { PortalCard as Card } from '@/components/portal/card';
import { CheckinCard } from '@/components/portal/checkin-card';
import { DayTotals } from '@/components/portal/day-totals';
import { ChevronIcon } from '@/components/portal/icons';
import { PlanToday } from '@/components/portal/plan-today';
import { PortalPage } from '@/components/portal/shell';
import { TasksCard, ToolsCard, WelcomeCard } from '@/components/portal/today/extras';
import { TodayHero } from '@/components/portal/today/hero';
import { DietitianCard, WeekStrip } from '@/components/portal/today/hub';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.nav');
  return { title: t('today') };
}

function MoreLink({
  href,
  children,
  dark,
}: {
  href: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-semibold underline-offset-4 hover:underline ${dark ? 'text-citrus' : ''}`}
    >
      {children}
      <ChevronIcon size={14} />
    </Link>
  );
}

export default async function TodayPage() {
  const { user, status } = await requireClient();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const t = await getTranslations('portal');
  const now = new Date();
  const today = todayISO(now);
  const [program, habits, checkins, diary, appointments, messages, features, profile, tasks] =
    await Promise.all([
      portal.getProgram(user.id),
      portal.getHabits(user.id),
      portal.getCheckins(user.id, addDays(today, -60), today),
      portal.getDiary(user.id, today, today),
      portal.getAppointments(user.id),
      portal.getMessages(user.id, 30),
      schemaFeatures(user.id),
      portal.getProfile(user.id),
      portal.getTasks(user.id),
    ]);

  const il = intlLocale(locale);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: PORTAL_TZ,
    }).format(now),
  );
  const greeting = t(
    hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.day' : 'greeting.evening',
    { name: status.firstName },
  );
  const dateLabel = new Intl.DateTimeFormat(il, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: PORTAL_TZ,
  }).format(now);

  const streak = checkinStreak(checkins, today);
  const idx = program ? programDayIndex(program, today) : -1;
  const plannedDay = program && idx >= 0 ? program.days[idx] : null;
  const totals = diaryTotals(diary);
  const loggedSlots = diary.filter((m) => m.items.length).map((m) => m.slot);
  const next = appointments
    .filter((a) => a.status === 'scheduled' && new Date(a.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const lastFromDietitian = [...messages].reverse().find((m) => m.author === 'dietitian');
  const unread = messages.filter((m) => m.author === 'dietitian' && !m.read_at).length;

  const todayCheckin = checkins.find((c) => c.day === today) ?? null;
  const weighed = checkins
    .filter((c) => c.weight_kg != null && c.day < today)
    .sort((a, b) => b.day.localeCompare(a.day))[0];
  const plannedMeals = plannedDay ? plannedDay.meals.filter((m) => m.items.length).length : 0;
  const { parts, score } = dayScore({
    checkin: todayCheckin,
    habitCount: habits.length,
    activity: features.activity,
    plannedMeals,
    loggedMeals: loggedSlots.length,
  });
  const week = Array.from({ length: 7 }, (_, k) => {
    const day = addDays(today, k - 6);
    return { day, checkin: checkins.find((c) => c.day === day) ?? null };
  });

  return (
    <PortalPage wide>
      <TodayHero
        eyebrow={dateLabel}
        greeting={greeting}
        streak={streak}
        unread={unread}
        openTasks={tasks.length ? tasks.filter((x) => !x.doneAt).length : null}
        score={score}
        parts={parts}
      />

      {/* the first days: what this place is for */}
      {checkins.length < 3 && (
        <WelcomeCard name={status.firstName} dietitian={profile?.dietitianName ?? null} />
      )}

      {/* Three sizes on one grid, as in the dietitian panel: large (two thirds), medium (half),
          small (a third). Tablets: two columns, large ones across both. Phones: one column. */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-flow-dense md:grid-cols-2 xl:grid-cols-12">
        <Slot size="lg" id="checkin">
          <CheckinCard
            day={today}
            initial={todayCheckin}
            habits={habits}
            activity={features.activity}
            lastWeight={weighed ? { kg: Number(weighed.weight_kg), day: weighed.day } : null}
          />
        </Slot>

        {/* beside the day's record: the dietitian, and under them what was eaten today */}
        <Slot size="sm" id="dietitian">
          <div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] gap-4">
            <DietitianCard
              name={profile?.dietitianName ?? null}
              last={
                lastFromDietitian
                  ? {
                      body: lastFromDietitian.body,
                      at: lastFromDietitian.created_at,
                      hasFile: Boolean(lastFromDietitian.file_name),
                    }
                  : null
              }
              unread={unread}
              next={next ?? null}
              uploads={features.uploads}
              digest={weekDigest(checkins, today)}
            />
            <Card
              className="h-full"
              title={t('today.totals')}
              action={<MoreLink href="/panel/diary">{t('today.openDiary')}</MoreLink>}
            >
              <DayTotals totals={totals} targets={program?.targets ?? null} compact />
            </Card>
          </div>
        </Slot>

        <Slot size="lg" id="plan">
          <Card
            className="h-full"
            title={
              plannedDay
                ? `${t('today.planTitle')} · ${plannedDay.label ?? t('today.planDay', { n: idx + 1 })}`
                : t('today.planTitle')
            }
            action={
              program ? (
                <MoreLink href="/panel/program">{t('today.openProgram')}</MoreLink>
              ) : undefined
            }
          >
            {plannedDay && plannedDay.meals.some((m) => m.items.length) ? (
              <PlanToday day={today} meals={plannedDay.meals} loggedSlots={loggedSlots} />
            ) : (
              <p className="text-[0.9375rem] text-ink-60">{t('today.planEmpty')}</p>
            )}
          </Card>
        </Slot>

        <Slot size="sm">
          <Card
            className="h-full"
            title={t('hub.weekTitle')}
            action={<MoreLink href="/panel/week">{t('hub.openWeek')}</MoreLink>}
          >
            <WeekStrip days={week} today={today} activity={features.activity} />
          </Card>
        </Slot>

        <Slot size="lg">
          <ToolsCard />
        </Slot>

        {tasks.length > 0 && (
          <Slot size="sm">
            <TasksCard tasks={tasks} today={today} />
          </Slot>
        )}

        {program?.notes && (
          <Slot size="sm">
            <Card className="h-full" title={t('hub.noteTitle')}>
              <p
                dir="auto"
                className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-70"
              >
                {program.notes}
              </p>
            </Card>
          </Slot>
        )}
      </div>
    </PortalPage>
  );
}

/** A place on the Today grid: large = two thirds, medium = half, small = a third (from 1280 px). */
function Slot({
  size,
  id,
  children,
}: {
  size: 'lg' | 'md' | 'sm';
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={`min-w-0 scroll-mt-24 ${
        size === 'lg'
          ? 'md:col-span-2 xl:col-span-8'
          : size === 'md'
            ? 'xl:col-span-6'
            : 'xl:col-span-4'
      }`}
    >
      {children}
    </div>
  );
}
