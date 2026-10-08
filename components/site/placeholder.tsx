import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Clearly marked placeholder for content only the dietitian can provide (bio, credentials,
 * portrait…). Never styled to look like real content. Listed in README → Content needed.
 */
export function Placeholder({
  label,
  children,
  className,
  dark,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative rounded-[14px] border-2 border-dashed p-5',
        dark ? 'border-sage/50 text-sage' : 'border-ink/30 text-ink-70',
        className,
      )}
    >
      <p
        className={cn(
          'mb-2 inline-flex items-center gap-2 label',
          dark ? 'text-citrus' : 'text-paprika-deep',
        )}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path
            d="M12 3v10M12 17v.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {label}
      </p>
      <div className="text-body">{children}</div>
    </div>
  );
}
