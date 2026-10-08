import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/admin/ui';
import type { FigureKind } from '@/components/guide/figure';
import { HelpView, type HelpLabels } from '@/components/guide/help-view';

export async function generateMetadata() {
  const t = await getTranslations('admin.help');
  return { title: t('title') };
}

/** one topic per section of the panel, in the menu's order; the last has no page of its own */
const TOPICS = [
  { key: 'dashboard', href: '/admin', figure: 'dash' },
  { key: 'clients', href: '/admin/clients', figure: 'list' },
  { key: 'profile', href: '/admin/clients', figure: 'profile' },
  { key: 'invite', href: '/admin/clients', figure: 'invite' },
  { key: 'programs', href: '/admin/programs', figure: 'plan' },
  { key: 'messages', href: '/admin/messages', figure: 'inbox' },
  { key: 'appointments', href: '/admin/appointments', figure: 'calendar' },
  { key: 'payments', href: '/admin/payments', figure: 'dash' },
  { key: 'leads', href: '/admin/leads', figure: 'list' },
  { key: 'explorer', href: '/admin/explorer', figure: 'explorer' },
  { key: 'content', href: '/admin/recipes', figure: 'list' },
  { key: 'settings', href: '/admin/settings', figure: 'form' },
  { key: 'shortcuts', href: null, figure: 'chrome' },
] as const satisfies readonly { key: string; href: string | null; figure: FigureKind }[];

/** How to use the panel (DESIGN.md v1.34): in the menu and the command palette. */
export default async function AdminHelpPage() {
  await requireUser();
  const t = await getTranslations('admin.help');
  const theme = (await cookies()).get('admin_theme')?.value === 'dark' ? 'dark' : 'light';
  const labels: HelpLabels = {
    topics: t('ui.topics'),
    open: t('ui.open'),
    prev: t('ui.prev'),
    next: t('ui.next'),
    step: t.raw('ui.step') as string,
    figure: t('ui.figure'),
  };
  return (
    <>
      <PageTitle eyebrow={t('eyebrow')} title={t('title')} />
      <p className="-mt-3 mb-5 max-w-2xl text-[0.9375rem] leading-relaxed text-a-muted">
        {t('lead')}
      </p>
      <HelpView
        scope="admin"
        theme={theme}
        labels={labels}
        topics={TOPICS.map((x) => ({
          ...x,
          title: t(`topics.${x.key}.title`),
          lead: t(`topics.${x.key}.lead`),
          steps: t.raw(`topics.${x.key}.steps`) as string[],
        }))}
      />
    </>
  );
}
