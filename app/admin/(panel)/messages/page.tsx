import { getTranslations } from 'next-intl/server';
import { listClients } from '@/lib/admin/clients';
import { inbox, listMessages, listSharedFiles } from '@/lib/admin/portal';
import { requireUser } from '@/lib/auth';
import { schemaFeatures } from '@/lib/db/features';
import { MessagesView } from '@/components/admin/messages/messages-view';

export async function generateMetadata() {
  const t = await getTranslations('admin.portal.messages');
  return { title: t('inbox') };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every client conversation, and the chosen one (`?c=<client id>`) beside the list. */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await requireUser();
  const { c } = await searchParams;
  const [threads, clients, features] = await Promise.all([
    inbox(user.id),
    listClients(user.id),
    schemaFeatures(user.id),
  ]);
  // only a client of this practice opens (RLS would return nothing for anyone else anyway)
  const chosen = c && UUID.test(c) ? clients.find((x) => x.id === c) : undefined;
  const active = chosen
    ? await Promise.all([
        listMessages(user.id, chosen.id),
        listSharedFiles(user.id, chosen.id),
      ]).then(([messages, shared]) => ({ clientId: chosen.id, messages, shared }))
    : null;

  return (
    <MessagesView
      threads={threads}
      clients={clients.map((x) => ({
        id: x.id,
        full_name: x.full_name,
        on_portal: x.on_portal,
        last_weight: x.last_weight,
        next_appointment: x.next_appointment,
      }))}
      active={active}
      uploads={features.uploads}
    />
  );
}
