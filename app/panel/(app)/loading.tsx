import { getTranslations } from 'next-intl/server';
import { PortalPage } from '@/components/portal/shell';

/**
 * Shown the moment a portal link is tapped, while the next page's data loads — the dietitian
 * panel's skeleton in the portal's colours. Pure CSS, no client code.
 */
export default async function PortalLoading() {
  const t = await getTranslations('common');
  const block = 'p-shimmer rounded-[22px]';
  return (
    <PortalPage wide>
      <div role="status" aria-live="polite" className="pt-7 lg:pt-10">
        <span className="sr-only">{t('loading')}</span>
        <div aria-hidden className="space-y-3">
          <div className="p-shimmer h-3 w-36 rounded-pill" />
          <div className="p-shimmer h-10 w-[min(26rem,80%)] rounded-[12px]" />
          <div className="p-shimmer h-4 w-[min(34rem,90%)] rounded-pill" />
        </div>
        <div aria-hidden className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${block} h-28`} />
          ))}
        </div>
        <div aria-hidden className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className={`${block} h-80 xl:col-span-8`} />
          <div className={`${block} h-80 xl:col-span-4`} />
        </div>
      </div>
    </PortalPage>
  );
}
