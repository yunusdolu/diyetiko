import { getLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { ViewTransition, type ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { asUser } from '@/lib/db';
import { backend } from '@/lib/env';
import type { Locale } from '@/lib/i18n/config';
import { AdminShell } from '@/components/admin/shell';
import { ViewTransitionGuard } from '@/components/motion/view-transition-guard';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [counts, clients] = await asUser(user.id, async (tx) => {
    // started together: pipelined in one round trip
    const [[c], list] = await Promise.all([
      tx.query<{ leads: number; unread: number }>(
        `select (select count(*)::int from leads where status = 'new') as leads,
                (select count(*)::int from messages where author = 'client' and read_at is null) as unread`,
      ),
      tx.query<{ id: string; full_name: string }>(
        `select id, full_name from clients where deleted_at is null order by full_name`,
      ),
    ]);
    return [c ?? { leads: 0, unread: 0 }, list] as const;
  });
  const locale = (await getLocale()) as Locale;
  const jar = await cookies();
  const theme = jar.get('admin_theme')?.value === 'dark' ? 'dark' : 'light';
  const sidebar = jar.get('admin_sidebar')?.value === 'collapsed' ? 'collapsed' : 'expanded';
  return (
    <AdminShell
      email={user.email}
      newLeads={counts.leads}
      unread={counts.unread}
      clients={clients}
      locale={locale}
      theme={theme}
      localMode={backend() === 'local'}
      sidebar={sidebar}
    >
      <ViewTransitionGuard />
      <ViewTransition name="admin-content" default="auto">
        <div data-vt-fold>{children}</div>
      </ViewTransition>
    </AdminShell>
  );
}
