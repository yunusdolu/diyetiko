import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getRecipeAdmin } from '@/lib/admin/cms';
import { foodOptions } from '@/lib/admin/programs';
import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';
import type { Locale } from '@/lib/i18n/config';
import { RecipeEditor } from '@/components/admin/cms/recipe-editor';

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const locale = (await getLocale()) as Locale;
  const isNew = id === 'new';
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [recipe, foods] = await Promise.all([
    isNew ? Promise.resolve(null) : getRecipeAdmin(user.id, id),
    foodOptions(user.id, locale),
  ]);
  if (!isNew && !recipe) notFound();
  return (
    <RecipeEditor
      key={id}
      recipe={recipe}
      foods={foods}
      canDraftTranslate={Boolean(env.anthropicApiKey)}
    />
  );
}
