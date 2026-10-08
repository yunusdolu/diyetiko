'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { MotionButton } from '@/components/ui/motion-button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  useEffect(() => {
    // Only the digest is logged — never request data.
    console.error('page error', error.digest ?? 'no-digest');
  }, [error]);
  return (
    <section className="container-x min-h-[70svh] pt-36 pb-24">
      <h1 className="font-display text-display-lg ar:font-bold">{t('errorTitle')}</h1>
      <p className="mt-4 max-w-md text-lead text-ink-70">{t('errorBody')}</p>
      <div className="mt-8">
        <MotionButton size="lg" onClick={reset}>
          {t('retry')}
        </MotionButton>
      </div>
    </section>
  );
}
