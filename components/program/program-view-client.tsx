'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Sticky day chips; the current day follows the reader (IntersectionObserver). Share page + portal. */
export function DayNav({
  days,
  label,
  className,
  todayId,
  todayLabel,
}: {
  days: { id: string; label: string }[];
  label: string;
  className?: string;
  /** Portal: marks today's chip with a dot (+ visually hidden label) */
  todayId?: string;
  todayLabel?: string;
}) {
  const [active, setActive] = useState(days[0]?.id);
  useEffect(() => {
    const els = days
      .map((d) => document.getElementById(d.id))
      .filter((x): x is HTMLElement => Boolean(x));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [days]);
  if (days.length < 2) return null;
  return (
    <nav
      aria-label={label}
      className={cn(
        'no-print sticky top-0 z-20 border-y border-ink/10 bg-paper/95 backdrop-blur',
        className,
      )}
    >
      <ol className="container-x scrollbar-none flex gap-1.5 overflow-x-auto py-2.5">
        {days.map((d) => (
          <li key={d.id} className="shrink-0">
            <a
              href={`#${d.id}`}
              aria-current={active === d.id ? 'true' : undefined}
              className={cn(
                'relative inline-flex h-9 min-w-9 items-center justify-center rounded-pill px-3 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors',
                active === d.id ? 'text-paper' : 'text-ink hover:bg-paper-2',
              )}
            >
              {active === d.id && (
                <motion.span
                  layoutId="day-pill"
                  className="absolute inset-0 rounded-pill bg-ink"
                  transition={spring.snappy}
                />
              )}
              <span className="relative">{d.label}</span>
              {d.id === todayId && (
                <>
                  <span
                    aria-hidden
                    className="absolute end-1.5 top-1 size-1.5 rounded-full bg-paprika"
                  />
                  <span className="sr-only">, {todayLabel}</span>
                </>
              )}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex h-10 shrink-0 items-center gap-2 rounded-pill border-[1.5px] border-ink px-4 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors hover:bg-ink hover:text-paper"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <path
          d="M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v6H7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </button>
  );
}
