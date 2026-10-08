import 'server-only';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { env } from '@/lib/env';
import { defaultLocale, locales, type Locale } from '@/lib/i18n/config';
import { getPathname } from '@/lib/i18n/navigation';
import type { AppPathname } from '@/lib/i18n/routing';

type Href = Parameters<typeof getPathname>[0]['href'];

export function absoluteUrl(path: string): string {
  return new URL(path, env.siteUrl).toString();
}

export function localizedPath(locale: Locale, href: Href): string {
  return getPathname({ locale, href });
}

/**
 * hreflang alternates. For detail pages pass `only` = locales that really have their own
 * translation, so fallback pages are not advertised as translations.
 */
export function alternatesFor(
  locale: Locale,
  hrefFor: (l: Locale) => Href | null,
  only: readonly Locale[] = locales,
): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {};
  for (const l of only) {
    const href = hrefFor(l);
    if (href) languages[l] = absoluteUrl(localizedPath(l, href));
  }
  const xDefault = hrefFor(defaultLocale);
  if (xDefault && only.includes(defaultLocale))
    languages['x-default'] = absoluteUrl(localizedPath(defaultLocale, xDefault));
  const self = hrefFor(locale);
  return {
    canonical: self ? absoluteUrl(localizedPath(locale, self)) : undefined,
    languages,
  };
}

const ogLocale: Record<Locale, string> = { tr: 'tr_TR', en: 'en_GB', ar: 'ar_AR', fr: 'fr_FR' };

/**
 * Share image: the one uploaded in admin Settings, else the static localized card
 * (public/og/og-<locale>.png, rendered by Chromium via scripts/gen-og.mjs so Arabic is shaped).
 */
export async function ogImages(
  locale: Locale,
): Promise<{ url: string; width?: number; height?: number; alt: string }[]> {
  const [{ getSiteSettings }, t] = await Promise.all([
    import('@/lib/content/public'),
    getTranslations({ locale, namespace: 'meta' }),
  ]);
  const uploaded = (await getSiteSettings(locale)).images.og;
  return uploaded
    ? [{ url: uploaded, alt: t('siteName') }]
    : [{ url: absoluteUrl(`/og/og-${locale}.png`), width: 1200, height: 630, alt: t('siteName') }];
}

/** Standard metadata for a static page. */
export async function pageMetadata(
  locale: Locale,
  pathname: AppPathname,
  title: string | null,
  description?: string,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  const fullTitle = title ? t('titleTemplate').replace('%s', title) : t('defaultTitle');
  const desc = description ?? t('defaultDescription');
  const alternates = alternatesFor(locale, () => pathname as Href);
  const images = await ogImages(locale);
  return {
    title: fullTitle,
    description: desc,
    alternates,
    openGraph: {
      title: fullTitle,
      description: desc,
      url: typeof alternates.canonical === 'string' ? alternates.canonical : undefined,
      siteName: t('siteName'),
      locale: ogLocale[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
      type: 'website',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: desc,
      images: images.map((i) => i.url),
    },
  };
}
