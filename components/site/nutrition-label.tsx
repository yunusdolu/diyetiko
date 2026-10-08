import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The "Besin Değerleri" grammar (DESIGN.md idea #3): heavy top rule, bold row labels,
 * mono tabular values aligned to inline-end, a thick separator before totals.
 * Used for recipes, the calculator, the tools index, the share page and admin totals.
 */
export interface LabelRow {
  label: ReactNode;
  value?: ReactNode;
  /** indented sub-row (e.g. "of which sugars") */
  sub?: boolean;
  /** heavier row with a thick rule above */
  total?: boolean;
  note?: ReactNode;
}

export function NutritionLabel({
  title,
  caption,
  rows,
  footer,
  tone = 'light',
  className,
  headingLevel = 'h3',
}: {
  title: ReactNode;
  caption?: ReactNode;
  rows: LabelRow[];
  footer?: ReactNode;
  tone?: 'light' | 'dark';
  className?: string;
  headingLevel?: 'h2' | 'h3' | 'h4';
}) {
  const H = headingLevel;
  const dark = tone === 'dark';
  const rule = dark ? 'border-paper' : 'border-ink';
  return (
    <div className={cn('border-[3px] p-4 sm:p-5', rule, className)}>
      <H className="font-sans text-[clamp(1.6rem,3vw,2.25rem)] leading-none font-black tracking-[-0.02em] ar:leading-tight ar:font-bold">
        {title}
      </H>
      {caption && (
        <p className={cn('mt-1.5 text-[0.8125rem]', dark ? 'text-sage' : 'text-ink-60')}>
          {caption}
        </p>
      )}
      <div className={cn('mt-3 border-t-[10px]', rule)} />
      <dl>
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              'flex items-baseline justify-between gap-4 py-2',
              row.total
                ? cn('mt-1 border-t-[5px] pt-2.5', rule)
                : cn('border-t', dark ? 'border-paper/35' : 'border-ink/35'),
              i === 0 && !row.total && 'border-t-0',
            )}
          >
            <dt
              className={cn(
                'min-w-0 text-ui',
                row.sub ? 'ps-5 font-normal' : 'font-bold',
                row.total && 'text-[1.0625rem] font-black',
              )}
            >
              {row.label}
              {row.note && (
                <span
                  className={cn(
                    'block text-[0.75rem] font-normal',
                    dark ? 'text-sage' : 'text-ink-60',
                  )}
                >
                  {row.note}
                </span>
              )}
            </dt>
            {row.value !== undefined && (
              <dd
                className={cn(
                  'shrink-0 text-end num text-ui',
                  row.total && 'text-[1.0625rem] font-semibold',
                )}
              >
                {row.value}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {footer && (
        <div
          className={cn(
            'mt-1 border-t-[5px] pt-2.5 text-[0.75rem] leading-snug',
            rule,
            dark ? 'text-sage' : 'text-ink-60',
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
