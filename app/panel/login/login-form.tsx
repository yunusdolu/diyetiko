'use client';

import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import {
  portalLoginAction,
  setPortalLocaleAction,
  type PortalLoginState,
} from '@/app/panel/_actions';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { cn, whatsappHref } from '@/lib/utils';
import { Field } from '@/components/ui/field';
import { MotionButton } from '@/components/ui/motion-button';

export function LoginForm({
  locale,
  whatsapp,
  closed,
  asDietitian,
}: {
  locale: Locale;
  whatsapp: string;
  closed: boolean;
  /** a dietitian is signed in on this browser */
  asDietitian?: boolean;
}) {
  const t = useTranslations('portal.auth');
  const tl = useTranslations('lang');
  const [state, action, pending] = useActionState<PortalLoginState, FormData>(
    portalLoginAction,
    undefined,
  );
  const [switching, startSwitch] = useTransition();

  return (
    <div>
      <LanguagePicker
        current={locale}
        label={tl('label')}
        busy={switching}
        onPick={(l) => startSwitch(() => setPortalLocaleAction(l))}
      />
      <h1 className="mt-8 font-display text-[clamp(2.5rem,8vw,3.5rem)] leading-[0.95] tracking-[-0.03em] lg:sr-only ar:leading-[1.3] ar:font-bold ar:tracking-normal">
        {t('loginTitle')}
      </h1>
      <p className="mt-4 text-body text-ink-70">{t('loginLead')}</p>

      {asDietitian && (
        <p className="mt-6 rounded-[12px] bg-paper-2 px-4 py-3 text-[0.875rem] leading-relaxed text-ink-70">
          {t('asDietitian')}{' '}
          <NextLink href="/admin" className="font-semibold text-ink underline underline-offset-4">
            {t('toAdmin')}
          </NextLink>
        </p>
      )}
      {closed && (
        <p
          role="alert"
          className="mt-6 border-s-2 border-paprika-deep ps-3 text-ui font-semibold text-paprika-deep"
        >
          {t('closed')}
        </p>
      )}

      <form action={action} className="mt-8 grid gap-6" noValidate>
        <Field
          label={t('email')}
          name="email"
          type="email"
          autoComplete="username"
          required
          dir="ltr"
          inputMode="email"
        />
        <Field
          label={t('password')}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
        />
        {state?.error && (
          <p role="alert" className="text-ui font-semibold text-paprika-deep">
            {t(state.error)}
          </p>
        )}
        <div>
          <MotionButton
            type="submit"
            size="lg"
            state={pending ? 'loading' : 'idle'}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            {t('submit')}
          </MotionButton>
        </div>
      </form>

      <details className="group mt-10 border-t border-ink/15 pt-5">
        <summary className="cursor-pointer list-none text-ui font-semibold underline-offset-4 hover:underline">
          {t('forgot')}
        </summary>
        <p className="mt-3 text-[0.9375rem] text-ink-70">{t('forgotBody')}</p>
        <a
          href={whatsappHref(whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-11 items-center rounded-pill bg-paprika px-5 text-ui font-semibold text-ink"
        >
          {t('whatsapp')}
        </a>
      </details>
    </div>
  );
}

/** Before sign-in the portal doesn't know the client's language yet: let them pick it. */
export function LanguagePicker({
  current,
  label,
  busy,
  onPick,
}: {
  current: Locale;
  label: string;
  busy?: boolean;
  onPick: (l: Locale) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap gap-1.5', busy && 'opacity-60')}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === current}
          onClick={() => l !== current && onPick(l)}
          className={cn(
            'h-9 rounded-pill border-[1.5px] px-3.5 text-[0.8125rem] font-semibold transition-colors',
            l === current ? 'border-ink bg-ink text-paper' : 'border-ink/20 hover:border-ink',
          )}
        >
          {localeNames[l]}
        </button>
      ))}
    </div>
  );
}
