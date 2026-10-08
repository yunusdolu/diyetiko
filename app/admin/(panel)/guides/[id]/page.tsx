import { notFound } from 'next/navigation';
import { getArticleAdmin } from '@/lib/admin/cms';
import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { GuideEditor } from '@/components/admin/cms/guide-editor';

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const isNew = id === 'new';
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const article = isNew ? null : await getArticleAdmin(user.id, id);
  if (!isNew && !article) notFound();
  return (
    <GuideEditor key={id} article={article} canDraftTranslate={Boolean(env.anthropicApiKey)} />
  );
}
