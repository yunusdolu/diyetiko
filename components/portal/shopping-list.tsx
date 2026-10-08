'use client';

import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { shoppingList } from '@/lib/portal/shopping';
import { cn } from '@/lib/utils';
import type { PortalProgram } from '@/types/portal';
import { PortalCard } from './card';

/**
 * The programme as a shopping list (DESIGN.md v1.35): pick the days, tick what is in the basket.
 * Ticks are a convenience kept in this browser (per programme); nothing is sent anywhere.
 */
export function ShoppingList({
  program,
  dayLabels,
}: {
  program: Pick<PortalProgram, 'id' | 'days'>;
  dayLabels: string[];
}) {
  const t = useTranslations('portal.shopping');
  const locale = useLocale() as Locale;
  const il = intlLocale(locale);
  const reduced = usePrefersReducedMotion();
  const nf = new Intl.NumberFormat(il, { maximumFractionDigits: 0 });
  const storeKey = `portal_shopping_${program.id}`;
  const [days, setDays] = useState<number[]>(() => program.days.map((_, i) => i));
  const [got, setGot] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? '[]') as unknown;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setGot(saved.filter((x): x is string => typeof x === 'string'));
    } catch {
      /* nothing remembered */
    }
  }, [storeKey]);
  const keep = (next: string[]) => {
    setGot(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      /* private mode: ticks last until the page closes */
    }
  };
  const lines = useMemo(() => shoppingList(program, il, days), [program, il, days]);
  const done = lines.filter((l) => got.includes(l.key)).length;
  const amount = (l: (typeof lines)[number]) =>
    l.grams != null ? `${nf.format(l.grams)} g` : t('times', { count: l.times });

  const copy = async () => {
    const text = lines.map((l) => `${got.includes(l.key) ? '✓' : '•'} ${l.name} — ${amount(l)}`);
    try {
      await navigator.clipboard.writeText(text.join('\n'));
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const pill =
    'inline-flex h-9 items-center rounded-pill border-[1.5px] px-3.5 text-[0.8125rem] font-semibold transition-[background-color,border-color,color,scale] active:scale-95';
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="min-w-0 xl:col-span-4">
        <PortalCard title={t('days')}>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('days')}>
            {dayLabels.map((label, i) => {
              const on = days.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDays((d) =>
                      on ? d.filter((x) => x !== i) : [...d, i].sort((a, b) => a - b),
                    )
                  }
                  className={cn(
                    pill,
                    on ? 'border-ink bg-ink text-paper' : 'border-ink/20 hover:border-ink',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="no-print mt-5 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
            <button
              type="button"
              onClick={copy}
              className={cn(pill, 'border-ink/20 hover:border-ink')}
            >
              {t('copy')}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className={cn(pill, 'border-ink/20 hover:border-ink')}
            >
              {t('print')}
            </button>
            <button
              type="button"
              onClick={() => keep([])}
              disabled={!got.length}
              className={cn(pill, 'border-ink/20 hover:border-ink disabled:opacity-40')}
            >
              {t('clear')}
            </button>
          </div>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-60">{t('note')}</p>
        </PortalCard>
      </div>

      <div className="min-w-0 xl:col-span-8">
        <PortalCard
          title={t('list')}
          action={
            <span className="num text-[0.8125rem] font-semibold text-ink-60">
              {done}/{lines.length}
            </span>
          }
        >
          <div className="h-1.5 overflow-hidden rounded-pill bg-ink/10" aria-hidden>
            <motion.div
              className="h-full origin-left rounded-pill bg-green-3 rtl:origin-right"
              initial={false}
              animate={{ scaleX: lines.length ? done / lines.length : 0 }}
              transition={{ duration: reduced ? 0 : 0.35, ease: ease.out }}
            />
          </div>
          {!lines.length ? (
            <p className="mt-4 text-[0.9375rem] text-ink-60">{t('emptyDays')}</p>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {lines.map((l) => {
                const on = got.includes(l.key);
                return (
                  <li key={l.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => keep(on ? got.filter((k) => k !== l.key) : [...got, l.key])}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 rounded-[12px] border px-3 py-2 text-start text-[0.9375rem] transition-colors duration-200',
                        on ? 'border-transparent bg-paper-2/70' : 'border-ink/15 hover:border-ink',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-200',
                          on ? 'border-ink bg-ink text-citrus' : 'border-ink/35',
                        )}
                      >
                        <svg viewBox="0 0 16 16" width="11" height="11">
                          <motion.path
                            d="M3.5 8.5l3 3 6-7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={false}
                            animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
                            transition={{ duration: reduced ? 0 : 0.28, ease: ease.out }}
                          />
                        </svg>
                      </span>
                      <bdi
                        className={cn(
                          'min-w-0 flex-1 font-semibold',
                          on && 'text-ink-60 line-through decoration-ink/30',
                        )}
                      >
                        {l.name}
                      </bdi>
                      <span className="shrink-0 num text-[0.8125rem] text-ink-60">{amount(l)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PortalCard>
      </div>
    </div>
  );
}
