'use client';

import { useTranslations } from 'next-intl';
import { ArrowIcon } from '@/components/ui/motion-button';
import { MotionLink } from '@/components/ui/motion-link';
import { MonthStrip } from '@/components/site/month-strip';

/**
 * Home call to apply: the condition first (programmes run at least three months), drawn as a
 * year of months that fills in — the first three in citrus, the rest as the road that can follow.
 */
export function ApplyBand() {
  const t = useTranslations('home.apply');
  return (
    <section
      aria-labelledby="apply-title"
      className="on-dark relative overflow-hidden bg-ink grain-light py-24 text-paper lg:py-32"
    >
      <div className="container-x grid grid-cols-1 items-end gap-12 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-6">
          <p className="label text-citrus">{t('eyebrow')}</p>
          <h2
            id="apply-title"
            className="mt-5 font-display text-display-lg tracking-[-0.025em] ar:leading-[1.25] ar:font-bold ar:tracking-normal"
          >
            {t('title')}
          </h2>
          <p className="mt-6 max-w-lg text-lead text-sage">{t('lead')}</p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <MotionLink
              href="/apply"
              tone="citrus"
              size="lg"
              effect="magnetic"
              icon={<ArrowIcon />}
            >
              {t('cta')}
            </MotionLink>
            <span className="text-[0.875rem] text-sage">{t('note')}</span>
          </div>
        </div>
        <MonthStrip className="lg:col-span-5 lg:col-start-8" />
      </div>
    </section>
  );
}
