'use client';

import { useLocale, useTranslations } from 'next-intl';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';
import type { PortalProgram, Totals } from '@/types/portal';
import { MacroRings } from '@/components/site/macro-rings';

/** Day totals from the diary against the program targets: rings + a compact label table. */
export function DayTotals({
  totals,
  targets,
  compact,
}: {
  totals: Totals;
  targets: PortalProgram['targets'] | null;
  compact?: boolean;
}) {
  const t = useTranslations('portal.diary');
  const tm = useTranslations('macros');
  const tu = useTranslations('units');
  const locale = useLocale() as Locale;
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const rows = [
    {
      key: 'protein',
      label: tm('protein'),
      value: totals.protein,
      target: targets?.protein ?? null,
      color: 'bg-protein-on-light',
    },
    {
      key: 'carb',
      label: tm('carb'),
      value: totals.carb,
      target: targets?.carb ?? null,
      color: 'bg-carb-on-light',
    },
    {
      key: 'fat',
      label: tm('fat'),
      value: totals.fat,
      target: targets?.fat ?? null,
      color: 'bg-fat-on-light',
    },
  ];
  const hasMacros = totals.protein + totals.carb + totals.fat > 0;

  const target = targets?.kcal ? (
    <p className="num text-[0.8125rem] text-ink-60">
      {t('vsTarget', { value: `${nf.format(targets.kcal)} ${tu('kcal')}` })}
    </p>
  ) : null;
  const list = (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = r.target ? Math.min(1, r.value / r.target) : null;
        return (
          <li key={r.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[0.875rem]">
              <span className="font-semibold">{r.label}</span>
              <span className="num whitespace-nowrap">
                {nf.format(r.value)}
                {r.target ? (
                  <span className="text-ink-60"> / {nf.format(r.target)}</span>
                ) : null}{' '}
                {tu('g')}
              </span>
            </div>
            {pct != null && (
              <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-ink/10">
                <div
                  className={cn(
                    'h-full origin-left rounded-pill transition-transform duration-700 rtl:origin-right',
                    r.color,
                  )}
                  style={{ transform: `scaleX(${pct})` }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
  const unknown =
    totals.unknown > 0 ? (
      <p className="mt-3 text-[0.75rem] text-ink-60">
        {t('unknownValues', { count: totals.unknown })}
      </p>
    ) : null;
  const rings = (
    <MacroRings
      protein={hasMacros ? totals.protein : 0}
      carb={hasMacros ? totals.carb : 0}
      fat={hasMacros ? totals.fat : 0}
      size={compact ? 104 : 150}
      play
    >
      <span className="num text-[1rem] leading-none font-semibold">{nf.format(totals.kcal)}</span>
      <span className="mt-1 label text-[0.5625rem] text-ink-60">{tu('kcal')}</span>
    </MacroRings>
  );

  // Compact = the diary's totals card. Phones: rings + target, rows underneath. Tablets: side by
  // side. Desktop side panel (xl): stacked again so long labels ("Karbonhidrat") never collide.
  if (compact) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8 xl:grid-cols-1 xl:gap-5">
        <div className="flex items-center gap-4">
          {rings}
          <div className="min-w-0 sm:hidden xl:block">{target}</div>
        </div>
        <div className="min-w-0">
          <div className="mb-2 hidden sm:block xl:hidden">{target}</div>
          {list}
          {unknown}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
      {rings}
      <div className="min-w-0">
        {target}
        <div className="mt-2">{list}</div>
        {unknown}
      </div>
    </div>
  );
}
