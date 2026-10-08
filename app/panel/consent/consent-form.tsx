'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { consentAction, portalLogoutAction, type ConsentState } from '@/app/panel/_actions';
import { Checkbox } from '@/components/ui/checkbox';
import { MotionButton } from '@/components/ui/motion-button';
import { ConsentText } from '@/components/portal/consent-text';

export function ConsentForm({ firstName }: { firstName: string }) {
  const t = useTranslations('portal');
  const [state, action, pending] = useActionState<ConsentState, FormData>(consentAction, undefined);
  const [checked, setChecked] = useState(false);
  return (
    <div>
      <h1 className="sr-only">{t('auth.consentTitle')}</h1>
      <p className="font-display text-[clamp(2.2rem,7vw,3rem)] leading-[1] tracking-[-0.02em] ar:leading-[1.3] ar:font-bold">
        {t('auth.inviteTitle', { name: firstName })}
      </p>
      <p className="mt-4 text-body text-ink-70">{t('auth.consentLead')}</p>
      <form action={action} className="mt-8 grid gap-6">
        <div className="rounded-[14px] border-[1.5px] border-ink/15 bg-paper-2/60 p-4 sm:p-5">
          <ConsentText />
          <Checkbox
            className="mt-4"
            name="consent"
            label={t('auth.consentCheck')}
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            error={state?.error ? t('auth.consentRequired') : undefined}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <MotionButton
            type="submit"
            size="lg"
            state={pending ? 'loading' : 'idle'}
            disabled={pending || !checked}
          >
            {t('auth.continue')}
          </MotionButton>
          <button
            type="submit"
            formAction={portalLogoutAction}
            className="text-ui font-semibold underline underline-offset-4"
          >
            {t('nav.logout')}
          </button>
        </div>
      </form>
    </div>
  );
}
