export const locales = ['tr', 'en', 'ar', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'tr';

/** Content fallback chain for DB-backed content: locale → en → tr. */
export function fallbackChain(locale: Locale): Locale[] {
  const chain: Locale[] = [locale, 'en', 'tr'];
  return chain.filter((l, i) => chain.indexOf(l) === i);
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Native names — never translated, always shown in their own script. */
export const localeNames: Record<Locale, string> = {
  tr: 'Türkçe',
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
};

/** BCP-47 tag used with Intl. Arabic defaults to Latin digits for data clarity. */
export function intlLocale(locale: Locale, arabicDigits: 'latn' | 'arab' = 'latn'): string {
  if (locale === 'ar') return arabicDigits === 'latn' ? 'ar-u-nu-latn' : 'ar';
  if (locale === 'tr') return 'tr-TR';
  if (locale === 'fr') return 'fr-FR';
  return 'en-GB';
}

export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const ADMIN_LOCALE_COOKIE = 'ADMIN_LOCALE';
/** Client portal UI language (set at sign-in from the client record, changeable in Hesap). */
export const PORTAL_LOCALE_COOKIE = 'PORTAL_LOCALE';
/** Request header set by proxy.ts for /panel, so next-intl knows which surface it serves. */
export const SURFACE_HEADER = 'x-surface';
export const LANG_SUGGEST_COOKIE = 'LANG_SUGGEST_DISMISSED';
