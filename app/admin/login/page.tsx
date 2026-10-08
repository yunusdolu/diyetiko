import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { backend } from '@/lib/env';
import { AuthFrame } from '@/components/portal/auth-frame';
import { LoginForm } from './login-form';
import { DeskArt } from './desk-art';

export const metadata: Metadata = { title: 'Giriş' };

/**
 * The dietitian's way in: the same frame as the client portal's sign-in (one family of entry
 * pages), always on paper whatever the panel theme, with the panel's own name and a drawn table
 * setting on the dark side.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  const user = await getSessionUser();
  if (user?.role === 'client') redirect('/panel');
  if (user && !user.needsMfa) redirect('/admin');
  const t = await getTranslations('admin');
  const mode = backend();
  return (
    <AuthFrame
      brand={t('brand')}
      surface={t('login.surface')}
      headline={t('login.headline')}
      siteLabel={t('login.backToSite')}
      art={<DeskArt />}
      className="bg-paper text-ink"
      data-backend={mode}
    >
      <LoginForm
        initialMfa={step === 'mfa'}
        localHint={mode === 'local' ? t('login.localHint') : null}
      />
    </AuthFrame>
  );
}
