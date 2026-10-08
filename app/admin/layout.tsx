import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { fontVariables } from '@/lib/fonts';
import { dirOf, isLocale } from '@/lib/i18n/config';
import type { Messages } from '@/lib/i18n/messages';
import { pick } from '@/lib/i18n/pick';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/misc';

export const metadata: Metadata = {
  title: { default: 'Mutfak Masası', template: '%s · Mutfak Masası' },
  robots: { index: false, follow: false },
  // installable: from the home screen / dock the panel opens at /admin directly
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Mutfak Masası', statusBarStyle: 'black-translucent' },
  icons: { apple: '/admin/app-icon/180' },
};

export const viewport: Viewport = { themeColor: '#0F1B17' };

export const dynamic = 'force-dynamic';

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = (await getMessages()) as Messages;
  const jar = await cookies();
  const theme = jar.get('admin_theme')?.value === 'dark' ? 'dark' : 'light';
  const safeLocale = isLocale(locale) ? locale : 'tr';
  return (
    <html
      lang={safeLocale}
      dir={dirOf(safeLocale)}
      data-theme={theme}
      data-cut={jar.get('cut') ? '' : undefined}
      className={cn(fontVariables, 'admin-root')}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider
          locale={safeLocale}
          now={new Date()}
          timeZone="Europe/Istanbul"
          messages={pick(messages, [
            'admin',
            'common',
            'macros',
            'units',
            'meals',
            'diet',
            'form',
            'share',
            'meta',
          ])}
        >
          {children}
          {/* phones: above the panel's bottom navigation */}
          <Toaster
            dir={dirOf(safeLocale)}
            theme={theme}
            mobileBottom="calc(6.25rem + env(safe-area-inset-bottom))"
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
