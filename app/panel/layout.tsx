import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { fontVariables } from '@/lib/fonts';
import { dirOf, isLocale } from '@/lib/i18n/config';
import type { Messages } from '@/lib/i18n/messages';
import { pick } from '@/lib/i18n/pick';
import { Toaster } from '@/components/ui/misc';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal');
  return {
    title: { default: t('brand'), template: `%s · ${t('brand')}` },
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

// viewport-fit=cover: the bottom tab bar pads itself with env(safe-area-inset-bottom) on phones.
export const viewport: Viewport = {
  themeColor: '#F3EEE4',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export const dynamic = 'force-dynamic';

/** Client portal root: its own document (language = the client's portal language). */
export default async function PortalRootLayout({ children }: { children: ReactNode }) {
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const messages = (await getMessages()) as Messages;
  const jar = await cookies();
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      data-surface="portal"
      data-cut={jar.get('cut') ? '' : undefined}
      data-theme={jar.get('portal_theme')?.value === 'dark' ? 'dark' : 'light'}
      className={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-paper grain text-ink antialiased">
        <NextIntlClientProvider
          locale={locale}
          now={new Date()}
          timeZone="Europe/Istanbul"
          messages={pick(messages, [
            'portal',
            'common',
            'macros',
            'units',
            'meals',
            'share',
            'form',
            'lang',
          ])}
        >
          {children}
          <Toaster dir={dirOf(locale)} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
