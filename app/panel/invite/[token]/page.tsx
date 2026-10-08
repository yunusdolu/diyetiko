import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { getSiteSettings } from '@/lib/content/public';
import { PORTAL_LOCALE_COOKIE, dirOf, isLocale, type Locale } from '@/lib/i18n/config';
import type { Messages } from '@/lib/i18n/messages';
import { pick } from '@/lib/i18n/pick';
import { peekInvite } from '@/lib/portal/invites';
import { whatsappHref } from '@/lib/utils';
import { DeskArt } from '@/app/admin/login/desk-art';
import { AuthFrame } from '@/components/portal/auth-frame';
import { InviteForm } from './invite-form';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const peek = await peekInvite(token);
  // A first-time visitor has no portal language yet: speak the language on their client record.
  const chosen = (await cookies()).get(PORTAL_LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(chosen) ? chosen : (peek?.locale ?? 'tr');
  const t = await getTranslations({ locale, namespace: 'portal' });
  const tm = await getTranslations({ locale, namespace: 'meta' });
  const messages = (await getMessages({ locale })) as Messages;
  const settings = await getSiteSettings(locale);

  return (
    <div lang={locale} dir={dirOf(locale)}>
      <AuthFrame
        data-portal-shell=""
        art={<DeskArt />}
        brand={tm('shortName')}
        surface={t('brand')}
        headline={
          peek
            ? t(peek.purpose === 'reset' ? 'auth.resetTitle' : 'auth.inviteTitle', {
                name: peek.firstName,
              })
            : t('auth.invalidLink')
        }
        siteLabel={t('auth.backToSite')}
      >
        {peek ? (
          <NextIntlClientProvider locale={locale} messages={pick(messages, ['portal', 'form'])}>
            <InviteForm
              token={token}
              purpose={peek.purpose}
              firstName={peek.firstName}
              email={peek.email ?? ''}
            />
          </NextIntlClientProvider>
        ) : (
          <div>
            <h1 className="font-display text-[clamp(2.2rem,7vw,3.25rem)] leading-[0.98] tracking-[-0.02em] lg:sr-only ar:leading-[1.3] ar:font-bold">
              {t('auth.invalidLink')}
            </h1>
            <p className="mt-4 text-body text-ink-70">{t('auth.invalidLinkBody')}</p>
            <a
              href={whatsappHref(settings.contact.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex h-12 items-center rounded-pill bg-paprika px-6 text-ui font-semibold text-ink"
            >
              {t('auth.whatsapp')}
            </a>
          </div>
        )}
      </AuthFrame>
    </div>
  );
}
