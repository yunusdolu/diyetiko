import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import {
  ADMIN_LOCALE_COOKIE,
  PORTAL_LOCALE_COOKIE,
  SURFACE_HEADER,
  defaultLocale,
  isLocale,
  type Locale,
} from './config';
import { loadMessages } from './messages';

/**
 * Three contexts resolve a locale here:
 *  - public site: from the [locale] segment (requestLocale)
 *  - share page /p/[token]: passed explicitly (program language) via getTranslations({ locale })
 *  - admin: no segment → ADMIN_LOCALE cookie
 *  - client portal /panel: no segment → PORTAL_LOCALE cookie (proxy marks the surface)
 */
export default getRequestConfig(async ({ requestLocale, locale: explicit }) => {
  let locale: Locale | undefined = isLocale(explicit) ? explicit : undefined;
  if (!locale) {
    const requested = await requestLocale;
    if (isLocale(requested)) locale = requested;
  }
  if (!locale) {
    // Only reached on dynamic surfaces (admin, portal) — the public site always has a segment.
    const portal = (await headers()).get(SURFACE_HEADER) === 'portal';
    const jar = await cookies();
    const fromCookie = jar.get(portal ? PORTAL_LOCALE_COOKIE : ADMIN_LOCALE_COOKIE)?.value;
    locale = isLocale(fromCookie) ? fromCookie : defaultLocale;
  }
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: 'Europe/Istanbul',
    now: new Date(),
    formats: {
      number: {
        kcal: { maximumFractionDigits: 0 },
        grams: { maximumFractionDigits: 1 },
      },
    },
  };
});
