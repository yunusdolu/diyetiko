'use client';

import { motion } from 'motion/react';
import { useId, useState } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Accordion: one open at a time, +/× morph, grid-rows height transition (user-initiated). */
export function Faq({
  items,
  tone = 'light',
}: {
  items: { q: string; a: string }[];
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <ul className={cn('border-t-2', dark ? 'border-paper' : 'border-ink')}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <li key={i} className={cn('border-b', dark ? 'border-paper/20' : 'border-ink/20')}>
            <h3>
              <button
                type="button"
                id={`${base}-q-${i}`}
                aria-expanded={isOpen}
                aria-controls={`${base}-a-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group/faq flex w-full items-start justify-between gap-6 py-6 text-start"
              >
                <span
                  className={cn(
                    'font-display text-[clamp(1.35rem,2.4vw,2rem)] leading-[1.15] tracking-[-0.01em] transition-colors ar:leading-[1.45] ar:font-bold',
                    dark ? 'group-hover/faq:text-citrus' : 'group-hover/faq:text-paprika-deep',
                  )}
                >
                  {item.q}
                </span>
                <span
                  className={cn(
                    'relative mt-1.5 grid size-9 shrink-0 place-items-center rounded-pill border-[1.5px] transition-colors',
                    dark
                      ? 'border-paper group-hover/faq:border-citrus group-hover/faq:bg-citrus group-hover/faq:text-ink'
                      : 'border-ink group-hover/faq:bg-ink group-hover/faq:text-paper',
                  )}
                  aria-hidden
                >
                  <motion.span className="absolute h-[1.5px] w-3.5 bg-current" />
                  <motion.span
                    className="absolute h-3.5 w-[1.5px] bg-current"
                    animate={{ rotate: isOpen ? 90 : 0, opacity: isOpen ? 0 : 1 }}
                    transition={spring.snappy}
                  />
                </span>
              </button>
            </h3>
            <div
              id={`${base}-a-${i}`}
              role="region"
              aria-labelledby={`${base}-q-${i}`}
              className={cn(
                'grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <p
                  className={cn(
                    'max-w-2xl pb-7 text-lead transition-opacity duration-500',
                    dark ? 'text-sage' : 'text-ink-70',
                    isOpen ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {item.a}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
