import { getTranslations } from 'next-intl/server';
import { clientOptions, listPrograms } from '@/lib/admin/programs';
import { requireUser } from '@/lib/auth';
import { ProgramsView } from '@/components/admin/programs/programs-view';

export async function generateMetadata() {
  const t = await getTranslations('admin.programs');
  return { title: t('title') };
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; client?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const [programs, clients] = await Promise.all([listPrograms(user.id), clientOptions(user.id)]);
  return (
    <ProgramsView
      programs={programs}
      clients={clients}
      openNew={sp.new === '1'}
      presetClient={sp.client ?? null}
    />
  );
}
