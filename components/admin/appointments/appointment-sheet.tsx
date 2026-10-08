'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { deleteAppointmentAction, saveAppointmentAction } from '@/app/admin/_actions/clients';
import type { Appointment } from '@/types/admin';
import { Button, Input, Select, Sheet, Textarea } from '@/components/admin/ui';
import type { ActionState } from '@/components/ui/status-icon';

/** datetime-local value in the browser's zone for an ISO timestamp. */
function toLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 864e5);
  if (!iso) d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentSheet({
  open,
  onOpenChange,
  appointment,
  clients,
  defaultClientId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointment: Appointment | null;
  clients: { id: string; full_name: string }[];
  defaultClientId?: string;
}) {
  const t = useTranslations('admin.appointments');
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [every, setEvery] = useState('0');
  const [count, setCount] = useState(4);

  const submit = async (form: FormData) => {
    setState('loading');
    const raw = Object.fromEntries(form.entries());
    // datetime-local has no zone: interpret in the browser, send ISO.
    const res = await saveAppointmentAction(appointment?.id ?? null, {
      ...raw,
      starts_at: new Date(String(raw.starts_at)).toISOString(),
    });
    if (!res.ok) {
      setState('error');
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    toast.success(tc('saved'));
    router.refresh();
    setTimeout(() => {
      setState('idle');
      onOpenChange(false);
    }, 400);
  };

  const remove = async () => {
    if (!appointment) return;
    await deleteAppointmentAction(appointment.id);
    toast.success(tc('deleted'));
    router.refresh();
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={appointment ? tc('edit') : t('new')}
      width="sm"
    >
      <form key={appointment?.id ?? 'new'} action={submit} className="grid gap-4">
        <Select
          name="client_id"
          label={t('client')}
          defaultValue={appointment?.client_id ?? defaultClientId ?? ''}
          options={[
            { value: '', label: '—' },
            ...clients.map((c) => ({ value: c.id, label: c.full_name })),
          ]}
        />
        <Input
          name="title"
          label={tc('optional')}
          defaultValue={appointment?.title ?? ''}
          placeholder={t('note')}
        />
        <Input
          name="starts_at"
          type="datetime-local"
          label={t('when')}
          defaultValue={toLocalInput(appointment?.starts_at)}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            name="duration_min"
            type="number"
            min={5}
            max={480}
            label={t('duration')}
            defaultValue={appointment?.duration_min ?? 45}
          />
          <Select
            name="kind"
            label={t('kind')}
            defaultValue={appointment?.kind ?? 'in_person'}
            options={(['in_person', 'online', 'phone'] as const).map((k) => ({
              value: k,
              label: t(`kinds.${k}`),
            }))}
          />
        </div>
        <Select
          name="status"
          label={tc('status')}
          defaultValue={appointment?.status ?? 'scheduled'}
          options={(['scheduled', 'done', 'cancelled', 'no_show'] as const).map((s) => ({
            value: s,
            label: t(`statuses.${s}`),
          }))}
        />
        <Textarea name="note" label={t('note')} rows={3} defaultValue={appointment?.note ?? ''} />
        {!appointment && (
          // weekly check-ins are booked in one go
          <div className="grid grid-cols-2 gap-4">
            <Select
              name="repeat_every"
              label={t('repeat.label')}
              value={every}
              onChange={(e) => setEvery(e.target.value)}
              options={[
                { value: '0', label: t('repeat.none') },
                { value: '7', label: t('repeat.weekly') },
                { value: '14', label: t('repeat.biweekly') },
              ]}
            />
            <Input
              name="repeat_count"
              type="number"
              min={2}
              max={12}
              label={t('repeat.count')}
              value={every === '0' ? 1 : count}
              disabled={every === '0'}
              onChange={(e) => setCount(Math.max(2, Math.min(12, Number(e.target.value) || 2)))}
            />
            {every !== '0' && (
              <p className="col-span-2 -mt-2 text-[0.8125rem] text-a-muted">
                {t('repeat.hint', { n: count })}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-2">
          {appointment ? (
            <Button variant="ghost" onClick={remove} className="text-a-danger">
              {tc('delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
            <Button type="submit" variant="primary" state={state}>
              {tc('save')}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
