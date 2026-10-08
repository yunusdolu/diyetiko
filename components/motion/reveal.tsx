'use client';

import { motion, type Variants } from 'motion/react';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { useLocale } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { dur, ease, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';

/**
 * Masked text reveal on first view. Latin scripts may split by character; Arabic is ALWAYS
 * split by word (splitting characters breaks cursive joining). Screen readers read the
 * original string; the split spans are aria-hidden.
 */
export function SplitReveal({
  text,
  as = 'h2',
  by = 'word',
  className,
  delay = 0,
  once = true,
}: {
  text: string;
  as?: Tag;
  by?: 'word' | 'char';
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const mode = locale === 'ar' ? 'word' : by;
  const words = text.split(/(\s+)/);

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: mode === 'char' ? stagger.char : stagger.word,
        delayChildren: delay,
      },
    },
  };
  const unit: Variants = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, y: '0%', transition: { duration: 0.15 } } }
    : {
        hidden: { y: '105%' },
        show: { y: '0%', transition: { duration: dur.xl, ease: ease.out } },
      };

  const children = words.map((w, i) => {
    if (/^\s+$/.test(w)) return <span key={i}> </span>;
    if (mode === 'word') {
      return (
        <span key={i} className="inline-flex overflow-hidden pb-[0.08em] align-bottom">
          <motion.span variants={unit} className="inline-block will-change-transform">
            {w}
          </motion.span>
        </span>
      );
    }
    return (
      <span
        key={i}
        className="inline-flex overflow-hidden pb-[0.08em] align-bottom whitespace-nowrap"
      >
        {Array.from(w).map((c, j) => (
          <motion.span key={j} variants={unit} className="inline-block will-change-transform">
            {c}
          </motion.span>
        ))}
      </span>
    );
  });

  return createElement(
    as,
    { className },
    <>
      <span className="sr-only">{text}</span>
      <motion.span
        aria-hidden
        className="block"
        initial="hidden"
        whileInView="show"
        viewport={{ once, margin: '0px 0px -12% 0px' }}
        variants={container}
      >
        {children}
      </motion.span>
    </>,
  );
}

/** Generic in-view rise. Use once per viewport at most (DESIGN.md §7 rule 4). */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={reduced ? { duration: 0.15 } : { duration: dur.lg, ease: ease.out, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Hairline rule that draws from inline-start when it scrolls into view. */
export function DrawRule({ className, dark }: { className?: string; dark?: boolean }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.hr
      aria-hidden
      className={cn(
        'h-px border-0 ltr:origin-left rtl:origin-right',
        dark ? 'bg-paper/25' : 'bg-ink/20',
        className,
      )}
      initial={reduced ? { opacity: 0 } : { scaleX: 0 }}
      whileInView={{ opacity: 1, scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: reduced ? 0.15 : 1.1, ease: ease.inOut }}
    />
  );
}
