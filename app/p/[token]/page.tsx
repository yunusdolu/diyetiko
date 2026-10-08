import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSiteSettings } from '@/lib/content/public';
import { intlLocale } from '@/lib/i18n/config';
import { resolveShare } from '@/lib/share';
import { cn, whatsappHref } from '@/lib/utils';
import { BrandMark } from '@/components/site/header';
import { ProgramView } from '@/components/program/program-view';
import { PrintButton } from '@/components/program/program-view-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const p = await resolveShare(token);
  return { title: p ? p.title : '—' };
}

export default async function SharedProgramPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const p = await resolveShare(token);

  if (!p) notFound();

  const locale = p.language;
  const t = await getTranslations({ locale, namespace: 'share' });
  const settings = await getSiteSettings(locale);
  const il = intlLocale(locale, settings.arabicDigits);
  const dateFmt = new Intl.DateTimeFormat(il, { dateStyle: 'long' });
  const start = p.startsOn ? new Date(`${p.startsOn}T12:00:00Z`) : null;

  return (
    <main className={cn('pb-24', !p.allowPdf && 'print-blocked')}>
      <header className="container-x pt-8 pb-10 sm:pt-12">
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-2.5 text-[0.8125rem] font-semibold">
            <BrandMark className="size-7 text-ink" />
            {t('preparedBy')}
          </p>
          {p.allowPdf && <PrintButton label={t('print')} />}
        </div>
        {p.clientFirstName && (
          <p className="mt-10 label text-paprika-deep">{t('for', { name: p.clientFirstName })}</p>
        )}
        <h1
          className={cn(
            'font-display text-[clamp(2.6rem,9vw,6rem)] leading-[0.95] tracking-[-0.03em] ar:leading-[1.25] ar:font-bold ar:tracking-normal',
            !p.clientFirstName && 'mt-10',
          )}
        >
          {p.title}
        </h1>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.875rem] text-ink-70">
          {start && <span>{t('startsOn', { date: dateFmt.format(start) })}</span>}
          <span>{t('updated', { date: dateFmt.format(new Date(p.updatedAt)) })}</span>
        </p>
      </header>

      <ProgramView program={p} arabicDigits={settings.arabicDigits} />

      <footer className="container-x mt-16 space-y-4 border-t border-ink/15 pt-6 text-[0.8125rem] text-ink-70">
        <p>
          {p.expiresAt
            ? t('validUntil', { date: dateFmt.format(new Date(p.expiresAt)) })
            : t('validForever')}
        </p>
        <p>{t('disclaimer')}</p>
        <a
          href={whatsappHref(settings.contact.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="no-print inline-flex h-12 items-center rounded-pill bg-paprika px-5 text-ui font-semibold text-ink"
        >
          {t('questions')}
        </a>
        {!p.allowPdf && <p className="print-only hidden">{t('pdfDisabled')}</p>}
      </footer>
    </main>
  );
}
