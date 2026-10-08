'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { submitContact, submitProfessional } from '@/app/actions/leads';
import type { Locale } from '@/lib/i18n/config';
import { Link } from '@/lib/i18n/navigation';
import { dur, ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { contactSchema, professionalSchema, type LeadResult } from '@/lib/validators/lead';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, TextArea } from '@/components/ui/field';
import { MotionButton } from '@/components/ui/motion-button';
import { Tabs } from '@/components/ui/tabs';
import type { ActionState } from '@/components/ui/status-icon';

type Kind = 'contact' | 'professional';

type Values = {
  name: string;
  email: string;
  phone: string;
  message: string;
  preferred: 'whatsapp' | 'phone' | 'email';
  profession: string;
  organization: string;
  consent: boolean;
  website: string;
  locale: Locale;
};

/**
 * Contact / collaboration form. Client validation mirrors the server schema; the server action
 * is the source of truth. States: idle → loading (spinner) → success (check + panel) / error
 * (shake + message). A honeypot field is visually hidden and skipped by assistive tech.
 */
export function ContactForm({
  kind = 'contact',
  tone = 'light',
}: {
  kind?: Kind;
  tone?: 'light' | 'dark';
}) {
  const t = useTranslations('form');
  const tc = useTranslations('contact');
  const tp = useTranslations('pros');
  const tcm = useTranslations('common');
  const locale = useLocale() as Locale;
  const [state, setState] = useState<ActionState>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentName, setSentName] = useState<string | null>(null);
  const dark = tone === 'dark';

  const schema = kind === 'contact' ? contactSchema : professionalSchema;
  const form = useForm<Values>({
    // The resolver validates with the same zod schema the server uses.
    resolver: zodResolver(schema as never) as never,
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      message: '',
      preferred: 'whatsapp',
      profession: '',
      organization: '',
      consent: false,
      website: '',
      locale,
    },
  });
  const { register, handleSubmit, formState, setValue, reset, setError, control } = form;
  const watched = useWatch({ control });
  const preferred = useWatch({ control, name: 'preferred' });
  const err = (name: keyof Values) => {
    const code = formState.errors[name]?.message;
    return code ? t(`errors.${code}` as 'errors.required') : undefined;
  };
  const valid = (name: keyof Values) =>
    Boolean(formState.touchedFields[name] && !formState.errors[name] && watched[name]);

  const onSubmit = handleSubmit(async (values) => {
    setState('loading');
    setServerError(null);
    let res: LeadResult;
    try {
      res = kind === 'contact' ? await submitContact(values) : await submitProfessional(values);
    } catch {
      res = { ok: false, error: 'generic' };
    }
    if (res.ok) {
      setState('success');
      window.setTimeout(() => setSentName(values.name), 650);
      return;
    }
    setState('error');
    if (res.fieldErrors)
      for (const [k, v] of Object.entries(res.fieldErrors))
        setError(k as keyof Values, { message: v });
    setServerError(
      res.error === 'rateLimited'
        ? t('errors.rateLimited')
        : res.error === 'generic'
          ? t('errors.generic')
          : null,
    );
    window.setTimeout(() => setState('idle'), 1400);
  });

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        {sentName ? (
          <motion.div
            key="done"
            role="status"
            className={cn('py-10', dark ? 'text-paper' : 'text-ink')}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.lg, ease: ease.out } }}
            exit={{ opacity: 0 }}
          >
            <svg viewBox="0 0 80 80" className="size-20" aria-hidden>
              <motion.circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke={dark ? 'var(--color-citrus)' : 'var(--color-ink)'}
                strokeWidth="4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: ease.inOut }}
              />
              <motion.path
                d="M24 41l11 11 21-24"
                fill="none"
                stroke={dark ? 'var(--color-citrus)' : 'var(--color-ink)'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.6, ease: ease.out }}
              />
            </svg>
            <p className="mt-6 font-display text-display-md ar:font-bold">
              {kind === 'contact' ? tc('successTitle') : tp('successTitle')}
            </p>
            <p className={cn('mt-3 max-w-md text-lead', dark ? 'text-sage' : 'text-ink-70')}>
              {kind === 'contact' ? tc('successBody', { name: sentName }) : tp('successBody')}
            </p>
            <button
              type="button"
              onClick={() => {
                reset();
                setSentName(null);
                setState('idle');
              }}
              className={cn(
                'mt-8 text-ui font-semibold underline underline-offset-4',
                dark ? 'text-citrus' : 'text-ink',
              )}
            >
              {tc('another')}
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            noValidate
            onSubmit={onSubmit}
            className="grid gap-7"
            exit={{ opacity: 0, y: -10, transition: { duration: 0.25 } }}
          >
            <Field
              label={t('name')}
              autoComplete="name"
              tone={tone}
              error={err('name')}
              valid={valid('name')}
              {...register('name')}
            />
            {kind === 'professional' && (
              <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
                <Field
                  label={t('profession')}
                  tone={tone}
                  error={err('profession')}
                  valid={valid('profession')}
                  {...register('profession')}
                />
                <Field
                  label={`${t('organization')} (${tcm('optional')})`}
                  tone={tone}
                  error={err('organization')}
                  {...register('organization')}
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
              <Field
                label={t('email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                tone={tone}
                error={err('email')}
                valid={valid('email')}
                {...register('email')}
              />
              <Field
                label={t('phone')}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                tone={tone}
                error={err('phone')}
                valid={valid('phone')}
                {...register('phone')}
              />
            </div>
            <TextArea
              label={t('message')}
              rows={4}
              tone={tone}
              error={err('message')}
              valid={valid('message')}
              {...register('message')}
            />

            {kind === 'contact' && (
              <fieldset>
                <legend
                  className={cn(
                    'mb-3 text-[0.8125rem] font-semibold',
                    dark ? 'text-sage' : 'text-ink-60',
                  )}
                >
                  {t('preferred')}
                </legend>
                <Tabs
                  label={t('preferred')}
                  tone={tone}
                  value={preferred}
                  onChange={(v) => setValue('preferred', v)}
                  items={[
                    { value: 'whatsapp', label: t('preferredWhatsapp') },
                    { value: 'phone', label: t('preferredPhone') },
                    { value: 'email', label: t('preferredEmail') },
                  ]}
                />
              </fieldset>
            )}

            {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
            <div aria-hidden className="sr-only">
              <label>
                {t('honeypot')}
                <input tabIndex={-1} autoComplete="off" {...register('website')} />
              </label>
            </div>

            <Checkbox
              tone={tone}
              checked={Boolean(watched.consent)}
              error={err('consent')}
              label={
                <>
                  {t('consent')}{' '}
                  <Link
                    href="/legal/kvkk"
                    className="font-semibold underline underline-offset-4"
                    target="_blank"
                  >
                    {t('consentLink')}
                  </Link>
                </>
              }
              {...register('consent')}
            />

            <div className="flex flex-wrap items-center gap-5">
              <MotionButton
                type="submit"
                size="lg"
                tone={dark ? 'citrus' : 'ink'}
                state={state}
                disabled={state === 'loading' || state === 'success'}
              >
                {tcm('send')}
              </MotionButton>
              <AnimatePresence>
                {serverError && (
                  <motion.p
                    role="alert"
                    className={cn(
                      'text-ui font-semibold',
                      dark ? 'text-paprika' : 'text-paprika-deep',
                    )}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {serverError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
