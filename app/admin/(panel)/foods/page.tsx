import { getTranslations } from 'next-intl/server';
import { listFoodsAdmin } from '@/lib/admin/cms';
import { requireUser } from '@/lib/auth';
import { FoodsView } from '@/components/admin/cms/foods-view';

export async function generateMetadata() {
  const t = await getTranslations('admin.foods');
  return { title: t('title') };
}

export default async function FoodsPage() {
  const user = await requireUser();
  const foods = await listFoodsAdmin(user.id);
  return <FoodsView foods={foods} />;
}
