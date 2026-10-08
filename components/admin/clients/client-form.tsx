'use client';

import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { createClientAction, updateClientAction } from '@/app/admin/_actions/clients';
import { localeNames, locales } from '@/lib/i18n/config';
import type { ClientRow } from '@/types/admin';
import { Button, Input, Panel, Select, Textarea } from '@/components/admin/ui';
import { Checkbox } from '@/components/ui/checkbox';
import type { ActionState } from '@/components/ui/status-icon';

/** Full client form — create and edit. Medical notes are marked as special-category data. */
export function ClientForm({ client }: { client?: ClientRow }) {
  const t = useTranslations('admin.clients');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const err = (k: string) =>
    errors[k] ? (errors[k] === 'required' ? tc('required') : tc('error')) : undefined;

  const submit = async (form: FormData) => {
    setState('loading');
    const data = Object.fromEntries(form.entries());
    const payload = { ...data, record_consent: consent };
    const res = client
      ? await updateClientAction(client.id, payload)
      : await createClientAction(payload);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setState('error');
      toast.error(tc('error'));
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setErrors({});
    setState('success');
    toast.success(client ? tc('updated') : tc('created'));
    setTimeout(() => setState('idle'), 1200);
    if (!client && 'data' in res && res.data && 'id' in res.data)
      router.push(`/admin/clients/${(res.data as { id: string }).id}`);
    else router.refresh();
  };

  const activities = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
  return (
    <form action={submit} className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Panel title={t('tabs.general')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            name="full_name"
            label={t('fields.fullName')}
            defaultValue={client?.full_name}
            required
            error={err('full_name')}
            className="sm:col-span-2"
          />
          <Input
            name="email"
            type="email"
            dir="ltr"
            label={t('fields.email')}
            defaultValue={client?.email ?? ''}
            error={err('email')}
          />
          <Input
            name="phone"
            type="tel"
            dir="ltr"
            label={t('fields.phone')}
            defaultValue={client?.phone ?? ''}
            error={err('phone')}
          />
          <Input
            name="birth_date"
            type="date"
            label={t('fields.birthDate')}
            defaultValue={client?.birth_date ?? ''}
            error={err('birth_date')}
          />
          <Select
            name="sex"
            label={t('fields.sex')}
            defaultValue={client?.sex ?? ''}
            options={[
              { value: '', label: '—' },
              ...(['female', 'male', 'other'] as const).map((s) => ({
                value: s,
                label: t(`fields.sexOptions.${s}`),
              })),
            ]}
          />
          <Input
            name="height_cm"
            type="number"
            step="0.1"
            inputMode="decimal"
            label={t('fields.height')}
            defaultValue={client?.height_cm ?? ''}
            error={err('height_cm')}
          />
          <Select
            name="activity_level"
            label={t('fields.activity')}
            defaultValue={client?.activity_level ?? ''}
            options={[
              { value: '', label: '—' },
              ...activities.map((a) => ({ value: a, label: t(`fields.activityOptions.${a}`) })),
            ]}
          />
          <Select
            name="preferred_language"
            label={t('fields.preferredLanguage')}
            defaultValue={client?.preferred_language ?? 'tr'}
            options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
          />
          <Select
            name="status"
            label={tc('status')}
            defaultValue={client?.status ?? 'active'}
            options={(['active', 'paused', 'completed', 'archived'] as const).map((s) => ({
              value: s,
              label: t(`status.${s}`),
            }))}
          />
          <Input
            name="tags"
            label={t('fields.tags')}
            hint={t('fields.tagsHint')}
            defaultValue={client?.tags.join(', ') ?? ''}
            className="sm:col-span-2"
          />
          <Input
            name="source"
            label={t('fields.source')}
            defaultValue={client?.source ?? ''}
            className="sm:col-span-2"
          />
        </div>
      </Panel>
      <div className="grid content-start gap-5">
        <Panel title={t('fields.goal')}>
          <div className="grid gap-4">
            <Textarea
              name="goal"
              label={t('fields.goal')}
              rows={3}
              defaultValue={client?.goal ?? ''}
            />
            <Input
              name="goal_weight_kg"
              type="number"
              step="0.1"
              inputMode="decimal"
              label={t('fields.goalWeight')}
              defaultValue={client?.goal_weight_kg ?? ''}
              error={err('goal_weight_kg')}
            />
            <Textarea
              name="allergies"
              label={t('fields.allergies')}
              rows={2}
              defaultValue={client?.allergies ?? ''}
            />
          </div>
        </Panel>
        <Panel title={t('fields.medicalNotes')}>
          <p className="-mt-1 mb-3 rounded-[10px] bg-[color-mix(in_oklab,var(--a-danger)_10%,transparent)] px-3 py-2 text-[0.8125rem] text-a-danger">
            {t('fields.medicalNotesHint')}
          </p>
          <Textarea
            name="medical_notes"
            aria-label={t('fields.medicalNotes')}
            rows={4}
            defaultValue={client?.medical_notes ?? ''}
          />
        </Panel>
        <Panel title={t('fields.consent')}>
          {client?.kvkk_consent_at ? (
            <p className="text-[0.875rem]">
              <span className="font-semibold text-a-ok">{t('fields.consentGiven')}</span>
              <span className="block text-a-muted">
                {t('fields.consentAt', {
                  date: format.dateTime(new Date(client.kvkk_consent_at), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}{' '}
                · {client.kvkk_consent_version}
              </span>
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-[0.875rem] text-a-danger">{t('fields.consentMissing')}</p>
              <Checkbox
                label={t('fields.consentRecord')}
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
            </div>
          )}
        </Panel>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" state={state}>
            {tc('save')}
          </Button>
        </div>
      </div>
    </form>
  );
}
