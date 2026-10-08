'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { GoalRow } from '@/lib/admin/insights';
import { ease } from '@/lib/motion';
import { useDir, usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/admin/fx';
import { EmptyState } from '@/components/admin/ui';
import { CheckIcon } from './agenda';

const SHOWN = 6;

/**
 * Every active client with a goal weight on one board: a track from the first weigh-in to the
 * goal, filled to where they are now. Neutral colour — it shows distance, never a verdict.
 */
export function GoalBoard({ rows }: { rows: GoalRow[] }) {
  const t = useTranslations('admin.dashboard.goals');
  // "show all / less" share the attention panel's wording
  const tMore = useTranslations('admin.dashboard.attention');
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const dir = useDir();
  const [all, setAll] = useState(false);
  const kg = (v: number, sign = false) =>
    format.number(v, { maximumFractionDigits: 1, signDisplay: sign ? 'exceptZero' : 'auto' });
  const shown = all ? rows : rows.slice(0, SHOWN);
  const arrow = dir === -1 ? '←' : '→';

  return (
    <section className="a-card">
      <header className="border-b border-a-border px-5 py-3.5">
        <h2 className="text-[0.9375rem] font-bold">{t('title')}</h2>
        <p className="mt-0.5 text-[0.75rem] text-a-muted">{t('hint')}</p>
      </header>
      {rows.length === 0 ? (
        <EmptyState compact>{t('empty')}</EmptyState>
      ) : (
        <ul className="space-y-4 p-5">
          {shown.map((r, i) => {
            const j = r.journey;
            const pct = Math.round(j.progress * 100);
            return (
              <li key={r.id}>
                <Link
                  href={`/admin/clients/${r.id}?tab=overview`}
                  className="group block rounded-[12px] outline-offset-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={r.full_name} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[0.875rem] font-semibold group-hover:underline group-hover:underline-offset-4">
                          {r.full_name}
                        </span>
                        <span className="shrink-0 num text-[0.8125rem] font-semibold">
                          {format.number(j.progress, { style: 'percent' })}
                        </span>
                      </div>
                      <div
                        className="relative mt-2 h-2.5 rounded-pill bg-a-surface-2"
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        aria-label={`${r.full_name}: ${pct}%`}
                      >
                        <motion.div
                          className={cn(
                            'absolute inset-y-0 start-0 origin-left rounded-pill rtl:origin-right',
                            j.reached ? 'bg-a-ok' : 'bg-a-chart',
                          )}
                          style={{ width: '100%' }}
                          initial={{ scaleX: reduced ? j.progress : 0 }}
                          animate={{ scaleX: Math.max(j.progress, 0.015) }}
                          transition={{
                            duration: reduced ? 0 : 1,
                            ease: ease.out,
                            delay: reduced ? 0 : 0.15 + i * 0.07,
                          }}
                        />
                        {/* goal flag at the end of the track */}
                        <span
                          aria-hidden
                          className="absolute end-0 -top-1 h-[18px] w-[3px] rounded-pill bg-a-text"
                        />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[0.75rem] text-a-muted">
                        <span className="num">
                          <bdi>{kg(j.start.kg)}</bdi> {arrow}{' '}
                          <bdi className="text-a-text">{kg(j.current.kg)}</bdi> {arrow}{' '}
                          <bdi>{kg(j.goal)} kg</bdi>
                          <bdi className="ms-1.5">({kg(j.change, true)})</bdi>
                        </span>
                        <span className="flex items-center gap-1.5">
                          {j.reached ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-a-ok">
                              <CheckIcon />
                              {t('reached')}
                            </span>
                          ) : (
                            <>
                              <span>{t('left', { kg: kg(j.remaining) })}</span>
                              {j.etaDays != null && (
                                <span className="rounded-pill bg-a-surface-2 px-2 py-0.5 text-a-text">
                                  {t('eta', { weeks: Math.max(1, Math.round(j.etaDays / 7)) })}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {rows.length > SHOWN && (
            <li>
              <button
                type="button"
                aria-expanded={all}
                onClick={() => setAll((v) => !v)}
                className="text-[0.8125rem] font-semibold underline-offset-4 hover:underline"
              >
                {all ? tMore('showLess') : tMore('showAll', { count: rows.length })}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
