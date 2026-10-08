import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SectionTone = 'paper' | 'paper-2' | 'green' | 'ink';

const tones: Record<SectionTone, string> = {
  // paper is transparent so the body grain stays continuous across sections
  paper: 'text-ink',
  'paper-2': 'grain bg-paper-2 text-ink',
  green: 'on-dark grain-light bg-green text-paper',
  ink: 'on-dark grain-light bg-ink text-paper',
};

/** Page section with the editorial rhythm (DESIGN.md §4). Dark tones set .on-dark for focus rings. */
export function Section({
  tone = 'paper',
  className,
  children,
  id,
  labelledBy,
  hideFab,
}: {
  tone?: SectionTone;
  className?: string;
  children: ReactNode;
  id?: string;
  labelledBy?: string;
  hideFab?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-hide-fab={hideFab || undefined}
      className={cn('relative py-[clamp(96px,14vh,176px)]', tones[tone], className)}
    >
      {children}
    </section>
  );
}

const TAG_TONE = {
  /** on paper */
  green: { pill: 'bg-green text-paper', chip: 'bg-citrus text-ink' },
  /** on paper, the warm alternate */
  orange: { pill: 'bg-paprika text-ink', chip: 'bg-ink text-paper' },
  /** on ink / green */
  cream: { pill: 'bg-paper text-ink', chip: 'bg-green text-paper' },
} as const;
export type SectionTagTone = keyof typeof TAG_TONE;

/**
 * A section's number and name ("06 — Örnek hafta") as a tag: a pill in the colour that suits the
 * section's background, the number in its own round chip. It looks like a button on purpose and
 * is none: no pointer, no hover, plain text to assistive tech. A name too long for its column
 * wraps inside the pill (the radius is fixed, so two lines still read as one tag).
 */
export function SectionTag({
  children,
  tone = 'green',
  className,
}: {
  children: string;
  tone?: SectionTagTone;
  className?: string;
}) {
  const m = /^\s*(\d+)\s*[—–-]\s*(.+)$/.exec(children);
  const c = TAG_TONE[tone];
  return (
    <p
      className={cn(
        'flex w-fit max-w-full items-center gap-2 rounded-[1.125rem] py-1 pe-3.5 label transition-colors duration-500 select-none',
        m ? 'ps-1' : 'ps-3.5',
        c.pill,
        className,
      )}
    >
      {m && (
        <span
          className={cn(
            'grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1.5 num text-[0.6875rem] leading-none tracking-normal transition-colors duration-500',
            c.chip,
          )}
        >
          {m[1]}
        </span>
      )}
      <span className="py-1">{m ? m[2] : children}</span>
    </p>
  );
}

/**
 * Section opener: marginalia number on the rail (desktop) / eyebrow (mobile), then a big
 * Didone title. Titles are left in reading order; nothing is centred.
 */
export function SectionHead({
  eyebrow,
  title,
  lead,
  id,
  dark,
  tone,
  className,
  action,
}: {
  /** the tag's colour; cream on dark sections, green otherwise */
  tone?: SectionTagTone;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  dark?: boolean;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn('container-x grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-12', className)}>
      <div className="lg:col-span-2 lg:pt-3">
        <SectionTag tone={tone ?? (dark ? 'cream' : 'green')}>{eyebrow}</SectionTag>
      </div>
      <div className="lg:col-span-7">
        <h2
          id={id}
          className="font-display text-display-lg tracking-[-0.025em] ar:leading-[1.25] ar:font-bold ar:tracking-normal"
        >
          {title}
        </h2>
        {lead && (
          <p className={cn('mt-5 max-w-2xl text-lead', dark ? 'text-sage' : 'text-ink-70')}>
            {lead}
          </p>
        )}
      </div>
      {action && <div className="flex items-end lg:col-span-3 lg:justify-end">{action}</div>}
    </div>
  );
}
