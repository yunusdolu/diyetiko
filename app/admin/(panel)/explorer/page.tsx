import { getTranslations } from 'next-intl/server';
import { audit } from '@/lib/admin/clients';
import { requireUser } from '@/lib/auth';
import { asUser } from '@/lib/db';
import { ClientExplorer, type ExplorerClient } from '@/components/admin/clients/explorer';

export async function generateMetadata() {
  const t = await getTranslations('admin.explorer');
  return { title: t('title') };
}

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requireUser();
  const { id } = await searchParams;
  const clients = await asUser(user.id, async (tx) => {
    const rows = await tx.query<ExplorerClient>(
      `select c.id, c.full_name, c.goal, c.goal_weight_kg, c.status::text as status, c.preferred_language::text as preferred_language, c.allergies,
              coalesce((select json_agg(json_build_object('d', m.measured_at, 'w', m.weight_kg) order by m.measured_at)
                          from measurements m where m.client_id = c.id and m.weight_kg is not null), '[]'::json) as weights,
              (select json_build_object('d', m.measured_at, 'w', m.weight_kg, 'f', m.body_fat_pct, 'waist', m.waist_cm)
                 from measurements m where m.client_id = c.id order by m.measured_at desc limit 1) as latest,
              (select json_build_object('id', p.id, 'title', p.title) from programs p where p.client_id = c.id and p.status = 'active' order by p.updated_at desc limit 1) as program,
              (select min(a.starts_at) from appointments a where a.client_id = c.id and a.starts_at > now() and a.status = 'scheduled') as next_appointment,
              (select n.body from client_notes n where n.client_id = c.id and n.pinned order by n.created_at desc limit 1) as pinned_note
         from clients c
        where c.deleted_at is null and c.status in ('active', 'paused')
        order by c.full_name`,
    );
    // Browsing the explorer shows health data for every client in the list → one audit entry.
    await audit(tx, user.id, 'client.explore', 'client', null, { count: rows.length });
    return rows;
  });
  const start = Math.max(
    0,
    clients.findIndex((c) => c.id === id),
  );
  return <ClientExplorer clients={clients} startIndex={start} />;
}
