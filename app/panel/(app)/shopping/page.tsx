import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireClient } from '@/lib/auth';
import * as portal from '@/lib/portal/data';
import { PortalCard as Card } from '@/components/portal/card';
import { PortalHeader, PortalPage } from '@/components/portal/shell';
import { ShoppingList } from '@/components/portal/shopping-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal.shopping');
  return { title: t('title') };
}

/** The active programme's foods as a list to shop from (DESIGN.md v1.35). */
export default async function ShoppingPage() {
  const { user } = await requireClient();
  const t = await getTranslations('portal.shopping');
  const tp = await getTranslations('portal.today');
  const program = await portal.getProgram(user.id);
  return (
    <PortalPage wide>
      <PortalHeader help="shopping" eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />
      {program && program.days.some((d) => d.meals.some((m) => m.items.length)) ? (
        <ShoppingList
          program={{ id: program.id, days: program.days }}
          dayLabels={program.days.map((d, i) => d.label ?? tp('planDay', { n: i + 1 }))}
        />
      ) : (
        <Card title={t('list')}>
          <p className="text-[0.9375rem] text-ink-60">{t('empty')}</p>
        </Card>
      )}
    </PortalPage>
  );
}
