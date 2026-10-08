import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import type { FigureKind } from '@/components/guide/figure';
import { HelpView, type HelpLabels } from '@/components/guide/help-view';
import { PortalHeader, PortalPage } from '@/components/portal/shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.help');
  return { title: t('title') };
}

/** one topic per page of the portal, in the menu's order */
const TOPICS = [
  { key: 'today', href: '/panel', figure: 'today' },
  { key: 'program', href: '/panel/program', figure: 'plan' },
  { key: 'diary', href: '/panel/diary', figure: 'diary' },
  { key: 'progress', href: '/panel/progress', figure: 'chart' },
  { key: 'week', href: '/panel/week', figure: 'chart' },
  { key: 'messages', href: '/panel/messages', figure: 'chat' },
  { key: 'care', href: '/panel/care', figure: 'care' },
  { key: 'files', href: '/panel/files', figure: 'list' },
  { key: 'shopping', href: '/panel/shopping', figure: 'list' },
  { key: 'account', href: '/panel/account', figure: 'form' },
] as const satisfies readonly { key: string; href: string; figure: FigureKind }[];

/**
 * How to use the portal (DESIGN.md v1.34): always in the menu, so the welcome card can be closed
 * without losing the explanation.
 */
export default async function PortalHelpPage() {
  await requireClient();
  const t = await getTranslations('portal.help');
  const labels: HelpLabels = {
    topics: t('ui.topics'),
    open: t('ui.open'),
    prev: t('ui.prev'),
    next: t('ui.next'),
    step: t.raw('ui.step') as string,
    figure: t('ui.figure'),
  };
  return (
    <PortalPage wide>
      <PortalHeader eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />
      <HelpView
        scope="portal"
        labels={labels}
        topics={TOPICS.map((x) => ({
          ...x,
          title: t(`topics.${x.key}.title`),
          lead: t(`topics.${x.key}.lead`),
          steps: t.raw(`topics.${x.key}.steps`) as string[],
        }))}
      />
    </PortalPage>
  );
}
