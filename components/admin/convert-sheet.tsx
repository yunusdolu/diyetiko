'use client';

import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { convertLeadAction } from '@/app/admin/_actions/clients';
import { admin } from '@/lib/motion';
import { PLAN_TERMS, planEndsOn, type PlanTerm } from '@/lib/plans';
import { cn } from '@/lib/utils';
import type { Lead } from '@/types/admin';
import type { ActionState } from '@/components/ui/status-icon';
import { Button, Input, Sheet } from '@/components/admin/ui';

type Choice = PlanTerm | 'none';

/**
 * A request becomes a client — and starts a plan: 3, 6 or 12 months from the day chosen (or none,
 * to add one later under "Paket & ödeme"). The plan is a package with a first and a last day; the
 * client's card and the client's own panel follow it from there.
 */
export function ConvertSheet({
  lead,
  onClose,
}: {
  lead: Pick<Lead, 'id' | 'name' | 'payload'> | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin.plans');
  const tp = useTranslations('plan');
  const tl = useTranslations('admin.leads');
  const tc = useTranslations('admin.common');
  const format = useFormatter();
  const router = useRouter();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(useNow());
  const [picked, setChoice] = useState<Choice | null>(null);
  // an application already says how long the person wants to work together: start from that
  const asked = askedTerm(lead?.payload);
  const choice = picked ?? asked;
  const [startsOn, setStartsOn] = useState(today);
  const [state, setState] = useState<ActionState>('idle');
  const day = (d: string) =>
    format.dateTime(new Date(`${d}T12:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' });
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(startsOn);

  const close = () => {
    setChoice(null);
    setStartsOn(today);
    setState('idle');
    onClose();
  };
  const convert = async () => {
    if (!lead || choice == null) return;
    setState('loading');
    const res = await convertLeadAction(
      lead.id,
      choice === 'none' ? null : { months: choice, startsOn },
    );
    if (!res.ok || !res.data) {
      setState('error');
      toast.error(tc('error'));
      setTimeout(() => setState('idle'), 900);
      return;
    }
    setState('success');
    toast.success(tl('converted'));
    router.push(`/admin/clients/${res.data.id}`);
  };

  const options: Choice[] = [...PLAN_TERMS, 'none'];
  return (
    <Sheet
      open={Boolean(lead)}
      onOpenChange={(o) => !o && close()}
      title={t('convertTitle')}
      description={lead ? t('convertLead', { name: lead.name }) : undefined}
      width="sm"
      footer={
        <>
          <Button onClick={close}>{tc('cancel')}</Button>
          <Button
            variant="primary"
            state={state}
            disabled={choice == null || (choice !== 'none' && !validStart)}
            onClick={convert}
          >
            {t('confirm')}
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-2.5 text-[0.8125rem] font-semibold">{t('choose')}</legend>
        {asked && (
          <p className="-mt-1 mb-2.5 text-[0.8125rem] text-a-muted">
            {t('asked', { term: tp('term', { months: asked }) })}
          </p>
        )}
        <div role="radiogroup" aria-label={t('choose')} className="grid grid-cols-2 gap-2.5">
          {options.map((o, i) => {
            const on = choice === o;
            return (
              <motion.button
                key={o}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChoice(o)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...admin.spring, delay: i * 0.04 }}
                className={cn(
                  'relative flex min-h-[5.25rem] flex-col items-start justify-between rounded-[14px] p-3.5 text-start transition-[box-shadow,background-color]',
                  on
                    ? 'bg-a-text text-a-bg shadow-[var(--a-shadow-raised)]'
                    : 'a-well hover:bg-a-surface-2',
                )}
              >
                <span className="text-[1rem] font-bold">
                  {o === 'none' ? t('none') : tp('term', { months: o })}
                </span>
                <span className={cn('num text-[0.75rem]', on ? 'opacity-80' : 'text-a-muted')}>
                  {o === 'none'
                    ? t('noneShort')
                    : validStart
                      ? tp('period', { from: day(startsOn), to: day(planEndsOn(startsOn, o)) })
                      : '—'}
                </span>
              </motion.button>
            );
          })}
        </div>
      </fieldset>

      {choice === 'none' ? (
        <p className="mt-4 text-[0.8125rem] text-a-muted">{t('noneHint')}</p>
      ) : (
        <Input
          type="date"
          label={t('startsOn')}
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          className="mt-4"
          required
        />
      )}
    </Sheet>
  );
}

/** The term an application asked for ("m6" → 6); null for other requests. */
function askedTerm(payload: Record<string, unknown> | null | undefined): PlanTerm | null {
  const m = typeof payload?.duration === 'string' ? Number(payload.duration.slice(1)) : NaN;
  return PLAN_TERMS.find((t) => t === m) ?? null;
}
