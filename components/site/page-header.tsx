import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { KineticHeadline } from '@/components/motion/kinetic-headline';
import { Ingredient } from './ingredients';

/**
 * Inner-page opener: marginalia eyebrow, a Didone title set large enough to crop at the
 * inline-end edge on mobile, a lead, and one drawn ingredient tucked under the title.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  art,
  locale,
  tone = 'paper',
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  art?: string;
  locale: string;
  tone?: 'paper' | 'green' | 'ink';
  children?: ReactNode;
  className?: string;
}) {
  const dark = tone !== 'paper';
  return (
    <header
      className={cn(
        'relative overflow-hidden pt-28 pb-14 lg:pt-36 lg:pb-20',
        tone === 'paper' && 'text-ink',
        tone === 'green' && 'on-dark bg-green grain-light text-paper',
        tone === 'ink' && 'on-dark bg-ink grain-light text-paper',
        className,
      )}
    >
      <div className="relative container-x grid grid-cols-1 gap-x-6 gap-y-6 lg:grid-cols-12">
        <p className={cn('label lg:col-span-2 lg:pt-5', dark ? 'text-sage' : 'text-ink-60')}>
          {eyebrow}
        </p>
        <div className="relative lg:col-span-10">
          <KineticHeadline
            lines={[title]}
            locale={locale}
            className="relative z-10 font-display text-[clamp(3rem,11vw,9.5rem)] leading-[0.9] font-medium tracking-[-0.035em] ar:text-[clamp(2.6rem,9vw,7.5rem)] ar:leading-[1.25] ar:font-bold ar:tracking-normal"
          />
          {lead && (
            <div
              className={cn(
                'relative z-10 mt-7 max-w-2xl text-lead',
                // Keep clear of the drawn ingredient at the inline end (it's hidden below sm).
                art &&
                  'sm:max-w-[min(42rem,calc(100%-11rem))] lg:max-w-[min(42rem,calc(100%-15rem))]',
                dark ? 'text-sage' : 'text-ink-70',
              )}
            >
              {lead}
            </div>
          )}
          {children && <div className="relative z-10 mt-8">{children}</div>}
          {art && (
            <Ingredient
              name={art}
              className="pointer-events-none absolute end-0 -bottom-6 hidden size-40 rotate-12 sm:block lg:-bottom-10 lg:size-56"
            />
          )}
        </div>
      </div>
    </header>
  );
}
