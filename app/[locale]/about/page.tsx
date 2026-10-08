import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSiteSettings } from '@/lib/content/public';
import type { Locale } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import { Ingredient } from '@/components/site/ingredients';
import { PageHeader } from '@/components/site/page-header';
import { Placeholder } from '@/components/site/placeholder';
import { ArrowIcon } from '@/components/ui/motion-button';
import { MotionLink } from '@/components/ui/motion-link';
import { Reveal } from '@/components/motion/reveal';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return pageMetadata(locale, '/about', t('title'), t('lead'));
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const tc = await getTranslations('common');
  const settings = await getSiteSettings(locale);
  const principles = t.raw('principles') as { title: string; body: string }[];

  return (
    <>
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} locale={locale} />

      <section className="container-x grid grid-cols-1 gap-14 pb-24 lg:grid-cols-12 lg:gap-6">
        {/* Art-directed portrait frame: offset ink outline, drawn stand-in until a photo exists */}
        <div className="lg:col-span-5">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 translate-x-3 translate-y-3 border-2 border-ink rtl:-translate-x-3"
            />
            <div className="relative grid aspect-[4/5] place-items-center overflow-hidden bg-[#efd9c6]">
              {settings.images.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.images.portrait}
                  alt="Diyetiko"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <>
                  <Ingredient name="olive" className="size-2/3" />
                  <span className="absolute start-4 bottom-4 rounded-pill bg-ink px-3 py-1.5 label text-[0.625rem] text-paper">
                    {tc('placeholderNotice')}
                  </span>
                  <span className="sr-only">{t('portraitAlt')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-14 lg:col-span-6 lg:col-start-7">
          <div>
            <h2 className="label text-ink-60">{t('bioTitle')}</h2>
            <div className="mt-4 border-t-2 border-ink pt-5">
              {settings.about.bio ? (
                settings.about.bio.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="mt-4 text-lead first:mt-0">
                    {p}
                  </p>
                ))
              ) : (
                <Placeholder label={tc('placeholderNotice')}>{t('bioPlaceholder')}</Placeholder>
              )}
            </div>
          </div>
          <div>
            <h2 className="label text-ink-60">{t('credentialsTitle')}</h2>
            <div className="mt-4 border-t-2 border-ink pt-5">
              {settings.credentials.items ? (
                <ul className="divide-y divide-ink/15">
                  {settings.credentials.items.map((c, i) => (
                    <li key={i} className="py-3 text-body">
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
        </div>
      </section>

      <section className="on-dark bg-green grain-light py-24 text-paper">
        <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
          <h2 className="font-display text-display-lg lg:col-span-4 ar:leading-[1.25] ar:font-bold">
            {t('principlesTitle')}
          </h2>
          <ol className="lg:col-span-7 lg:col-start-6">
            {principles.map((p, i) => (
              <li
                key={p.title}
                className="grid grid-cols-[4rem_1fr] gap-4 border-t border-paper/25 py-7 first:border-t-2 first:border-paper"
              >
                <span className="num-display text-[3rem] leading-none text-citrus">{i + 1}</span>
                <Reveal>
                  <h3 className="font-display text-[1.75rem] leading-tight ar:leading-[1.4] ar:font-bold">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-lead text-sage">{p.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-x flex flex-wrap items-center justify-between gap-6 py-20">
        <p className="font-display text-display-md ar:font-bold">{t('cta')}</p>
        <MotionLink href="/contact" size="lg" icon={<ArrowIcon />}>
          {t('cta')}
        </MotionLink>
      </section>
    </>
  );
}
