import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The portal's card (DESIGN.md v1.35): one outline, one radius, one header rhythm — a title row
 * with an optional action at its end, a hairline, then the body. `.p-card` (globals.css) holds the
 * surface so cards that build their own inside (the day's record, the dietitian) match.
 */
export function PortalCard({
  title,
  action,
  children,
  tone = 'paper',
  className,
  id,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: 'paper' | 'green';
  className?: string;
  id?: string;
}) {
  const green = tone === 'green';
  return (
    <section
      id={id}
      className={cn(
        'p-card flex flex-col',
        green && 'on-dark !border-transparent !bg-green grain-light text-paper',
        className,
      )}
    >
      <header
        className={cn(
          'flex min-h-[3.375rem] flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-5 py-3 sm:px-6',
          green ? 'border-paper/15' : 'border-ink/10',
        )}
      >
        <h2 className="text-[1.0625rem] leading-tight font-bold tracking-[-0.01em]">{title}</h2>
        {action}
      </header>
      <div className="min-w-0 flex-1 p-5 sm:p-6">{children}</div>
    </section>
  );
}
