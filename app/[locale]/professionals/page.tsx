import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSiteSettings } from '@/lib/content/public';
import type { Locale } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import { ContactForm } from '@/components/site/contact-form';
import { PageHeader } from '@/components/site/page-header';
import { Placeholder } from '@/components/site/placeholder';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pros' });
  return pageMetadata(locale, '/professionals', t('title'), t('lead'));
}

export default async function ProfessionalsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pros');
  const tc = await getTranslations('common');
  const settings = await getSiteSettings(locale);
  const approach = t.raw('approach') as { title: string; body: string }[];

  return (
    <>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        lead={t('lead')}
        art="walnut"
        locale={locale}
        tone="ink"
      />

      <section className="container-x grid grid-cols-1 gap-14 py-24 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-3">
          <h2 className="label text-ink-60">{t('approachTitle')}</h2>
        </div>
        <dl className="grid grid-cols-1 gap-10 md:grid-cols-3 lg:col-span-9">
          {approach.map((a, i) => (
            <div key={a.title} className="border-t-2 border-ink pt-5">
              <dt>
                <span className="block num-display text-[2.5rem] leading-none text-paprika-deep">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="mt-4 block font-display text-[1.6rem] leading-tight ar:leading-[1.4] ar:font-bold">
                  {a.title}
                </span>
              </dt>
              <dd className="mt-3 text-body text-ink-70">{a.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-ink/15 bg-paper-2 grain py-24">
        <div className="container-x grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <h2 className="label text-ink-60">{t('credentialsTitle')}</h2>
            <div className="mt-4">
              {settings.credentials.items ? (
                <ul className="divide-y divide-ink/15 border-t-2 border-ink">
                  {settings.credentials.items.map((c, i) => (
                    <li key={i} className="py-3">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <Placeholder label={tc('placeholderNotice')}>
                  {t('credentialsPlaceholder')}
                </Placeholder>
              )}
            </div>
          </div>
          <div className="lg:col-span-7 lg:col-start-6" data-hide-fab>
            <h2 className="font-display text-display-md ar:font-bold">{t('formTitle')}</h2>
            <p className="mt-3 max-w-xl text-body text-ink-70">{t('formLead')}</p>
            <div className="mt-8">
              <ContactForm kind="professional" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
