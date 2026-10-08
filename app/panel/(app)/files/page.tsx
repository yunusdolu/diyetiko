import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import { schemaFeatures } from '@/lib/db/features';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import { PORTAL_TZ } from '@/lib/portal/logic';
import { FileChip } from '@/components/ui/file-chip';
import { PortalCard as Card } from '@/components/portal/card';
import { PortalHeader, PortalPage } from '@/components/portal/shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.files');
  return { title: t('title') };
}

/**
 * Every file exchanged with the dietitian, out of the conversation and in one list (DESIGN.md
 * v1.35): what the client sent (lab reports, photos) and what the dietitian sent. Each opens
 * through the same auth-checked route as in the messages.
 */
export default async function FilesPage() {
  const { user } = await requireClient();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const il = intlLocale(locale);
  const t = await getTranslations('portal.files');
  const [messages, features] = await Promise.all([
    portal.getMessages(user.id, 200),
    schemaFeatures(user.id),
  ]);
  const files = messages.filter((m) => m.file_name && m.file_mime).reverse();
  const groups = [
    { key: 'mine', items: files.filter((m) => m.author === 'client') },
    { key: 'theirs', items: files.filter((m) => m.author === 'dietitian') },
  ] as const;
  const when = new Intl.DateTimeFormat(il, { dateStyle: 'medium', timeZone: PORTAL_TZ });

  return (
    <PortalPage wide>
      <PortalHeader
        help="files"
        eyebrow={t('eyebrow')}
        title={t('title')}
        lead={t('lead')}
        actions={
          features.uploads ? (
            <Link
              href="/panel/messages"
              className="inline-flex h-10 items-center rounded-pill bg-ink px-4 text-[0.875rem] font-semibold text-paper transition-colors hover:bg-green"
            >
              {t('send')}
            </Link>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <Card
            key={g.key}
            title={t(`groups.${g.key}`)}
            action={
              <span className="num text-[0.8125rem] font-semibold text-ink-60">
                {g.items.length}
              </span>
            }
          >
            {!g.items.length ? (
              <p className="text-[0.9375rem] text-ink-60">{t(`empty.${g.key}`)}</p>
            ) : (
              <ul className="space-y-2.5">
                {g.items.map((m) => (
                  <li key={m.id} className="min-w-0">
                    <FileChip
                      href={`/api/portal/attachment/${m.id}`}
                      name={m.file_name!}
                      mime={m.file_mime!}
                      size={m.file_size}
                      locale={il}
                      openLabel={t('open')}
                      compact
                    />
                    <p className="mt-1 px-1 text-[0.75rem] text-ink-60">
                      {when.format(new Date(m.created_at))}
                      {m.body && m.body !== m.file_name ? (
                        <>
                          {' · '}
                          <bdi>{m.body.slice(0, 80)}</bdi>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </PortalPage>
  );
}
