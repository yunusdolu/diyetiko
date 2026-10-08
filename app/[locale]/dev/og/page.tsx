import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSiteSettings } from '@/lib/content/public';
import { isLocale } from '@/lib/i18n/config';
import { BrandMark } from '@/components/site/header';
import { Plate } from '@/components/site/home/plate';

/**
 * Source for the static Open Graph images (public/og/og-<locale>.png), captured by
 * `node scripts/gen-og.mjs`. Rendered by Chromium — not Satori/ImageResponse, which cannot shape
 * Arabic (letters would come out disconnected). Development only.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OgSource({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('home.hero');
  const tm = await getTranslations('meta');
  const settings = await getSiteSettings(locale);
  const lines = settings.hero.lines ?? (t.raw('lines') as string[]);

  return (
    <div className="grid min-h-dvh place-items-center bg-ink p-10">
      {/* Exactly 1200×630; the capture script screenshots this element. */}
      <div
        id="og"
        className="relative flex h-[630px] w-[1200px] shrink-0 overflow-hidden bg-paper grain text-ink"
      >
        <div className="relative z-10 flex w-[700px] flex-col justify-between p-16">
          <p className="flex items-center gap-3 text-[22px] font-semibold">
            <BrandMark className="size-10" />
            {tm('siteName')}
          </p>
          <p className="font-display text-[92px] leading-[0.95] font-medium tracking-[-0.03em] ar:text-[80px] ar:leading-[1.3] ar:font-bold ar:tracking-normal">
            {lines.map((l, i) => (
              <span key={i} className={i === 1 ? 'block text-paprika-deep' : 'block'}>
                {l}
              </span>
            ))}
          </p>
          <p className="self-start num text-[20px] text-ink-60" dir="ltr">
            @{settings.contact.instagram}
          </p>
        </div>
        <div
          className="og-plate absolute -end-[120px] top-1/2 w-[640px] -translate-y-1/2"
          aria-hidden
        >
          <Plate className="w-full" />
        </div>
      </div>
      {/* Rings drawn to a fixed, representative split (the live site animates them). */}
      <style>{`.og-plate .ring{opacity:1}.og-plate .ring-protein{stroke-dashoffset:.72}.og-plate .ring-carb{stroke-dashoffset:.5}.og-plate .ring-fat{stroke-dashoffset:.7}`}</style>
    </div>
  );
}
