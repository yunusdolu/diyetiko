import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  getClient,
  listAppointments,
  listFiles,
  listMeasurements,
  listNotes,
} from '@/lib/admin/clients';
import { clientWeights, listTasks } from '@/lib/admin/insights';
import * as portal from '@/lib/admin/portal';
import { reminderTemplates } from '@/lib/admin/reminders';
import { listPrograms, getProgramTree } from '@/lib/admin/programs';
import { clientBilling, listLabs } from '@/lib/admin/practice';
import { requireUser } from '@/lib/auth';
import { schemaFeatures } from '@/lib/db/features';
import { accountsConfigured } from '@/lib/auth/accounts';
import { addDays, clampDay, todayISO, planAdherence } from '@/lib/portal/logic';
import { ClientProfile } from '@/components/admin/clients/client-profile';

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; dto?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { tab, dto } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const today = todayISO();
  // diary: 14 days ending at ?dto= (never in the future)
  const diaryTo = clampDay(dto, today);
  const diaryFrom = addDays(diaryTo, -13);
  // everything at once (each its own transaction): the record itself is checked right after
  const [
    client,
    measurements,
    notes,
    files,
    appointments,
    programs,
    access,
    habits,
    checkins,
    meals,
    messages,
    targetKcal,
    weights,
    tasks,
    templates,
    billing,
    labs,
    shared,
    features,
  ] = await Promise.all([
    getClient(user.id, id),
    listMeasurements(user.id, id),
    listNotes(user.id, id),
    listFiles(user.id, id),
    listAppointments(user.id, { clientId: id }),
    listPrograms(user.id, { clientId: id }),
    portal.getPortalAccess(user.id, id),
    portal.listHabits(user.id, id),
    portal.listCheckins(user.id, id, addDays(today, -89), today),
    portal.listDiary(user.id, id, diaryFrom, diaryTo),
    portal.listMessages(user.id, id),
    portal.activeTargetKcal(user.id, id),
    clientWeights(user.id, id),
    listTasks(user.id, { clientId: id }),
    reminderTemplates(),
    clientBilling(user.id, id, today),
    listLabs(user.id, id),
    portal.listSharedFiles(user.id, id),
    schemaFeatures(user.id),
  ]);
  if (!client) notFound();
  // how closely the diary followed the active programme over the last seven days
  const active = programs.find((p) => p.status === 'active' && !p.is_template);
  const [tree, week] = active
    ? await Promise.all([
        getProgramTree(user.id, active.id),
        portal.listDiary(user.id, id, addDays(today, -6), today),
      ])
    : [null, []];
  const adherence = tree
    ? planAdherence({ startsOn: tree.starts_on, days: tree.days }, week, today)
    : null;
  // invite / reset messages go out in the CLIENT's language
  const ti = await getTranslations({
    locale: client.preferred_language,
    namespace: 'portal.inviteText',
  });

  return (
    <ClientProfile
      client={client}
      measurements={measurements}
      notes={notes}
      files={files}
      appointments={appointments}
      programs={programs}
      initialTab={tab}
      weights={weights}
      tasks={tasks}
      templates={templates}
      billing={billing}
      labs={labs}
      shared={shared}
      uploads={features.uploads}
      portal={{
        access: access!,
        ready: accountsConfigured(),
        inviteText: { invite: ti.raw('invite') as string, reset: ti.raw('reset') as string },
        habits,
        checkins,
        diary: { meals, from: diaryFrom, to: diaryTo },
        adherence,
        messages,
        targetKcal,
        today,
      }}
    />
  );
}
