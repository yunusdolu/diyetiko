import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import { schemaFeatures } from '@/lib/db/features';
import { intlLocale, isLocale } from '@/lib/i18n/config';
import * as portal from '@/lib/portal/data';
import { PORTAL_TZ } from '@/lib/portal/logic';
import { PortalCard as Card } from '@/components/portal/card';
import { Thread } from '@/components/portal/messages/thread';
import { PortalHeader, PortalPage } from '@/components/portal/shell';
import { FileChip } from '@/components/ui/file-chip';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.messages');
  return { title: t('title') };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string }>;
}) {
  const { user } = await requireClient();
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'tr';
  const il = intlLocale(locale);
  const t = await getTranslations('portal.messages');
  const tr = await getTranslations('portal.msgRail');
  const tk = await getTranslations('portal.appointmentKinds');
  const tf = await getTranslations('portal.files');
  const format = await getFormatter();
  const { meal } = await searchParams;
  const [messages, profile, mealRef, features, appointments] = await Promise.all([
    portal.getMessages(user.id),
    portal.getProfile(user.id),
    meal && UUID.test(meal) ? portal.getMealRef(user.id, meal) : null,
    schemaFeatures(user.id),
    portal.getAppointments(user.id),
  ]);
  const unread = messages.some((m) => m.author === 'dietitian' && !m.read_at);
  const now = new Date();
  const next = appointments
    .filter((a) => a.status === 'scheduled' && new Date(a.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const files = messages
    .filter((m) => m.file_name && m.file_mime)
    .slice(-4)
    .reverse();
  const who = profile?.dietitianName ?? tr('about');
  const initials = who
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toLocaleUpperCase(il);

  return (
    <PortalPage wide>
      <PortalHeader help="messages" eyebrow={t('title')} title={t('title')} lead={t('lead')} />
      {/* the conversation, and beside it (wide screens) who it is with and what was shared */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Thread
            messages={messages}
            dietitianName={profile?.dietitianName ?? null}
            meal={mealRef}
            markRead={unread}
            uploads={features.uploads}
          />
        </div>

        <aside className="hidden gap-4 xl:sticky xl:top-6 xl:grid">
          <section className="p-card p-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="relative grid size-11 shrink-0 place-items-center rounded-full bg-green text-[0.9375rem] font-bold text-paper"
              >
                {initials}
                <span className="absolute -end-0.5 -bottom-0.5 size-3.5 rounded-full bg-citrus ring-2 ring-[var(--p-surface)]" />
              </span>
              <div className="min-w-0">
                <p className="label text-ink-60">{tr('about')}</p>
                <p className="truncate text-[1.0625rem] font-bold">{who}</p>
              </div>
            </div>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-60">{tr('reply')}</p>
            <div className="on-dark mt-4 rounded-[14px] bg-green p-3.5 text-paper">
              <p className="label text-sage">{tr('next')}</p>
              {next ? (
                <p className="mt-1 text-[0.9375rem] leading-snug font-semibold">
                  {new Intl.DateTimeFormat(il, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: PORTAL_TZ,
                  }).format(new Date(next.startsAt))}
                  <span className="block font-normal text-sage">
                    {tk(next.kind)} · {format.relativeTime(new Date(next.startsAt), now)}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-[0.9375rem] text-sage">{tr('noNext')}</p>
              )}
            </div>
          </section>

          <Card
            title={tr('files')}
            action={
              <Link
                href="/panel/files"
                className="text-[0.8125rem] font-semibold underline-offset-4 hover:underline"
              >
                {tr('allFiles')}
              </Link>
            }
          >
            {files.length ? (
              <ul className="space-y-2">
                {files.map((m) => (
                  <li key={m.id}>
                    <FileChip
                      compact
                      href={`/api/portal/attachment/${m.id}`}
                      name={m.file_name!}
                      mime={m.file_mime!}
                      size={m.file_size}
                      locale={il}
                      openLabel={tf('open')}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.9375rem] text-ink-60">{tr('noFiles')}</p>
            )}
          </Card>

          <Card title={tr('tips')}>
            <ul className="space-y-1.5">
              {(tr.raw('tipList') as string[]).map((tip) => (
                <li key={tip} className="p-well px-3.5 py-2.5 text-[0.875rem]">
                  {tip}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.8125rem] font-semibold text-paprika-deep">
              {t('emergency')}
            </p>
          </Card>
        </aside>
      </div>
    </PortalPage>
  );
}
