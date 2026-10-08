import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/site/header';

/** Expired, revoked or unknown link. Shown in Turkish with an English line (language unknown). */
export default async function ShareNotFound() {
  const t = await getTranslations({ locale: 'tr', namespace: 'share' });
  const te = await getTranslations({ locale: 'en', namespace: 'share' });
  return (
    <main className="container-x grid min-h-dvh place-items-center py-20">
      <div className="max-w-lg">
        <BrandMark className="size-10 text-ink" />
        <h1 className="mt-8 font-display text-[clamp(2.5rem,7vw,4rem)] leading-[1.02]">
          {t('invalidTitle')}
        </h1>
        <p className="mt-4 text-lead text-ink-70">{t('invalidBody')}</p>
        <p className="mt-8 border-t border-ink/15 pt-4 text-ui text-ink-60" lang="en">
          {te('invalidTitle')} {te('invalidBody')}
        </p>
      </div>
    </main>
  );
}
