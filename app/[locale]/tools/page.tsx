import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listRecipes } from '@/lib/content/public';
import type { Locale } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import { ToolsIndex } from '@/components/site/home/tools-index';
import { PageHeader } from '@/components/site/page-header';
import { Calculator } from '@/components/site/tools/calculator';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools' });
  return pageMetadata(locale, '/tools', t('title'), t('lead'));
}

export default async function ToolsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tools');
  const th = await getTranslations('home.tools');
  const recipes = await listRecipes(locale);
  return (
    <>
      <PageHeader
        eyebrow={th('eyebrow')}
        title={t('title')}
        lead={t('lead')}
        art="lemon"
        locale={locale}
      />
      <section aria-labelledby="calc-title" className="border-t-2 border-ink">
        <div className="container-x pt-12">
          <h2 id="calc-title" className="font-display text-display-md ar:font-bold">
            {t('calc.title')}
          </h2>
          <p className="mt-3 max-w-2xl text-body text-ink-70">{t('calc.lead')}</p>
        </div>
        <div className="container-x mt-6">
          <Calculator />
        </div>
      </section>
      <section className="on-dark mt-24 bg-green grain-light py-24 text-paper">
        <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-5">
            <h2 className="font-display text-display-lg ar:leading-[1.25] ar:font-bold">
              {th('title')}
            </h2>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <ToolsIndex recipeCount={recipes.length} />
          </div>
        </div>
      </section>
    </>
  );
}
