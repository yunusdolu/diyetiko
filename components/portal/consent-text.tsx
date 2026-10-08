'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/config';

/** Explicit-consent text for the portal (health data). Placeholder until legal review. */
export function ConsentText() {
  const t = useTranslations('portal.auth');
  const locale = useLocale() as Locale;
  return (
    <div>
      <p className="font-sans text-[1rem] font-bold">{t('consentTitle')}</p>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-70">{t('consentBody')}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem]">
        <span className="label text-paprika-deep">{t('consentLegal')}</span>
        <Link
          href="/legal/kvkk"
          locale={locale}
          target="_blank"
          className="font-semibold underline underline-offset-4"
        >
          {t('kvkkLink')}
        </Link>
      </p>
    </div>
  );
}
