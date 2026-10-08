import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/lib/i18n/config';
import { Kit } from './kit';

/**
 * Hidden design-system kit. Development only: 404s in production builds and is
 * never linked, listed in the sitemap, or indexed.
 */
export const metadata: Metadata = { title: 'Kit', robots: { index: false, follow: false } };

export default async function KitPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <Kit />;
}
