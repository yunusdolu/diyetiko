import { getTranslations } from 'next-intl/server';
import { listArticlesAdmin } from '@/lib/admin/cms';
import { requireUser } from '@/lib/auth';
import { CmsList } from '@/components/admin/cms/cms-list';

export default async function AdminGuidesPage() {
  const user = await requireUser();
  const t = await getTranslations('admin.cms');
  const items = await listArticlesAdmin(user.id);
  return (
    <CmsList
      items={items}
      title={t('guidesTitle')}
      newHref="/admin/guides/new"
      newLabel={t('newGuide')}
      baseHref="/admin/guides"
    />
  );
}
