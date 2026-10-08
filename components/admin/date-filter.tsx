'use client';

import { useTranslations } from 'next-intl';
import { DropdownMenu as M } from 'radix-ui';
import { useCallback, useState } from 'react';
import { DATE_RANGES, inRange, type DateRange } from '@/lib/admin/date-range';
import { useDir } from '@/lib/motion/hooks';
import { todayISO } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';

/**
 * The lists' date filter: all time, today, the last 7 days, 1 month, 3 months, 1 year — the same
 * control on every list, so it is learnt once. `useDateRange` keeps the choice and hands back the
 * test for a row's date (a plain day or a timestamp; both are read in the practice's calendar).
 */
export function useDateRange(initial: DateRange = 'all') {
  const [range, setRange] = useState<DateRange>(initial);
  const within = useCallback(
    (value: string | null | undefined) => inRange(value, range, todayISO()),
    [range],
  );
  return { range, setRange, within };
}

/**
 * One small button that says what is chosen and opens the six ranges — a strip of six pills took
 * a row of its own on every list. It fills in (accent) while a range other than "all time" is on,
 * so an active filter is never overlooked.
 */
export function DateFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  className?: string;
}) {
  const t = useTranslations('admin.dateRange');
  const dir = useDir();
  const on = value !== 'all';
  return (
    <M.Root dir={dir === -1 ? 'rtl' : 'ltr'}>
      <M.Trigger
        aria-label={`${t('label')}: ${t(value)}`}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-[0.8125rem] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--a-bg)]',
          on
            ? 'border-transparent bg-a-accent text-a-accent-text'
            : 'border-a-border bg-a-surface text-a-text hover:bg-a-surface-2',
          className,
        )}
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h16v14H4V6ZM4 10h16M9 3v4M15 3v4" />
        </svg>
        {t(value)}
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden className="opacity-70">
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </M.Trigger>
      <M.Portal>
        <M.Content
          align="start"
          sideOffset={6}
          className="a-glass z-[95] min-w-44 p-1.5 text-a-text outline-none data-[state=open]:animate-[admin-pop_200ms_cubic-bezier(0.16,1,0.3,1)]"
        >
          <M.Label className="px-2.5 py-1.5 text-[0.6875rem] font-semibold tracking-wider text-a-muted uppercase">
            {t('label')}
          </M.Label>
          <M.RadioGroup value={value} onValueChange={(v) => onChange(v as DateRange)}>
            {DATE_RANGES.map((r) => (
              <M.RadioItem
                key={r}
                value={r}
                className="flex h-9 cursor-pointer items-center justify-between gap-4 rounded-[9px] px-2.5 text-[0.8125rem] font-medium outline-none data-[highlighted]:bg-[color-mix(in_srgb,var(--a-text)_9%,transparent)] data-[state=checked]:font-semibold"
              >
                {t(r)}
                <M.ItemIndicator>
                  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
                    <path
                      d="M3.5 8.5l3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </M.ItemIndicator>
              </M.RadioItem>
            ))}
          </M.RadioGroup>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
