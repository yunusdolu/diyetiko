import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth';
import { DeskArt } from '@/app/admin/login/desk-art';
import { AuthFrame } from '@/components/portal/auth-frame';
import { ConsentForm } from './consent-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.auth');
  return { title: t('consentTitle') };
}

/** Linked client without (or after withdrawing) consent: nothing else in the portal is reachable. */
export default async function ConsentPage() {
  const { status } = await requireClient({ consent: false });
  if (status.consented) redirect('/panel');
  const t = await getTranslations('portal');
  const tm = await getTranslations('meta');
  return (
    <AuthFrame
      data-portal-shell=""
      art={<DeskArt />}
      brand={tm('shortName')}
      surface={t('brand')}
      headline={t('auth.consentTitle')}
      siteLabel={t('auth.backToSite')}
    >
      <ConsentForm firstName={status.firstName} />
    </AuthFrame>
  );
}
