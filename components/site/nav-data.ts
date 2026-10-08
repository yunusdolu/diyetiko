import type { AppPathname } from '@/lib/i18n/routing';

/** Pathnames without dynamic segments. */
export type StaticPathname = Exclude<AppPathname, `${string}[${string}`>;

export type NavKey =
  'recipes' | 'guides' | 'tools' | 'goal' | 'apply' | 'about' | 'professionals' | 'contact';

export const primaryNav: { key: NavKey; href: StaticPathname; illustration: string }[] = [
  { key: 'recipes', href: '/recipes', illustration: 'tomato' },
  { key: 'guides', href: '/guides', illustration: 'bread' },
  { key: 'tools', href: '/tools', illustration: 'lemon' },
  { key: 'goal', href: '/goal', illustration: 'pomegranate' },
  { key: 'apply', href: '/apply', illustration: 'avocado' },
  { key: 'about', href: '/about', illustration: 'olive' },
  { key: 'professionals', href: '/professionals', illustration: 'walnut' },
  { key: 'contact', href: '/contact', illustration: 'fig' },
];

export const headerNav: NavKey[] = ['recipes', 'guides', 'tools', 'about'];
