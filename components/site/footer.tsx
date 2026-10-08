import { getTranslations } from 'next-intl/server';
import { PlainLink } from '@/components/ui/plain-link';
import { Link } from '@/lib/i18n/navigation';
import { whatsappHref } from '@/lib/utils';
import type { SiteSettings } from '@/types/content';
import { DrawUnderline } from '@/components/ui/motion-link';
import { primaryNav } from './nav-data';
import { BackToTop } from './back-to-top';
import { CookieSettingsLink } from './cookie-consent';

function PersonGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" />
    </svg>
  );
}

function KeyGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 7l2 2M14 9l2 2" />
    </svg>
  );
}

export async function Footer({ contact }: { contact: SiteSettings['contact'] }) {
  const t = await getTranslations('footer');
  const nav = await getTranslations('nav');
  const legal = await getTranslations('legal');
  const meta = await getTranslations('meta');
  const tc = await getTranslations('contact');
  const tk = await getTranslations('cookies');
  const year = new Date().getFullYear();

  return (
    <footer
      data-hide-fab
      className="no-print on-dark relative overflow-hidden bg-ink grain-light text-paper"
    >
      <div className="container-x grid grid-cols-1 gap-14 pt-24 pb-10 lg:grid-cols-12 lg:gap-6 lg:pt-32">
        <div className="lg:col-span-5">
          <p className="font-display text-display-md text-citrus italic ar:not-italic">
            {t('tagline')}
          </p>
          <p className="mt-6 max-w-md text-[0.875rem] leading-relaxed text-sage">
            {t('disclaimer')}
          </p>
        </div>

        <nav aria-label={t('explore')} className="lg:col-span-3 lg:col-start-7">
          <p className="label text-sage">{t('explore')}</p>
          <ul className="mt-5 grid gap-2.5">
            {primaryNav.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="group/draw tap-44 text-ui text-paper">
                  <DrawUnderline>{nav(item.key)}</DrawUnderline>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid content-start gap-10 lg:col-span-3">
          <div>
            <p className="label text-sage">{t('reach')}</p>
            <ul className="mt-5 grid gap-2.5 text-ui">
              <li>
                <a
                  className="group/draw tap-44"
                  href={whatsappHref(contact.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <DrawUnderline>{tc('whatsapp')}</DrawUnderline>
                </a>
              </li>
              <li>
                <a className="group/draw tap-44 num" href={`tel:${contact.phoneE164}`} dir="ltr">
                  <DrawUnderline>{contact.phoneDisplay}</DrawUnderline>
                </a>
              </li>
              <li>
                <a
                  className="group/draw tap-44"
                  href={`https://instagram.com/${contact.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                >
                  <DrawUnderline>@{contact.instagram}</DrawUnderline>
                </a>
              </li>
              {contact.email && (
                <li>
                  <a className="group/draw tap-44" href={`mailto:${contact.email}`} dir="ltr">
                    <DrawUnderline>{contact.email}</DrawUnderline>
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <p className="label text-sage">{t('legal')}</p>
            <ul className="mt-5 grid gap-2.5 text-ui">
              <li>
                <Link href="/legal/privacy" className="group/draw tap-44">
                  <DrawUnderline>{legal('privacy.title')}</DrawUnderline>
                </Link>
              </li>
              <li>
                <Link href="/legal/kvkk" className="group/draw tap-44">
                  <DrawUnderline>{legal('kvkk.title')}</DrawUnderline>
                </Link>
              </li>
              <li>
                <Link href="/legal/cookies" className="group/draw tap-44">
                  <DrawUnderline>{legal('cookies.title')}</DrawUnderline>
                </Link>
              </li>
              <li>
                <CookieSettingsLink className="group/draw tap-44 text-start">
                  <DrawUnderline>{tk('settings')}</DrawUnderline>
                </CookieSettingsLink>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container-x flex flex-wrap items-center justify-between gap-4 border-t border-paper/15 py-6 text-[0.8125rem] text-sage">
        <p>{t('rights', { year })}</p>
        {/* sign-in for clients and for the dietitian: no address to remember */}
        <nav aria-label={t('signIn')} className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <PlainLink
            href="/panel/login"
            className="group/draw tap-44 inline-flex items-center gap-1.5 text-paper"
          >
            <PersonGlyph />
            <DrawUnderline>{t('clientLogin')}</DrawUnderline>
          </PlainLink>
          <PlainLink
            href="/admin/login"
            className="group/draw tap-44 inline-flex items-center gap-1.5 text-paper"
          >
            <KeyGlyph />
            <DrawUnderline>{t('dietitianLogin')}</DrawUnderline>
          </PlainLink>
        </nav>
        <BackToTop label={t('top')} />
      </div>

      {/* Cropped wordmark: bleeds off the bottom edge on purpose. */}
      <p
        aria-hidden
        className="pointer-events-none -mb-[0.24em] text-center font-display text-[clamp(4rem,17vw,17rem)] leading-[0.8] tracking-[-0.04em] whitespace-nowrap text-paper/[0.07] select-none ar:tracking-normal"
      >
        {meta('shortName')}
      </p>
    </footer>
  );
}
