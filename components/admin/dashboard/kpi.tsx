'use client';

import Link from 'next/link';
import { useFormatter } from 'next-intl';
import { cn } from '@/lib/utils';
import { MiniBars, Sparkline, Spotlight } from '@/components/admin/fx';
import { NavIcon, type NavKey } from '@/components/admin/nav';
import { AdminTicker } from '@/components/admin/ticker';

/**
 * A headline number with its recent history: what it counts (with the section's icon), the value,
 * how it moved against the previous period (neutral colours — more requests is not "green", fewer
 * check-ins is not "red"), and the same series as a small chart — a line for a running total,
 * columns for a count per period. The whole card opens the section it summarises.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  sameLabel,
  series,
  href,
  icon,
  viz = 'line',
}: {
  label: string;
  value: number;
  delta: number | null;
  deltaLabel: string;
  sameLabel: string;
  series: number[];
  href: string;
  icon: NavKey;
  viz?: 'line' | 'bars';
}) {
  const format = useFormatter();
  return (
    <Spotlight className="a-card h-full transition-[box-shadow,translate] duration-300 fine:hover:-translate-y-0.5 fine:hover:shadow-[0_0_0_1px_var(--a-card-ring),0_18px_36px_-22px_rgb(15_27_23/0.45)]">
      <Link href={href} className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-1 text-[0.75rem] font-semibold text-a-muted sm:text-[0.8125rem]">
            {label}
          </p>
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-a-surface-2 text-a-text sm:size-9"
          >
            <NavIcon name={icon} size={17} />
          </span>
        </div>
        <p className="mt-1 num-wide text-[2rem] leading-none sm:text-[2.5rem]">
          <AdminTicker value={value} />
        </p>
        <p className="mt-2 flex min-h-5 flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-a-muted sm:text-[0.75rem]">
          {delta != null &&
            (delta === 0 ? (
              <span>{sameLabel}</span>
            ) : (
              <>
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-pill bg-a-surface-2 px-1.5 py-px num font-semibold text-a-text',
                  )}
                >
                  <svg
                    viewBox="0 0 12 12"
                    width="9"
                    height="9"
                    aria-hidden
                    className={delta < 0 ? 'rotate-180' : undefined}
                  >
                    <path d="M6 2l4 6H2z" fill="currentColor" />
                  </svg>
                  {format.number(delta, { signDisplay: 'exceptZero' })}
                </span>
                <span>{deltaLabel}</span>
              </>
            ))}
        </p>
        <div className="mt-auto pt-3">
          {viz === 'bars' ? (
            <MiniBars values={series} height={36} className="text-a-chart" />
          ) : (
            <Sparkline values={series} height={36} className="text-a-chart" />
          )}
        </div>
      </Link>
    </Spotlight>
  );
}
