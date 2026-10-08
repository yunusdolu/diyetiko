import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth';
import { ClientForm } from '@/components/admin/clients/client-form';
import { PageTitle } from '@/components/admin/ui';

export default async function NewClientPage() {
  await requireUser();
  const t = await getTranslations('admin.clients');
  return (
    <div>
      <PageTitle title={t('new')} eyebrow={t('title')} />
      <ClientForm />
    </div>
  );
}
