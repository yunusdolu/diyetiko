'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { redeemInviteAction, type InviteState } from '@/app/panel/_actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { MotionButton } from '@/components/ui/motion-button';
import { ConsentText } from '@/components/portal/consent-text';

export function InviteForm({
  token,
  purpose,
  firstName,
  email,
}: {
  token: string;
  purpose: 'invite' | 'reset';
  firstName: string;
  email: string;
}) {
  const t = useTranslations('portal.auth');
  const [state, action, pending] = useActionState<InviteState, FormData>(
    redeemInviteAction,
    undefined,
  );
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [consent, setConsent] = useState(false);
  const invite = purpose === 'invite';
  const mismatch = pw2.length > 0 && pw !== pw2;
  const error = state?.error;

  return (
    <div>
      <h1 className="font-display text-[clamp(2.4rem,8vw,3.4rem)] leading-[0.95] tracking-[-0.03em] lg:sr-only ar:leading-[1.3] ar:font-bold ar:tracking-normal">
        {t(invite ? 'inviteTitle' : 'resetTitle', { name: firstName })}
      </h1>
      <p className="mt-4 text-body text-ink-70">
        {invite ? t('inviteLead') : t('resetLead', { name: firstName })}
      </p>
      {email && (
        // FSI…PDI isolates the (left-to-right) address inside a right-to-left sentence.
        <p className="mt-3 text-[0.875rem] text-ink-60">{t('account', { email: `⁨${email}⁩` })}</p>
      )}

      <form action={action} className="mt-8 grid gap-6" noValidate>
        <input type="hidden" name="token" value={token} />
        {/* Username field for password managers (the e-mail is fixed by the invite). */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field
          label={t('newPassword')}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          dir="ltr"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          hint={t('passwordHint')}
          error={error === 'tooShort' ? t('tooShort') : undefined}
          valid={pw.length >= 10}
        />
        <Field
          label={t('confirmPassword')}
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          dir="ltr"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          error={mismatch || error === 'mismatch' ? t('mismatch') : undefined}
          valid={pw2.length >= 10 && pw === pw2}
        />

        {invite && (
          <div className="rounded-[14px] border-[1.5px] border-ink/15 bg-paper-2/60 p-4 sm:p-5">
            <ConsentText />
            <Checkbox
              className="mt-4"
              name="consent"
              label={t('consentCheck')}
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              error={error === 'consent' ? t('consentRequired') : undefined}
            />
          </div>
        )}

        {error && !['tooShort', 'mismatch', 'consent'].includes(error) && (
          <p role="alert" className="text-ui font-semibold text-paprika-deep">
            {error === 'invalid'
              ? t('invalidLink')
              : error === 'exists'
                ? t('exists')
                : error === 'rateLimited'
                  ? t('rateLimited')
                  : t('failed')}
          </p>
        )}

        <div>
          <MotionButton
            type="submit"
            size="lg"
            state={pending ? 'loading' : 'idle'}
            disabled={pending || (invite && !consent)}
            className="w-full sm:w-auto"
          >
            {invite ? t('create') : t('resetSubmit')}
          </MotionButton>
        </div>
      </form>
    </div>
  );
}
