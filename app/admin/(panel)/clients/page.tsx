import { getTranslations } from 'next-intl/server';
import { listClients } from '@/lib/admin/clients';
import { requireUser } from '@/lib/auth';
import { ClientsView } from '@/components/admin/clients/clients-view';

export async function generateMetadata() {
  const t = await getTranslations('admin.clients');
  return { title: t('title') };
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; archived?: string }>;
}) {
  const user = await requireUser();
  const { new: openNew, archived } = await searchParams;
  const [active, deleted] = await Promise.all([
    listClients(user.id),
    listClients(user.id, { deleted: true }),
  ]);
  return (
    <ClientsView
      clients={active}
      archived={deleted}
      openQuickAdd={openNew === '1'}
      showArchived={archived === '1'}
    />
  );
}
