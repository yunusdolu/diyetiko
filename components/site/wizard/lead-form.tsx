'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { submitWizardLead } from '@/app/actions/leads';
import type { Locale } from '@/lib/i18n/config';
import type { WizardAnswers } from '@/lib/validators/lead';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { MotionButton } from '@/components/ui/motion-button';
import type { ActionState } from '@/components/ui/status-icon';

/**
 * Saves the wizard answers as a lead ONLY with explicit consent. No medical questions exist in
 * the wizard, so nothing sensitive can be stored here beyond what the visitor typed.
 */
export function WizardLeadForm({ answers, locale }: { answers: WizardAnswers; locale: Locale }) {
  const t = useTranslations('form');
  const tr = useTranslations('wizard.result');
  const tc = useTranslations('common');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<ActionState>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const msg = (code?: string) => (code ? t(`errors.${code}` as 'errors.required') : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    const res = await submitWizardLead({
      name,
      phone,
      email,
      consent,
      website,
      locale,
      answers,
    }).catch(() => ({ ok: false as const, error: 'generic' as const }));
    if (res.ok) {
      setState('success');
      window.setTimeout(() => setDone(true), 600);
      return;
    }
    setErrors(
      'fieldErrors' in res && res.fieldErrors
        ? res.fieldErrors
        : { form: res.error === 'rateLimited' ? 'rateLimited' : 'generic' },
    );
    setState('error');
    window.setTimeout(() => setState('idle'), 1200);
  };

  if (done)
    return (
      <p role="status" className="font-display text-display-md text-citrus ar:font-bold">
        {tr('saved')}
      </p>
    );

  return (
    <form noValidate onSubmit={submit} className="grid gap-7">
      <Field
        tone="dark"
        label={t('name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={msg(errors.name)}
        autoComplete="name"
      />
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
        <Field
          tone="dark"
          label={t('phone')}
          type="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={msg(errors.phone)}
          autoComplete="tel"
        />
        <Field
          tone="dark"
          label={t('email')}
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={msg(errors.email)}
          autoComplete="email"
        />
      </div>
      <div aria-hidden className="sr-only">
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <Checkbox
        tone="dark"
        label={tr('consentSave')}
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        error={msg(errors.consent)}
      />
      {errors.form && (
        <p role="alert" className="text-ui font-semibold text-paprika">
          {msg(errors.form)}
        </p>
      )}
      <div>
        <MotionButton
          type="submit"
          tone="citrus"
          size="lg"
          state={state}
          disabled={state === 'loading'}
        >
          {tc('send')}
        </MotionButton>
      </div>
    </form>
  );
}
