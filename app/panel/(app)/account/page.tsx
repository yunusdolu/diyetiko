import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import { isLocale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import {
  LogoutButton,
  PasswordForm,
  PortalLanguage,
  WithdrawConsent,
} from '@/components/portal/account-forms';
import { PortalCard } from '@/components/portal/card';
import { ThemeChoice } from '@/components/portal/theme';
import { PortalHeader, PortalPage } from '@/components/portal/shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.account');
  return { title: t('title') };
}

function Row({ label, value, ltr }: { label: string; value: string | null; ltr?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-ink/10 py-3 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[0.8125rem] text-ink-60">{label}</dt>
      <dd className="min-w-0 font-semibold break-words" dir={ltr ? 'ltr' : undefined}>
        {value || '—'}
      </dd>
    </div>
  );
}

export default async function AccountPage() {
  const { user } = await requireClient();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const t = await getTranslations('portal.account');
  const tt = await getTranslations('portal.theme');
  const profile = await portal.getProfile(user.id);

  return (
    <PortalPage wide>
      <PortalHeader
        help="account"
        eyebrow={t('title')}
        title={profile?.firstName || t('title')}
        actions={<LogoutButton />}
      />

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-2">
        <PortalCard title={t('profile')}>
          <dl>
            <Row label={t('name')} value={profile?.fullName ?? null} />
            <Row label={t('email')} value={user.email || profile?.email || null} ltr />
            <Row label={t('dietitian')} value={profile?.dietitianName ?? null} />
          </dl>
          <p className="mt-3 text-[0.8125rem] text-ink-60">{t('profileHint')}</p>
        </PortalCard>

        <PortalCard title={t('language')}>
          <PortalLanguage current={locale} />
          <p className="mt-5 mb-2 text-[0.8125rem] font-semibold text-ink-60">{tt('title')}</p>
          <ThemeChoice />
        </PortalCard>

        <PortalCard title={t('password')}>
          <PasswordForm />
        </PortalCard>

        <PortalCard title={t('data')}>
          <p className="text-[0.9375rem] text-ink-70">{t('exportHint')}</p>
          <a
            href="/api/portal/export"
            download
            className="mt-4 inline-flex h-11 items-center rounded-pill bg-ink px-5 text-ui font-semibold text-paper transition-colors hover:bg-green"
          >
            {t('export')}
          </a>
          <div className="mt-8 border-t border-ink/10 pt-6">
            <p className="max-w-xl text-[0.9375rem] text-ink-70">{t('withdrawBody')}</p>
            <div className="mt-4">
              <WithdrawConsent />
            </div>
          </div>
        </PortalCard>
      </div>
    </PortalPage>
  );
}
