import { getTranslations } from 'next-intl/server';
import { listLeads } from '@/lib/admin/clients';
import { requireUser } from '@/lib/auth';
import { LeadsView } from '@/components/admin/leads-view';

export async function generateMetadata() {
  const t = await getTranslations('admin.leads');
  return { title: t('title') };
}

export default async function LeadsPage() {
  const user = await requireUser();
  const leads = await listLeads(user.id);
  return <LeadsView leads={leads} />;
}
