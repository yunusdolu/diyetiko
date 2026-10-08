import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { fontVariables } from '@/lib/fonts';
import { dirOf } from '@/lib/i18n/config';
import { loadMessages } from '@/lib/i18n/messages';
import { pick } from '@/lib/i18n/pick';
import { resolveShare } from '@/lib/share';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** The share page speaks the programme's language (not the visitor's). */
export default async function ShareLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const program = await resolveShare(token);
  const locale = program?.language ?? 'tr';
  const messages = await loadMessages(locale);
  return (
    <html lang={locale} dir={dirOf(locale)} className={fontVariables}>
      <body className="min-h-dvh bg-paper grain text-ink">
        <NextIntlClientProvider
          locale={locale}
          messages={pick(messages, ['share', 'meals', 'macros', 'units', 'common'])}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
