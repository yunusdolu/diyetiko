import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from './config';

/**
 * tr is the default and has no prefix. Other locales are prefixed.
 * Arabic segments are Latin transliterations so URLs stay copy-pasteable.
 * Locale detection is OFF: we never redirect based on Accept-Language.
 * The explicit choice (cookie) is honoured only on "/" — see proxy.ts.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
  alternateLinks: false,
  pathnames: {
    '/': '/',
    '/about': { tr: '/hakkimda', en: '/about', fr: '/a-propos', ar: '/nabdha' },
    '/recipes': { tr: '/tarifler', en: '/recipes', fr: '/recettes', ar: '/wasafat' },
    '/recipes/shopping-list': {
      tr: '/tarifler/alisveris-listesi',
      en: '/recipes/shopping-list',
      fr: '/recettes/liste-de-courses',
      ar: '/wasafat/qaimat-al-mushtarayat',
    },
    '/recipes/[slug]': {
      tr: '/tarifler/[slug]',
      en: '/recipes/[slug]',
      fr: '/recettes/[slug]',
      ar: '/wasafat/[slug]',
    },
    '/guides': { tr: '/rehberler', en: '/guides', fr: '/guides', ar: '/adilla' },
    '/guides/[slug]': {
      tr: '/rehberler/[slug]',
      en: '/guides/[slug]',
      fr: '/guides/[slug]',
      ar: '/adilla/[slug]',
    },
    '/tools': { tr: '/araclar', en: '/tools', fr: '/outils', ar: '/adawat' },
    '/goal': {
      tr: '/hedefini-bul',
      en: '/find-your-goal',
      fr: '/trouver-mon-objectif',
      ar: '/hadafak',
    },
    '/professionals': {
      tr: '/meslektaslar',
      en: '/professionals',
      fr: '/professionnels',
      ar: '/lil-mukhtassin',
    },
    '/contact': { tr: '/iletisim', en: '/contact', fr: '/contact', ar: '/tawasul' },
    '/apply': { tr: '/basvuru', en: '/apply', fr: '/candidature', ar: '/talab' },
    '/legal/privacy': {
      tr: '/gizlilik',
      en: '/privacy',
      fr: '/confidentialite',
      ar: '/al-khususiya',
    },
    '/legal/kvkk': { tr: '/kvkk-aydinlatma', en: '/kvkk-notice', fr: '/avis-kvkk', ar: '/kvkk' },
    '/legal/cookies': {
      tr: '/cerez-politikasi',
      en: '/cookies',
      fr: '/cookies',
      ar: '/siyasat-al-kukiz',
    },
  },
});

export type AppPathname = keyof typeof routing.pathnames;
