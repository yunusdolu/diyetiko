import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSiteSettings } from '@/lib/content/public';
import type { Locale } from '@/lib/i18n/config';
import { pageMetadata } from '@/lib/seo';
import { whatsappHref } from '@/lib/utils';
import { ContactForm } from '@/components/site/contact-form';
import { PageHeader } from '@/components/site/page-header';
import { Placeholder } from '@/components/site/placeholder';
import { ChatIcon } from '@/components/site/whatsapp-fab';
import { DrawUnderline, ExternalButton } from '@/components/ui/motion-link';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return pageMetadata(locale, '/contact', t('title'), t('lead'));
}

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  const th = await getTranslations('home.contact');
  const tc = await getTranslations('common');
  const { contact } = await getSiteSettings(locale);

  return (
    <>
      <PageHeader
        eyebrow={th('eyebrow')}
        title={th('title')}
        lead={t('lead')}
        art="fig"
        locale={locale}
      />
      <section
        data-hide-fab
        className="container-x grid grid-cols-1 gap-16 pb-32 lg:grid-cols-12 lg:gap-6"
      >
        <div className="lg:col-span-4">
          <h2 className="label text-ink-60">{t('channels')}</h2>
          <div className="mt-5">
            <ExternalButton
              href={whatsappHref(contact.whatsapp)}
              newTab
              tone="paprika"
              size="lg"
              icon={<ChatIcon size={20} />}
            >
              {t('whatsapp')}
            </ExternalButton>
          </div>
          <dl className="mt-8 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 border-t-2 border-ink pt-5 text-ui">
            <dt className="font-semibold">{t('phone')}</dt>
            <dd>
              <a href={`tel:${contact.phoneE164}`} className="group/draw tap-44 num" dir="ltr">
                <DrawUnderline>{contact.phoneDisplay}</DrawUnderline>
              </a>
            </dd>
            <dt className="font-semibold">{t('instagram')}</dt>
            <dd>
              <a
                href={`https://instagram.com/${contact.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group/draw tap-44"
                dir="ltr"
              >
                <DrawUnderline>@{contact.instagram}</DrawUnderline>
              </a>
            </dd>
            {contact.email && (
              <>
                <dt className="font-semibold">{t('email')}</dt>
                <dd>
                  <a href={`mailto:${contact.email}`} className="group/draw tap-44" dir="ltr">
                    <DrawUnderline>{contact.email}</DrawUnderline>
                  </a>
                </dd>
              </>
            )}
          </dl>
          <div className="mt-8">
            <h3 className="label text-ink-60">{t('address')}</h3>
            <div className="mt-3">
              {contact.address ? (
                <address className="text-body not-italic">{contact.address}</address>
              ) : (
                <Placeholder label={tc('placeholderNotice')}>{t('addressPlaceholder')}</Placeholder>
              )}
            </div>
          </div>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <h2 className="font-display text-display-md ar:font-bold">{t('formTitle')}</h2>
          <div className="mt-6">
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
