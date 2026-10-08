import { getTranslations } from 'next-intl/server';
import { listAppointments } from '@/lib/admin/clients';
import { clientOptions } from '@/lib/admin/programs';
import { requireUser } from '@/lib/auth';
import { AppointmentsView } from '@/components/admin/appointments/appointments-view';

export async function generateMetadata() {
  const t = await getTranslations('admin.appointments');
  return { title: t('title') };
}

/** Request-time window start; evaluated once per request on the server. */
function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString();
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireUser();
  const { new: openNew } = await searchParams;
  const [appointments, clients] = await Promise.all([
    listAppointments(user.id, { from: daysAgoIso(60) }),
    clientOptions(user.id),
  ]);
  return (
    <AppointmentsView appointments={appointments} clients={clients} openNew={openNew === '1'} />
  );
}
