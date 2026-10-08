import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listArticles } from '@/lib/content/public';
import type { Locale } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import { GuidesIndex } from '@/components/site/guides-index';
import { GuidesFilter } from '@/components/site/guides-filter';
import { PageHeader } from '@/components/site/page-header';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guides' });
  return pageMetadata(locale, '/guides', t('title'), t('lead'));
}

export default async function GuidesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('guides');
  const th = await getTranslations('home.guides');
  const articles = await listArticles(locale);
  const categories = [...new Set(articles.map((a) => a.category))];
  return (
    <>
      <PageHeader
        eyebrow={th('eyebrow')}
        title={t('title')}
        lead={t('lead')}
        art="bread"
        locale={locale}
      />
      <section className="container-x pb-32 lg:grid lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-10 lg:col-start-3">
          {categories.length > 1 ? (
            <GuidesFilter articles={articles} categories={categories} />
          ) : (
            <GuidesIndex articles={articles} />
          )}
        </div>
      </section>
    </>
  );
}
