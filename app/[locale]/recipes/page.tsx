import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listFridgeFoods, listRecipes } from '@/lib/content/public';
import type { Locale } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/site/page-header';
import { RecipeExplorer } from '@/components/site/recipes/explorer';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'recipes' });
  return pageMetadata(locale, '/recipes', t('title'), t('lead'));
}

export default async function RecipesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('recipes');
  const tn = await getTranslations('home.recipes');
  const [recipes, foods] = await Promise.all([listRecipes(locale), listFridgeFoods(locale)]);
  const used = new Set(recipes.flatMap((r) => r.ingredientKeys));
  return (
    <>
      <PageHeader
        eyebrow={tn('eyebrow')}
        title={t('title')}
        lead={t('lead')}
        art="tomato"
        locale={locale}
      />
      <section className="pb-32">
        <RecipeExplorer recipes={recipes} foods={foods.filter((f) => used.has(f.key))} />
      </section>
    </>
  );
}
