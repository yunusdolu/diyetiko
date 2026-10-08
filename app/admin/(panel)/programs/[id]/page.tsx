import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getClient } from '@/lib/admin/clients';
import { clientOptions, foodOptions, getProgramTree, recipeOptions } from '@/lib/admin/programs';
import { requireUser } from '@/lib/auth';
import { ProgramBuilder } from '@/components/admin/programs/builder';

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const tree = await getProgramTree(user.id, id);
  if (!tree) notFound();
  // Food and recipe names come in the PROGRAMME language: they are snapshotted into items.
  const [foods, recipes, clients, client] = await Promise.all([
    foodOptions(user.id, tree.language),
    recipeOptions(user.id, tree.language),
    clientOptions(user.id),
    tree.client_id ? getClient(user.id, tree.client_id, { audit: false }) : Promise.resolve(null),
  ]);
  const ts = await getTranslations({ locale: tree.language, namespace: 'admin.share' });
  return (
    <ProgramBuilder
      tree={tree}
      foods={foods}
      recipes={recipes}
      clients={clients}
      clientPhone={client?.phone ?? null}
      shareStrings={{
        messageTemplate: ts.raw('messageTemplate') as string,
        subject: ts('subject'),
      }}
    />
  );
}
