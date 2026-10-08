import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSiteSettings } from '@/lib/content/public';
import type { Locale } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import { ApplyForm } from '@/components/site/apply/apply-form';
import { PageHeader } from '@/components/site/page-header';
import { Faq } from '@/components/site/home/faq';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'apply' });
  return pageMetadata(locale, '/apply', t('title'), t('lead'));
}

/** Programme application: the conditions up front, then the four-step form. */
export default async function ApplyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('apply');
  const { contact } = await getSiteSettings(locale);
  const how = ['send', 'review', 'meet'] as const;
  const howList = (
    <>
      <h2 className="label text-ink-60">{t('how.title')}</h2>
      <ol className="mt-5 grid gap-5 border-t-2 border-ink pt-5">
        {how.map((k, i) => (
          <li key={k} className="grid grid-cols-[2.25rem_1fr] gap-3">
            <span className="num text-[0.8125rem] text-ink-60">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>
              <span className="block font-semibold">{t(`how.${k}.title`)}</span>
              <span className="mt-1 block text-[0.875rem] leading-relaxed text-ink-70">
                {t(`how.${k}.body`)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        lead={t('lead')}
        art="avocado"
        locale={locale}
      />
      <section
        data-hide-fab
        className="container-x grid grid-cols-1 gap-16 pb-24 lg:grid-cols-12 lg:gap-6"
      >
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            {/* the condition, before anything is asked */}
            <div className="rounded-[22px] bg-ink p-6 text-paper">
              <p className="label text-citrus">{t('rule.eyebrow')}</p>
              <p className="mt-3 font-display text-[2rem] leading-tight ar:font-bold">
                {t('rule.title')}
              </p>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-paper/80">
                {t('rule.body')}
              </p>
            </div>
            {/* on wide screens beside the form; on phones after it (the form comes first) */}
            <div className="mt-10 hidden lg:block">{howList}</div>
          </div>
        </aside>
        <div className="lg:col-span-7 lg:col-start-6">
          <ApplyForm whatsapp={contact.whatsapp} />
          <div className="mt-20 lg:hidden">{howList}</div>
        </div>
      </section>
      {/* the questions people ask before applying — only what the form itself guarantees */}
      <section aria-labelledby="apply-faq" className="container-x pb-32">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
          <h2 id="apply-faq" className="font-display text-display-md lg:col-span-4 ar:font-bold">
            {t('faq.title')}
          </h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <Faq items={t.raw('faq.items') as { q: string; a: string }[]} />
          </div>
        </div>
      </section>
    </>
  );
}
