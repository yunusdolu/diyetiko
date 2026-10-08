import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ViewTransition, type ReactNode } from 'react';
import { getSiteSettings } from '@/lib/content/public';
import { env } from '@/lib/env';
import { fontVariables } from '@/lib/fonts';
import { dirOf, locales, type Locale } from '@/lib/i18n/config';
import type { Messages } from '@/lib/i18n/messages';
import { PUBLIC_CLIENT_NAMESPACES, pick } from '@/lib/i18n/pick';
import { routing } from '@/lib/i18n/routing';
import { loadMessages } from '@/lib/i18n/messages';
import { Cursor } from '@/components/motion/cursor';
import { InkLoader } from '@/components/motion/ink-loader';
import { loaderBootScript } from '@/components/motion/loader-boot';
import { ApplyPrompt } from '@/components/site/apply-prompt';
import { CookieConsent } from '@/components/site/cookie-consent';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { ViewTransitionGuard } from '@/components/motion/view-transition-guard';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { IllustrationDefs } from '@/components/site/ingredients';
import { LangSuggest } from '@/components/site/lang-suggest';
import { WhatsappFab } from '@/components/site/whatsapp-fab';
import { Toaster } from '@/components/ui/misc';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: '#F3EEE4',
  colorScheme: 'light',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: t('defaultTitle'), template: t('titleTemplate') },
    description: t('defaultDescription'),
    applicationName: t('siteName'),
    formatDetection: { telephone: false },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [messages, settings] = await Promise.all([getMessages(), getSiteSettings(locale)]);
  const clientMessages = pick(messages as Messages, PUBLIC_CLIENT_NAMESPACES);
  // The language suggestion is shown in the *suggested* language, so it needs all four.
  const langStrings = Object.fromEntries(
    await Promise.all(locales.map(async (l) => [l, (await loadMessages(l)).lang] as const)),
  ) as Record<Locale, Messages['lang']>;
  const dir = dirOf(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      data-surface="site"
      className={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-paper grain">
        {/* First thing in <body>: decides before the first paint whether the loader plays. Sent
            as raw HTML inside a hidden wrapper: the browser runs it while parsing the page, and
            React never creates a <script> element itself (which it warns about on re-render). */}
        <div
          hidden
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: `<script>${loaderBootScript}</script>` }}
        />
        {/* without JavaScript the headline does not wait for the loader */}
        <noscript>
          <style>
            {'.kin-unit{animation-play-state:running!important}.ink-loader{display:none}'}
          </style>
        </noscript>
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          <IllustrationDefs />
          <a
            href="#main"
            className="fixed start-3 top-3 z-[130] -translate-y-24 rounded-pill bg-ink px-4 py-2 text-ui font-semibold text-paper transition-transform focus:translate-y-0"
          >
            {(messages as Messages).nav.skipToContent}
          </a>
          <InkLoader />
          <Header contact={settings.contact} />
          {/* Starts the page transition; the animation itself is on the root snapshot (globals.css). */}
          <ViewTransition name="page-content" default="auto">
            <main id="main" tabIndex={-1} data-vt-fold className="outline-none">
              {children}
            </main>
          </ViewTransition>
          <Footer contact={settings.contact} />
          <WhatsappFab number={settings.contact.whatsapp} />
          <LangSuggest strings={langStrings} />
          <CookieConsent />
          <ApplyPrompt />
          <Cursor />
          <SmoothScroll />
          <ViewTransitionGuard />
          <Toaster dir={dir} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
