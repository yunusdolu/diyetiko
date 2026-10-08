'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Dialog as D } from 'radix-ui';
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { admin } from '@/lib/motion';
import { useDir } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { StatusSwap, useHeldState, type ActionState } from '@/components/ui/status-icon';

/*
 * Admin primitives: the public site's motion language, restrained (≤ 250 ms, no theatrics).
 * Every control has rest / hover / focus-visible / pressed / loading / success / error / disabled.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: 'sm' | 'md';
    state?: ActionState;
    icon?: ReactNode;
  }
>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    state = 'idle',
    icon,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  // a result stays until its tick / cross has played in full
  const shown = useHeldState(state);
  const busy = shown !== 'idle';
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={disabled || busy ? undefined : { scale: 0.97 }}
      transition={admin.spring}
      disabled={disabled}
      aria-busy={shown === 'loading' || undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-[10px] font-semibold whitespace-nowrap transition-[background-color,color,border-color,opacity] duration-200 disabled:pointer-events-none disabled:opacity-40',
        size === 'md' ? 'h-10 px-4 text-[0.875rem]' : 'h-8 px-3 text-[0.8125rem]',
        variant === 'primary' && 'bg-a-accent text-a-accent-text hover:opacity-90',
        variant === 'secondary' &&
          'border border-a-border bg-a-surface text-a-text hover:bg-a-surface-2',
        variant === 'ghost' && 'text-a-text hover:bg-a-surface-2',
        variant === 'danger' && 'bg-a-danger text-white hover:opacity-90',
        shown === 'error' && 'animate-shake',
        // a result reads at full strength even if the form has just emptied (disabled)
        busy && 'disabled:opacity-100',
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {/* the label keeps its place (no width jump); the mark takes the exact centre */}
      <StatusSwap state={shown} size={17}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {children}
        </span>
      </StatusSwap>
    </motion.button>
  );
});

