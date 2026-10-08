'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  changePortalPasswordAction,
  portalLogoutAction,
  setPortalLocaleAction,
  withdrawConsentAction,
} from '@/app/panel/_actions';
import type { Locale } from '@/lib/i18n/config';
import { LanguagePicker } from '@/app/panel/login/login-form';
import { Field } from '@/components/ui/field';
import { MotionButton } from '@/components/ui/motion-button';
import { Overlay } from '@/components/ui/overlay';
import { LogoutIcon } from './icons';

export function PortalLanguage({ current }: { current: Locale }) {
  const tl = useTranslations('lang');
  const [busy, start] = useTransition();
  return (
    <LanguagePicker
      current={current}
      label={tl('label')}
      busy={busy}
      onPick={(l) => start(() => setPortalLocaleAction(l))}
    />
  );
}

export function PasswordForm() {
  const t = useTranslations('portal.account');
  const ta = useTranslations('portal.auth');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const pw = String(fd.get('password') ?? '');
        const pw2 = String(fd.get('password2') ?? '');
        setError(null);
        start(async () => {
          const res = await changePortalPasswordAction(pw, pw2);
          if (res.ok) {
            form.current?.reset();
            toast.success(t('passwordSaved'));
          } else {
            const key = ['tooShort', 'mismatch', 'rateLimited'].includes(res.error)
              ? res.error
              : 'failed';
            setError(ta(key as 'tooShort'));
          }
        });
      }}
    >
      {/* lets password managers pair the new password with this account */}
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <Field
        label={t('newPassword')}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        dir="ltr"
        hint={ta('passwordHint')}
      />
      <Field
        label={t('confirmPassword')}
        name="password2"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        dir="ltr"
        error={error ?? undefined}
      />
      <div>
        <MotionButton type="submit" state={pending ? 'loading' : 'idle'} disabled={pending}>
          {t('password')}
        </MotionButton>
      </div>
    </form>
  );
}

export function WithdrawConsent() {
  const t = useTranslations('portal.account');
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center rounded-pill border-[1.5px] border-paprika-deep px-5 text-ui font-semibold text-paprika-deep transition-colors hover:bg-paprika-deep hover:text-paper"
      >
        {t('withdraw')}
      </button>
      <Overlay
        open={open}
        onOpenChange={setOpen}
        title={t('withdraw')}
        description={t('withdrawBody')}
      >
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-11 items-center rounded-pill border-[1.5px] border-ink px-5 text-ui font-semibold"
          >
            {t('cancel')}
          </button>
          <MotionButton
            type="button"
            state={pending ? 'loading' : 'idle'}
            disabled={pending}
            tone="paprika"
            onClick={() => start(() => withdrawConsentAction())}
          >
            {t('withdrawConfirm')}
          </MotionButton>
        </div>
      </Overlay>
    </>
  );
}

export function LogoutButton() {
  const t = useTranslations('portal.account');
  return (
    <form action={portalLogoutAction}>
      <button
        type="submit"
        className="inline-flex h-11 items-center gap-2 rounded-pill border-[1.5px] border-ink px-5 text-ui font-semibold transition-colors hover:bg-ink hover:text-paper"
      >
        <LogoutIcon size={18} className="mirror-rtl" />
        {t('logout')}
      </button>
    </form>
  );
}
