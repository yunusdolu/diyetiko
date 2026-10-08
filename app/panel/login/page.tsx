import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getSiteSettings } from '@/lib/content/public';
import { isLocale } from '@/lib/i18n/config';
import { DeskArt } from '@/app/admin/login/desk-art';
import { AuthFrame } from '@/components/portal/auth-frame';
import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.auth');
  return { title: t('loginTitle') };
}

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ closed?: string }>;
}) {
  const user = await getSessionUser();
  // A signed-in dietitian who opens the client login sees it (to look at it, or to sign in as a
  // client on this browser) with a note — not a silent jump back to the panel.
  const asDietitian = user?.role === 'dietitian' && !user.needsMfa;
  const { closed } = await searchParams;
  if (user?.role === 'client' && !closed) redirect('/panel');
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const t = await getTranslations('portal');
  const tm = await getTranslations('meta');
  const settings = await getSiteSettings(locale);
  return (
    <AuthFrame
      data-portal-shell=""
      art={<DeskArt />}
      brand={tm('shortName')}
      surface={t('brand')}
      headline={t('auth.loginHeadline')}
      siteLabel={t('auth.backToSite')}
    >
      <LoginForm
        locale={locale}
        whatsapp={settings.contact.whatsapp}
        closed={closed === '1'}
        asDietitian={asDietitian}
      />
    </AuthFrame>
  );
}
