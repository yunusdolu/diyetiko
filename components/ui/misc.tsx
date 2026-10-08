'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Tooltip as T } from 'radix-ui';
import { forwardRef, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Toaster as Sonner } from 'sonner';
import { dur, ease, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Shimmer-free skeleton: a slow opacity breath (no moving gradients, nothing >3 Hz). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <motion.div
      aria-hidden
      className={cn('rounded-[6px] bg-current/10', className)}
      animate={{ opacity: [0.55, 1, 0.55] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/** Round icon button: rest / hover (fill) / pressed (scale) / focus ring / disabled. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    tone?: 'light' | 'dark';
    size?: 'sm' | 'md';
    active?: boolean;
  }
>(function IconButton(
  { label, tone = 'light', size = 'md', active, className, children, ...rest },
  ref,
) {
  const dark = tone === 'dark';
  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      transition={spring.snappy}
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-pill border-[1.5px] transition-colors duration-200 disabled:pointer-events-none disabled:opacity-40',
        size === 'md' ? 'size-11' : 'size-9',
        dark
          ? 'border-sage/40 text-paper hover:border-citrus hover:bg-citrus hover:text-ink'
          : 'border-ink/25 text-ink hover:border-ink hover:bg-ink hover:text-paper',
        active && (dark ? 'border-citrus bg-citrus text-ink' : 'border-ink bg-ink text-paper'),
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
});

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const touch = useRef(false);
  const openAtTouch = useRef(false);
  return (
    <T.Provider delayDuration={250}>
      <T.Root open={open} onOpenChange={setOpen}>
        <T.Trigger
          asChild
          onPointerDown={(e) => {
            touch.current = e.pointerType !== 'mouse';
            openAtTouch.current = open;
          }}
          onClick={(e) => {
            // Touch has no hover: a tap toggles the tooltip. The tap's focus event already
            // opens it, so toggle from the state at the START of the tap; preventDefault stops
            // Radix's own click handler (it closes). Outside taps still dismiss it.
            if (!touch.current) return;
            e.preventDefault();
            setOpen(!openAtTouch.current);
          }}
        >
          {children}
        </T.Trigger>
        <AnimatePresence>
          {open && (
            <T.Portal forceMount>
              <T.Content asChild side={side} sideOffset={8} collisionPadding={12}>
                <motion.div
                  className="z-[90] max-w-64 rounded-[10px] bg-ink px-3 py-2 text-[0.8125rem] leading-snug text-paper"
                  initial={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
                  transition={{ duration: dur.sm, ease: ease.out }}
                >
                  {content}
                </motion.div>
              </T.Content>
            </T.Portal>
          )}
        </AnimatePresence>
      </T.Root>
    </T.Provider>
  );
}

/** App-wide toaster, styled with tokens. Direction follows the document. */
export function Toaster({
  dir = 'ltr',
  theme = 'light',
  mobileBottom,
}: {
  dir?: 'ltr' | 'rtl';
  theme?: 'light' | 'dark';
  /** distance from the bottom on phones (e.g. above a bottom navigation bar) */
  mobileBottom?: string;
}) {
  return (
    <Sonner
      dir={dir}
      theme={theme}
      mobileOffset={mobileBottom ? { bottom: mobileBottom } : undefined}
      position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
      gap={10}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[min(92vw,380px)] items-start gap-3 rounded-[14px] bg-ink px-4 py-3.5 font-sans text-ui text-paper shadow-sheet',
          title: 'font-semibold',
          description: 'text-sage text-[0.8125rem]',
          actionButton:
            'ms-auto rounded-pill bg-citrus px-3 py-1 text-[0.8125rem] font-semibold text-ink',
          cancelButton: 'rounded-pill px-3 py-1 text-[0.8125rem] text-sage',
          success: '[&_[data-icon]]:text-citrus',
          error: '[&_[data-icon]]:text-paprika',
        },
      }}
    />
  );
}
