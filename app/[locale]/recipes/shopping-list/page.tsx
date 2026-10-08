import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listRecipes, recipeIngredientMap } from '@/lib/content/public';
import type { Locale } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/site/page-header';
import { ShoppingList } from '@/components/site/recipes/shopping-list';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'recipes.list' });
  return {
    ...(await pageMetadata(locale, '/recipes/shopping-list', t('title'), t('lead'))),
    robots: { index: false },
  };
}

export default async function ShoppingListPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('recipes.list');
  const tr = await getTranslations('home.recipes');
  const [recipes, ingredients] = await Promise.all([
    listRecipes(locale),
    recipeIngredientMap(locale),
  ]);
  return (
    <>
      <PageHeader
        eyebrow={tr('eyebrow')}
        title={t('title')}
        lead={t('lead')}
        art="bread"
        locale={locale}
      />
      <section className="container-x pb-32">
        <ShoppingList
          recipes={recipes.map((r) => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            servings: r.servings,
          }))}
          ingredients={ingredients}
        />
      </section>
    </>
  );
}
