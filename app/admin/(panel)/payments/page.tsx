import { getTranslations } from 'next-intl/server';
import { practiceLedger } from '@/lib/admin/practice';
import { requireUser } from '@/lib/auth';
import { todayISO } from '@/lib/portal/logic';
import { PaymentsView } from '@/components/admin/payments-view';

export async function generateMetadata() {
  const t = await getTranslations('admin.payments');
  return { title: t('title') };
}

export default async function PaymentsPage() {
  const user = await requireUser();
  const today = todayISO();
  const ledger = await practiceLedger(user.id, today);
  return <PaymentsView ledger={ledger} today={today} />;
}
