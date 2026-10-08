import { getTranslations } from 'next-intl/server';

/**
 * Shown the moment a panel link is clicked, while the next page's data loads (it is prefetched
 * with the link, so navigation never waits on a blank screen). Pure CSS, no client code.
 */
export default async function PanelLoading() {
  const t = await getTranslations('admin.common');
  const block = 'admin-shimmer rounded-[18px]';
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden className="space-y-3">
        <div className="admin-shimmer h-3 w-40 rounded-pill" />
        <div className="admin-shimmer h-10 w-[min(28rem,80%)] rounded-[12px]" />
      </div>
      <div aria-hidden className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${block} h-32`} />
        ))}
      </div>
      <div aria-hidden className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${block} h-80 xl:col-span-7`} />
        <div className={`${block} h-80 xl:col-span-5`} />
      </div>
    </div>
  );
}
