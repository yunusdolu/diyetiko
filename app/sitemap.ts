import type { MetadataRoute } from 'next';
import { listArticles, listRecipes } from '@/lib/content/public';
import { locales } from '@/lib/i18n/config';
import type { AppPathname } from '@/lib/i18n/routing';
import { absoluteUrl, localizedPath } from '@/lib/seo';

export const revalidate = 3600;

const STATIC: Exclude<AppPathname, `${string}[${string}` | '/recipes/shopping-list'>[] = [
  '/',
  '/recipes',
  '/guides',
  '/tools',
  '/goal',
  '/about',
  '/professionals',
  '/contact',
  '/apply',
  '/legal/privacy',
  '/legal/kvkk',
  '/legal/cookies',
];

/** Localized sitemap with hreflang alternates. Detail pages list only real translations. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  for (const path of STATIC) {
    const languages = Object.fromEntries(
      locales.map((l) => [l, absoluteUrl(localizedPath(l, path))]),
    );
    for (const l of locales)
      entries.push({ url: languages[l]!, alternates: { languages }, changeFrequency: 'weekly' });
  }

  const recipesByLocale = await Promise.all(
    locales.map(async (l) => [l, await listRecipes(l)] as const),
  );
  const recipeIds = new Set(recipesByLocale.flatMap(([, list]) => list.map((r) => r.id)));
  for (const id of recipeIds) {
    const own = recipesByLocale
      .map(([l, list]) => [l, list.find((r) => r.id === id)] as const)
      .filter(([l, r]) => r && r.contentLocale === l);
    const languages = Object.fromEntries(
      own.map(([l, r]) => [
        l,
        absoluteUrl(localizedPath(l, { pathname: '/recipes/[slug]', params: { slug: r!.slug } })),
      ]),
    );
    for (const [l, r] of own)
      entries.push({
        url: languages[l]!,
        alternates: { languages },
        lastModified: r!.publishedAt ?? undefined,
      });
  }

  const articlesByLocale = await Promise.all(
    locales.map(async (l) => [l, await listArticles(l)] as const),
  );
  const articleIds = new Set(articlesByLocale.flatMap(([, list]) => list.map((a) => a.id)));
  for (const id of articleIds) {
    const own = articlesByLocale
      .map(([l, list]) => [l, list.find((a) => a.id === id)] as const)
      .filter(([l, a]) => a && a.contentLocale === l);
    const languages = Object.fromEntries(
      own.map(([l, a]) => [
        l,
        absoluteUrl(localizedPath(l, { pathname: '/guides/[slug]', params: { slug: a!.slug } })),
      ]),
    );
    for (const [l, a] of own)
      entries.push({
        url: languages[l]!,
        alternates: { languages },
        lastModified: a!.publishedAt ?? undefined,
      });
  }
  return entries;
}
