'use client';

import { PlainLink } from '@/components/ui/plain-link';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef, useState } from 'react';
import { loginAction, verifyMfaAction, type LoginState } from '../_actions/auth';
import { ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Field } from '@/components/ui/field';
import { MotionButton } from '@/components/ui/motion-button';
import type { ActionState } from '@/components/ui/status-icon';

/**
 * Sign-in, then (when the account has a second factor) the six-digit code. The password can be
 * shown, Caps Lock is pointed out, and the code accepts a paste of all six digits.
 */
export function LoginForm({
  initialMfa,
  localHint,
}: {
  initialMfa: boolean;
  localHint: string | null;
}) {
  const t = useTranslations('admin.login');
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const [mfaState, mfaAction, mfaPending] = useActionState<LoginState, FormData>(
    verifyMfaAction,
    undefined,
  );
  const mfa = initialMfa || state?.mfa || mfaState?.mfa;
  const [btn, setBtn] = useState<ActionState>('idle');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);

  useEffect(() => {
    // Mirror the server result onto the button: spinner while pending, shake on error.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pending || mfaPending) setBtn('loading');
    else if (state?.error || mfaState?.error) {
      setBtn('error');
      const id = window.setTimeout(() => setBtn('idle'), 900);
      return () => window.clearTimeout(id);
    } else setBtn('idle');
  }, [pending, mfaPending, state, mfaState]);

  const error = mfa ? mfaState?.error : state?.error;
  const message =
    error === 'rateLimited'
      ? t('rateLimited')
      : error === 'mfa'
        ? t('mfaError')
        : error
          ? t('error')
          : null;

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {!mfa ? (
          <motion.form
            key="pw"
            action={action}
            className="grid gap-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: ease.out } }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
          >
            <div>
              <h1 className="font-display text-[clamp(2.5rem,8vw,3.5rem)] leading-[0.95] tracking-[-0.03em] ar:leading-[1.3] ar:font-bold ar:tracking-normal">
                {t('title')}
              </h1>
              <p className="mt-3 text-body text-ink-70">{t('lead')}</p>
            </div>
            <Field
              name="email"
              type="email"
              label={t('email')}
              autoComplete="username"
              inputMode="email"
              required
              dir="ltr"
            />
            <div>
              <Field
                name="password"
                type={show ? 'text' : 'password'}
                label={t('password')}
                autoComplete="current-password"
                required
                dir="ltr"
                onKeyDown={(e) => setCaps(e.getModifierState('CapsLock'))}
                onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-pressed={show}
                    className="mb-2 rounded-pill px-2.5 py-1 text-[0.75rem] font-semibold text-ink-70 hover:bg-ink/8 hover:text-ink"
                  >
                    {show ? t('hide') : t('show')}
                  </button>
                }
              />
              <AnimatePresence initial={false}>
                {caps && (
                  <motion.p
                    className="mt-2 text-[0.8125rem] font-semibold text-paprika-deep"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {t('capsLock')}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            {message && (
              <p role="alert" className="text-ui font-semibold text-paprika-deep">
                {message}
              </p>
            )}
            <MotionButton type="submit" size="lg" state={btn} disabled={pending} className="w-full">
              {t('submit')}
            </MotionButton>
            {localHint && (
              <p className="rounded-[12px] bg-paper-2 px-4 py-2.5 text-[0.8125rem] text-ink-70">
                {localHint}
              </p>
            )}
            <p className="border-t border-ink/15 pt-5 text-[0.875rem] text-ink-70">
              {t('clientQuestion')}{' '}
              <PlainLink
                href="/panel/login"
                className="font-semibold text-ink underline underline-offset-4"
              >
                {t('clientLink')}
              </PlainLink>
            </p>
          </motion.form>
        ) : (
          <motion.form
            key="mfa"
            action={mfaAction}
            className="grid gap-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: ease.out } }}
            exit={{ opacity: 0 }}
          >
            <div>
              <h1 className="font-display text-[clamp(2.25rem,7vw,3rem)] leading-[0.95] tracking-[-0.03em] ar:leading-[1.3] ar:font-bold">
                {t('mfaTitle')}
              </h1>
              <p className="mt-3 text-body text-ink-70">{t('mfaLead')}</p>
            </div>
            <CodeBoxes label={t('mfaCode')} error={Boolean(message)} />
            {message && (
              <p role="alert" className="text-ui font-semibold text-paprika-deep">
                {message}
              </p>
            )}
            <MotionButton
              type="submit"
              size="lg"
              state={btn}
              disabled={mfaPending}
              className="w-full"
            >
              {t('mfaSubmit')}
            </MotionButton>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Six boxes for the authenticator code, backed by ONE real input (name="code"): typing, deleting,
 * pasting and one-time-code autofill all work as in a normal field; the boxes only draw it.
 */
function CodeBoxes({ label, error }: { label: string; error: boolean }) {
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <div>
      <label htmlFor="mfa-code" className="mb-3 block text-[0.8125rem] font-semibold">
        {label}
      </label>
      <div className="relative" dir="ltr" onClick={() => input.current?.focus()}>
        <input
          ref={input}
          id="mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
          aria-invalid={error || undefined}
        />
        <div className="grid grid-cols-6 gap-2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => {
            const active = focused && (i === code.length || (i === 5 && code.length === 6));
            return (
              <span
                key={i}
                className={cn(
                  'relative grid h-16 place-items-center rounded-[14px] border-[1.5px] num text-[1.75rem] transition-colors duration-150',
                  error ? 'border-paprika-deep' : active ? 'border-ink' : 'border-ink/20',
                  code[i] && 'bg-paper-2',
                )}
              >
                <AnimatePresence initial={false}>
                  {code[i] && (
                    <motion.span
                      key={code[i] + i}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {code[i]}
                    </motion.span>
                  )}
                </AnimatePresence>
                {active && !code[i] && (
                  <span className="rounded absolute h-7 w-[2px] animate-pulse bg-ink" />
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