const fieldBox =
  'w-full rounded-[10px] border border-a-border bg-a-surface px-3 text-[0.9375rem] text-a-text outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-a-muted/70 hover:border-a-text/30 focus:border-a-text focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--a-text)_12%,transparent)] disabled:opacity-50 aria-[invalid=true]:border-a-danger';

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[0.8125rem] font-semibold text-a-text">
      {children}
      {hint && <span className="ms-1.5 font-normal text-a-muted">{hint}</span>}
    </label>
  );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.p
          id={id}
          role="alert"
          className="mt-1.5 text-[0.8125rem] font-semibold text-a-danger"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: admin.dur }}
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode; error?: string }
>(function Input({ label, hint, error, id, className, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={fid} hint={hint}>
          {label}
        </Label>
      )}
      <input
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-e` : undefined}
        className={cn(fieldBox, 'h-10')}
        {...rest}
      />
      <ErrorText id={`${fid}-e`} error={error} />
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode; error?: string }
>(function Textarea({ label, hint, error, id, className, rows = 4, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={fid} hint={hint}>
          {label}
        </Label>
      )}
      <textarea
        ref={ref}
        id={fid}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(fieldBox, 'py-2.5 leading-relaxed')}
        {...rest}
      />
      <ErrorText id={`${fid}-e`} error={error} />
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    hint?: ReactNode;
    error?: string;
    options: { value: string; label: string }[];
  }
>(function Select({ label, hint, error, id, className, options, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={fid} hint={hint}>
          {label}
        </Label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={fid}
          aria-invalid={error ? true : undefined}
          className={cn(fieldBox, 'h-10 appearance-none pe-9')}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          aria-hidden
          className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-a-muted"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <ErrorText id={`${fid}-e`} error={error} />
    </div>
  );
});

export function Panel({
  title,
  action,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn('a-card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-a-border px-5 py-3.5">
          {title && <h2 className="text-[0.9375rem] font-bold">{title}</h2>}
          {action}
        </header>
      )}
      <div className={cn(padded && 'p-5')}>{children}</div>
    </section>
  );
}

const badgeTones = {
  neutral: 'bg-a-surface-2 text-a-text',
  ok: 'bg-[color-mix(in_oklab,var(--a-ok)_16%,transparent)] text-a-ok',
  warn: 'bg-[color-mix(in_oklab,#e9b949_28%,transparent)] text-[#7a5a0e] dark:text-mustard',
  danger: 'bg-[color-mix(in_oklab,var(--a-danger)_14%,transparent)] text-a-danger',
  accent: 'bg-a-accent text-a-accent-text',
} as const;

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-pill px-2.5 text-[0.75rem] font-semibold whitespace-nowrap',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PageTitle({
  title,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="label text-a-muted">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.05] tracking-[-0.02em] ar:leading-[1.35] ar:font-bold">
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Side sheet (inline-end) or dialog for admin: Radix focus management + restrained motion. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'end',
  width = 'md',
  footer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  side?: 'end' | 'center';
  width?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}) {
  const dir = useDir();
  const w = width === 'sm' ? 'max-w-[420px]' : width === 'lg' ? 'max-w-[760px]' : 'max-w-[560px]';
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="bg-black/40 fixed inset-0 z-[80]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: admin.dur }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                className={cn(
                  'fixed z-[81] flex flex-col bg-a-surface text-a-text shadow-sheet outline-none',
                  side === 'end'
                    ? `inset-y-0 end-0 w-full ${w} border-s border-a-border`
                    : `start-1/2 top-1/2 max-h-[90dvh] w-[calc(100vw-32px)] ${w} -translate-y-1/2 rounded-[18px] ltr:-translate-x-1/2 rtl:translate-x-1/2`,
                )}
                initial={side === 'end' ? { x: `${100 * dir}%` } : { opacity: 0, scale: 0.97 }}
                animate={side === 'end' ? { x: 0 } : { opacity: 1, scale: 1 }}
                exit={side === 'end' ? { x: `${100 * dir}%` } : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.25, ease: admin.ease }}
              >
                <header className="flex items-start justify-between gap-4 border-b border-a-border px-6 py-4">
                  <div>
                    <D.Title className="text-[1.125rem] font-bold">{title}</D.Title>
                    {description && (
                      <D.Description className="mt-0.5 text-[0.8125rem] text-a-muted">
                        {description}
                      </D.Description>
                    )}
                  </div>
                  <D.Close
                    className="grid size-8 place-items-center rounded-[8px] text-a-muted transition-colors hover:bg-a-surface-2 hover:text-a-text"
                    aria-label="×"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </D.Close>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && (
                  <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-a-border px-4 py-3 sm:px-6 sm:py-3.5">
                    {footer}
                  </footer>
                )}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

export function EmptyState({
  children,
  action,
  compact,
}: {
  children: ReactNode;
  action?: ReactNode;
  /** one quiet line (dashboard cards): an empty card should not look heavier than a full one */
  compact?: boolean;
}) {
  if (compact)
    return (
      <div
        data-empty
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-5 text-[0.875rem] text-a-muted"
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-a-surface-2"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M8.5 12.5l2.3 2.3 4.7-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="min-w-0 flex-1">{children}</p>
        {action}
      </div>
    );
  return (
    <div className="grid place-items-center gap-3 rounded-[14px] border border-dashed border-a-border px-6 py-12 text-center text-a-muted">
      <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden>
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle
          cx="24"
          cy="24"
          r="12"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".4"
          strokeWidth="2"
        />
      </svg>
      <p className="max-w-sm text-[0.875rem]">{children}</p>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="a-card p-5">
      <p className="text-[0.8125rem] font-semibold text-a-muted">{label}</p>
      <p className="mt-3 num-wide text-[clamp(1.5rem,6vw,2.25rem)] leading-none whitespace-nowrap">
        {value}
      </p>
      {hint && <p className="mt-2 text-[0.75rem] text-a-muted">{hint}</p>}
    </div>
  );
}
