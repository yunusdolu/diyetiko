import { getTranslations } from 'next-intl/server';
import { whatsappHref } from '@/lib/utils';
import type { SiteSettings } from '@/types/content';
import { SectionTag } from '@/components/site/section';
import { ContactForm } from '@/components/site/contact-form';
import { ChatIcon } from '@/components/site/whatsapp-fab';
import { ExternalButton } from '@/components/ui/motion-link';
import { DrawUnderline } from '@/components/ui/motion-link';

/** Closing section: channels on one side, the form on the other. Hides the floating button. */
export async function ContactSection({
  contact,
  eyebrow,
}: {
  contact: SiteSettings['contact'];
  eyebrow: string;
}) {
  const t = await getTranslations('home.contact');
  const tc = await getTranslations('contact');
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      data-hide-fab
      className="relative bg-paper py-[clamp(96px,14vh,176px)]"
    >
      <div className="container-x grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-5">
          <SectionTag tone="orange">{eyebrow}</SectionTag>
          <h2
            id="contact-title"
            className="mt-5 font-display text-display-xl tracking-[-0.03em] ar:leading-[1.2] ar:font-bold ar:tracking-normal"
          >
            {t('title')}
          </h2>
          <p className="mt-6 max-w-md text-lead text-ink-70">{t('lead')}</p>

          <div className="mt-10 space-y-6">
            <ExternalButton
              href={whatsappHref(contact.whatsapp)}
              newTab
              tone="paprika"
              size="lg"
              icon={<ChatIcon size={20} />}
            >
              {tc('whatsapp')}
            </ExternalButton>
            <dl className="grid max-w-md grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 border-t-2 border-ink pt-5 text-ui">
              <dt className="font-semibold">{tc('phone')}</dt>
              <dd>
                <a href={`tel:${contact.phoneE164}`} className="group/draw tap-44 num" dir="ltr">
                  <DrawUnderline>{contact.phoneDisplay}</DrawUnderline>
                </a>
              </dd>
              <dt className="font-semibold">{tc('instagram')}</dt>
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
                  <dt className="font-semibold">{tc('email')}</dt>
                  <dd>
                    <a href={`mailto:${contact.email}`} className="group/draw tap-44" dir="ltr">
                      <DrawUnderline>{contact.email}</DrawUnderline>
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <h3 className="label text-ink-60">{tc('formTitle')}</h3>
          <div className="mt-4">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
