import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getArticle, listArticles } from '@/lib/content/public';
import { isLocale, localeNames, locales, type Locale } from '@/lib/i18n/config';
import { Link, redirect } from '@/lib/i18n/navigation';
import { absoluteUrl, alternatesFor, localizedPath, ogImages } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { RegisterAlternates } from '@/components/site/alternates';
import { ArticleBody } from '@/components/site/article-body';
import { Ingredient } from '@/components/site/ingredients';
import { JsonLd } from '@/components/site/json-ld';
import { ReadingProgress } from '@/components/site/reading-progress';
import { tints } from '@/components/site/recipe-card';
import { ArrowIcon } from '@/components/ui/motion-button';

export const revalidate = 3600;

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  // Development renders on demand; skipping this keeps Next's static-paths worker (a separate
  // process) away from the local demo database, which only one process may open.
  if (process.env.NODE_ENV === 'development') return [];
  if (!isLocale(params.locale)) return [];
  return (await listArticles(params.locale)).map((a) => ({ slug: a.slug }));
}

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const res = await getArticle(locale, decodeURIComponent(slug));
  if (res.kind !== 'found') return {};
  const a = res.item;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const own = locales.filter((l) => a.alternates[l]);
  return {
    title: t('titleTemplate').replace('%s', a.title),
    description: a.excerpt,
    alternates: alternatesFor(
      locale,
      (l) =>
        a.alternates[l] ? { pathname: '/guides/[slug]', params: { slug: a.alternates[l]! } } : null,
      own.length ? own : [locale],
    ),
    openGraph: {
      title: a.title,
      description: a.excerpt,
      type: 'article',
      images: a.coverUrl ? [a.coverUrl] : await ogImages(locale),
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const res = await getArticle(locale, decodeURIComponent(slug));
  if (res.kind === 'missing') notFound();
  if (res.kind === 'redirect')
    redirect({ href: { pathname: '/guides/[slug]', params: { slug: res.slug } }, locale });
  if (res.kind !== 'found') notFound();
  const a = res.item;
  const t = await getTranslations('guides');
  const tc = await getTranslations('common');
  const format = await getFormatter();
  const fallback = a.contentLocale !== locale;
  const others = (await listArticles(locale)).filter((x) => x.id !== a.id).slice(0, 3);

  return (
    <article
      lang={fallback ? a.contentLocale : undefined}
      dir={fallback && locale === 'ar' ? 'ltr' : undefined}
    >
      <ReadingProgress />
      <RegisterAlternates value={{ route: '/guides/[slug]', slugs: a.alternates }} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: a.title,
          description: a.excerpt,
          inLanguage: a.contentLocale,
          datePublished: a.publishedAt,
          dateModified: a.updatedAt,
          author: { '@type': 'Organization', name: 'Diyetiko' },
          mainEntityOfPage: absoluteUrl(
            localizedPath(locale, { pathname: '/guides/[slug]', params: { slug: a.slug } }),
          ),
          citation: a.sources.map((s) => s.url ?? `${s.title} — ${s.publisher}`),
        }}
      />
      <header className="container-x grid grid-cols-1 gap-8 pt-28 pb-12 lg:grid-cols-12 lg:gap-6 lg:pt-36">
        <div className="lg:col-span-2">
          <Link
            href="/guides"
            className="group/back inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-ink-70"
          >
            <ArrowIcon size={14} className="rotate-180" />
            <span className="group-hover/back:underline">{t('back')}</span>
          </Link>
        </div>
        <div className="lg:col-span-7">
          <p className="label text-ink-60">
            {t(`categories.${a.category}` as 'categories.basics')} ·{' '}
            <span className="num">{t('readingTime', { count: a.readingMin })}</span>
          </p>
          <h1 className="mt-5 font-display text-display-lg tracking-[-0.025em] ar:leading-[1.3] ar:font-bold ar:tracking-normal">
            {a.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lead text-ink-70">{a.excerpt}</p>
          {fallback && (
            <p
              className="mt-6 border-s-2 border-paprika-deep ps-3 text-[0.8125rem] text-ink-70"
              lang={locale}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
            >
              {tc('translationFallback', {
                language: localeNames[locale],
                fallback: localeNames[a.contentLocale],
              })}
            </p>
          )}
        </div>
        <div
          className={cn(
            'hidden aspect-square place-items-center lg:col-span-3 lg:grid',
            tints[a.illustration] ?? 'bg-paper-2',
          )}
        >
          <Ingredient name={a.illustration} className="size-3/4" />
        </div>
      </header>

      <div className="container-x grid grid-cols-1 gap-12 pb-24 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7 lg:col-start-3">
          <ArticleBody body={a.body} />
          <p className="mt-14 max-w-[38rem] border-t border-ink/20 pt-5 text-[0.875rem] text-ink-60">
            {t('reviewNote')}
          </p>
        </div>
        <aside className="lg:col-span-3">
          <div className="lg:sticky lg:top-28">
            <h2 className="label text-ink-60">{t('sources')}</h2>
            <ol className="mt-4 space-y-4 border-t-2 border-ink pt-4 text-[0.875rem]">
              {a.sources.map((s, i) => (
                <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-2">
                  <span className="num text-ink-60">{i + 1}</span>
                  <span>
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline underline-offset-4"
                      >
                        {s.title}
                        <span className="sr-only"> {tc('external')}</span>
                      </a>
                    ) : (
                      <span className="font-semibold">{s.title}</span>
                    )}
                    <span className="block text-ink-60">{s.publisher}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-[0.75rem] text-ink-60">
              {format.dateTime(new Date(a.updatedAt), { dateStyle: 'long' })}
            </p>
          </div>
        </aside>
      </div>

      {others.length > 0 && (
        <nav aria-label={t('title')} className="border-t border-ink/15 bg-paper-2 grain py-20">
          <div className="container-x grid grid-cols-1 gap-8 md:grid-cols-3">
            {others.map((o) => (
              <Link
                key={o.id}
                href={{ pathname: '/guides/[slug]', params: { slug: o.slug } }}
                className="group/o block border-t-2 border-ink pt-4"
              >
                <span className="label text-ink-60">
                  {t(`categories.${o.category}` as 'categories.basics')}
                </span>
                <span className="mt-2 block font-display text-[1.6rem] leading-tight group-hover/o:text-paprika-deep ar:leading-[1.4] ar:font-bold">
                  {o.title}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </article>
  );
}
