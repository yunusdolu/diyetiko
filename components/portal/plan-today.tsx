'use client';

import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { logPlannedMealAction } from '@/app/panel/_actions';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { dur, ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import type { MealSlot, ProgramMeal } from '@/types/portal';
import { MotionButton } from '@/components/ui/motion-button';
import { CheckIcon } from './icons';

/**
 * Today's planned meals as a line through the day: a mark per meal that fills when it is eaten,
 * the next one picked out. "I ate this" copies the plan into the diary in one tap.
 */
export function PlanToday({
  day,
  meals,
  loggedSlots,
}: {
  day: string;
  meals: ProgramMeal[];
  loggedSlots: MealSlot[];
}) {
  const t = useTranslations('portal.today');
  const tm = useTranslations('meals');
  const tu = useTranslations('units');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const [logged, setLogged] = useState<MealSlot[]>(loggedSlots);
  const [busy, setBusy] = useState<MealSlot | null>(null);

  const log = async (slot: MealSlot) => {
    setBusy(slot);
    const res = await logPlannedMealAction(day, slot);
    setBusy(null);
    if (res.ok) {
      setLogged((l) => [...l, slot]);
      toast.success(t('ateToast', { meal: tm(slot) }));
      router.refresh();
    } else {
      toast.error(t('saveFailed'));
    }
  };

  const planned = meals.filter((m) => m.items.length);
  const eaten = planned.filter((m) => logged.includes(m.slot)).length;
  const next = planned.find((m) => !logged.includes(m.slot))?.slot ?? null;

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-ink/10" aria-hidden>
          <motion.div
            className="h-full origin-left rounded-pill bg-green-3 rtl:origin-right"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: planned.length ? eaten / planned.length : 0 }}
            transition={{ duration: reduced ? 0 : dur.lg, ease: ease.out }}
          />
        </div>
        <p className="shrink-0 num text-[0.8125rem] font-semibold text-ink-60">
          {t('planCount', { done: eaten, total: planned.length })}
        </p>
      </div>

      <ol className="mt-4">
        {planned.map((m, i) => {
          const kcal = m.items.reduce((s, it) => s + it.kcal, 0);
          const isLogged = logged.includes(m.slot);
          const isNext = m.slot === next;
          const last = i === planned.length - 1;
          return (
            <motion.li
              key={m.slot}
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.md, ease: ease.out, delay: reduced ? 0 : i * 0.05 }}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3"
            >
              {/* the line through the day */}
              <div className="flex flex-col items-center" aria-hidden>
                <span
                  className={cn(
                    'mt-3.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-300',
                    isLogged
                      ? 'border-green-3 bg-green-3 text-paper'
                      : isNext
                        ? 'border-ink bg-citrus'
                        : 'border-ink/25 bg-paper',
                  )}
                >
                  {isLogged && <CheckIcon size={13} />}
                </span>
                {!last && (
                  <span
                    className={cn(
                      'mt-1 w-[1.5px] flex-1 rounded-full transition-colors duration-300',
                      isLogged ? 'bg-green-3/60' : 'bg-ink/12',
                    )}
                  />
                )}
              </div>
              <div
                className={cn(
                  'mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border-[1.5px] px-3.5 py-3 transition-colors duration-300',
                  isNext
                    ? 'border-ink bg-paper'
                    : isLogged
                      ? 'border-transparent bg-paper/50'
                      : 'border-ink/10 bg-paper/70',
                )}
              >
                <div className="min-w-[9rem] flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[1rem] font-bold">{tm(m.slot)}</span>
                    {m.time && <span className="num text-[0.75rem] text-ink-60">{m.time}</span>}
                    <span className="num text-[0.75rem] text-ink-60">
                      · {nf.format(kcal)} {tu('kcal')}
                    </span>
                    {isNext && (
                      <span className="rounded-pill bg-citrus px-2 py-0.5 text-[0.6875rem] font-bold text-ink">
                        {t('planNext')}
                      </span>
                    )}
                  </p>
                  <p
                    className={cn(
                      'mt-1 line-clamp-2 text-[0.9375rem]',
                      isLogged ? 'text-ink-60' : 'text-ink-70',
                    )}
                  >
                    <bdi>{m.items.map((it) => it.name).join(', ')}</bdi>
                  </p>
                </div>
                {isLogged ? (
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-green/10 px-3 text-[0.8125rem] font-semibold text-green-3">
                    <CheckIcon size={15} />
                    {t('logged')}
                  </span>
                ) : (
                  <MotionButton
                    size="sm"
                    variant={isNext ? 'fill' : 'outline'}
                    state={busy === m.slot ? 'loading' : 'idle'}
                    disabled={busy !== null}
                    onClick={() => log(m.slot)}
                  >
                    {t('ateThis')}
                  </MotionButton>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
