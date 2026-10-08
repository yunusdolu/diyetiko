import { getTranslations } from 'next-intl/server';
import { PageHeader } from './page-header';

/** Legal placeholder. The text must be written by a lawyer (README checklist). */
export async function LegalPage({
  kind,
  locale,
}: {
  kind: 'privacy' | 'kvkk' | 'cookies';
  locale: string;
}) {
  const t = await getTranslations('legal');
  const tf = await getTranslations('footer');
  return (
    <>
      <PageHeader eyebrow={tf('legal')} title={t(`${kind}.title`)} locale={locale} />
      <section className="container-x pb-32 lg:grid lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7 lg:col-start-3">
          <p
            role="note"
            className="border-[3px] border-paprika-deep p-5 font-semibold text-paprika-deep"
          >
            {t('reviewBanner')}
          </p>
          <p className="mt-8 text-lead text-ink-70">{t('placeholderBody')}</p>
          {kind === 'cookies' && (
            <p className="mt-8 border-t-2 border-ink pt-5 text-body">{t('cookiesFacts')}</p>
          )}
        </div>
      </section>
    </>
  );
}
