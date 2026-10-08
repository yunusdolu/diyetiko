import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { ViewTransition, type ReactNode } from 'react';
import { requireClient } from '@/lib/auth';
import { schemaFeatures } from '@/lib/db/features';
import {
  getAppointments,
  getCheckins,
  getDiary,
  getHabits,
  getProgram,
  unreadCount,
} from '@/lib/portal/data';
import { addDays, checkinStreak, dayScore, programDayIndex, todayISO } from '@/lib/portal/logic';
import { ViewTransitionGuard } from '@/components/motion/view-transition-guard';
import { PortalShell } from '@/components/portal/shell';

/** Everything behind this layout requires a signed-in, linked, consenting client. */
export default async function PortalAppLayout({ children }: { children: ReactNode }) {
  const { user, status } = await requireClient();
  const today = todayISO();
  const [tm, unread, jar, checkins, habits, appointments, features, program, diary] =
    await Promise.all([
      getTranslations('meta'),
      unreadCount(user.id),
      cookies(),
      getCheckins(user.id, addDays(today, -40), today),
      getHabits(user.id),
      getAppointments(user.id),
      schemaFeatures(user.id),
      getProgram(user.id),
      getDiary(user.id, today, today),
    ]);
  // the rail's glance at today: the same ring as the Today page (check-in + planned meals logged)
  const idx = program ? programDayIndex(program, today) : -1;
  const planned = program && idx >= 0 ? program.days[idx] : null;
  const nowIso = new Date().toISOString();
  const pulse = {
    score: dayScore({
      checkin: checkins.find((c) => c.day === today) ?? null,
      habitCount: habits.length,
      activity: features.activity,
      plannedMeals: planned ? planned.meals.filter((m) => m.items.length).length : 0,
      loggedMeals: diary.filter((m) => m.items.length).length,
    }).score,
    streak: checkinStreak(checkins, today),
    next:
      appointments
        .filter((a) => a.status === 'scheduled' && a.startsAt > nowIso)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]?.startsAt ?? null,
  };
  // written by PortalShell (a client module: its constants cannot be read here)
  const sidebar = jar.get('portal_sidebar')?.value === 'collapsed' ? 'collapsed' : 'expanded';
  return (
    <PortalShell
      brand={tm('shortName')}
      firstName={status.firstName}
      unread={unread}
      sidebar={sidebar}
      pulse={pulse}
    >
      <ViewTransitionGuard />
      {/* Starts the page transition; the animation is on the root snapshot (globals.css). */}
      <ViewTransition name="portal-content" default="auto">
        <div data-vt-fold>{children}</div>
      </ViewTransition>
    </PortalShell>
  );
}
