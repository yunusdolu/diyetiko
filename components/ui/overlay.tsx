'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Dialog as D } from 'radix-ui';
import type { ReactNode } from 'react';
import { useDir, useMotionLevel } from '@/lib/motion/hooks';
import { dur, ease, exitDur, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Side = 'end' | 'bottom' | 'center';

/**
 * Dialog / Sheet built on Radix (focus trap, Esc, aria) with Motion presence.
 *  - side="end": sheet slides from the inline-end edge (mirrors in RTL)
 *  - side="bottom": sheet rises from the bottom (mobile)
 *  - side="center": dialog scales in
 * Children marked with `data-stagger` are revealed in sequence.
 */
export function Overlay({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'center',
  className,
  tone = 'light',
  hideTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  side?: Side;
  className?: string;
  tone?: 'light' | 'dark';
  hideTitle?: boolean;
}) {
  const dir = useDir();
  const level = useMotionLevel();
  const reduced = level === 'reduced';

  const panel =
    side === 'end'
      ? { hidden: { x: `${100 * dir}%` }, show: { x: 0 } }
      : side === 'bottom'
        ? { hidden: { y: '100%' }, show: { y: 0 } }
        : { hidden: { opacity: 0, scale: 0.96, y: 12 }, show: { opacity: 1, scale: 1, y: 0 } };

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[80] bg-ink/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: dur.md } }}
                exit={{ opacity: 0, transition: { duration: exitDur(dur.md) } }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                className={cn(
                  'fixed z-[81] flex flex-col outline-none',
                  tone === 'dark' ? 'on-dark bg-green text-paper' : 'bg-paper text-ink',
                  side === 'end' && 'inset-y-0 end-0 w-full max-w-[520px] overflow-y-auto',
                  side === 'bottom' &&
                    'inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-sheet',
                  side === 'center' &&
                    'start-1/2 top-1/2 max-h-[90dvh] w-[calc(100vw-32px)] max-w-[560px] -translate-y-1/2 overflow-y-auto rounded-sheet shadow-sheet ltr:-translate-x-1/2 rtl:translate-x-1/2',
                  className,
                )}
                initial={reduced ? { opacity: 0 } : panel.hidden}
                animate={
                  reduced
                    ? { opacity: 1 }
                    : { ...panel.show, transition: { duration: dur.lg, ease: ease.out } }
                }
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { ...panel.hidden, transition: { duration: exitDur(dur.lg), ease: ease.in } }
                }
              >
                <D.Title className={cn(hideTitle && 'sr-only')}>{title}</D.Title>
                {description && <D.Description className="sr-only">{description}</D.Description>}
                <Stagger>{children}</Stagger>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

export const OverlayClose = D.Close;

/** Children fade/rise in sequence after the panel lands. */
function Stagger({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="contents"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: stagger.item, delayChildren: 0.12 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: dur.md, ease: ease.out } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
