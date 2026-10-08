import { getTranslations } from 'next-intl/server';
import { listRecipesAdmin } from '@/lib/admin/cms';
import { requireUser } from '@/lib/auth';
import { CmsList } from '@/components/admin/cms/cms-list';

export default async function AdminRecipesPage() {
  const user = await requireUser();
  const t = await getTranslations('admin.cms');
  const items = await listRecipesAdmin(user.id);
  return (
    <CmsList
      items={items}
      title={t('recipesTitle')}
      newHref="/admin/recipes/new"
      newLabel={t('newRecipe')}
      baseHref="/admin/recipes"
    />
  );
}
