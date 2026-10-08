import { getTranslations } from 'next-intl/server';
import { Ingredient } from '@/components/site/ingredients';
import { ArrowIcon } from '@/components/ui/motion-button';
import { MotionLink } from '@/components/ui/motion-link';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <section className="container-x grid min-h-[80svh] grid-cols-1 items-center gap-10 pt-32 pb-24 lg:grid-cols-12">
      <div className="lg:col-span-6">
        <p className="num-display text-[clamp(6rem,18vw,14rem)] leading-[0.8] text-paprika-deep">
          404
        </p>
        <h1 className="mt-6 font-display text-display-lg ar:leading-[1.3] ar:font-bold">
          {t('notFoundTitle')}
        </h1>
        <p className="mt-4 max-w-md text-lead text-ink-70">{t('notFoundBody')}</p>
        <div className="mt-8">
          <MotionLink href="/" size="lg" icon={<ArrowIcon />}>
            {t('home')}
          </MotionLink>
        </div>
      </div>
      <div className="relative hidden lg:col-span-5 lg:col-start-8 lg:block" aria-hidden>
        <svg viewBox="0 0 400 400" className="w-full">
          <circle cx="203" cy="203" r="180" fill="none" stroke="var(--color-ink)" strokeWidth="3" />
          <circle cx="200" cy="200" r="180" fill="var(--color-paper-2)" />
          <circle cx="200" cy="200" r="138" fill="#fbf8f1" />
        </svg>
        <Ingredient name="chickpea" className="absolute end-[8%] top-[6%] size-24 rotate-12" />
      </div>
    </section>
  );
}
