'use client';

import { motion } from 'motion/react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { dur, ease, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Tone = 'light' | 'dark';

/**
 * Native checkbox (keyboard + forms work for free) with a squash on check and a path-drawn check (tween: springs only take two keyframes).
 */
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    label: ReactNode;
    tone?: Tone;
    error?: string;
  }
>(function Checkbox({ label, tone = 'light', error, className, id, checked, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  const dark = tone === 'dark';
  return (
    <div className={className}>
      <label htmlFor={fid} className="group/cb inline-flex cursor-pointer items-start gap-3">
        <span className="relative mt-0.5 inline-grid size-6 shrink-0 place-items-center">
          <input
            ref={ref}
            id={fid}
            type="checkbox"
            checked={checked}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${fid}-error` : undefined}
            className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
            {...rest}
          />
          <motion.span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 rounded-[6px] border-[1.5px] transition-colors duration-200',
              dark
                ? 'border-sage peer-checked:border-citrus peer-checked:bg-citrus'
                : 'border-ink peer-checked:bg-ink',
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3',
              dark ? 'peer-focus-visible:outline-citrus' : 'peer-focus-visible:outline-ink',
              error && (dark ? 'border-paprika' : 'border-paprika-deep'),
            )}
            animate={{ scale: checked ? [1, 0.82, 1] : 1 }}
            transition={{ duration: dur.md, ease: ease.out }}
          />
          <svg
            viewBox="0 0 24 24"
            className={cn('pointer-events-none relative size-4', dark ? 'text-ink' : 'text-paper')}
            aria-hidden
          >
            <motion.path
              d="M4.5 12.5l5 5L19.5 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
              transition={{ duration: dur.md, ease: ease.out }}
            />
          </svg>
        </span>
        <span className={cn('text-ui', dark ? 'text-paper' : 'text-ink')}>{label}</span>
      </label>
      {error && (
        <p
          id={`${fid}-error`}
          role="alert"
          className={cn(
            'ms-9 mt-1.5 text-[0.8125rem] font-semibold',
            dark ? 'text-paprika' : 'text-paprika-deep',
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
});

/** Switch with a spring thumb. Direction-aware (thumb travels toward inline-end when on). */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  tone = 'light',
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  tone?: Tone;
  id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const dark = tone === 'dark';
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label
          htmlFor={fid}
          className={cn('block text-ui font-semibold', dark ? 'text-paper' : 'text-ink')}
        >
          {label}
        </label>
        {description && (
          <p className={cn('mt-0.5 text-[0.8125rem]', dark ? 'text-sage' : 'text-ink-60')}>
            {description}
          </p>
        )}
      </div>
      <button
        id={fid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill p-1 transition-colors duration-200 disabled:opacity-40',
          checked ? (dark ? 'bg-citrus' : 'bg-ink') : dark ? 'bg-green-3' : 'bg-paper-3',
          checked ? 'justify-end' : 'justify-start',
        )}
      >
        <motion.span
          layout
          transition={spring.snappy}
          className={cn(
            'block size-5 rounded-pill',
            checked ? (dark ? 'bg-ink' : 'bg-paper') : 'bg-white',
          )}
        />
      </button>
    </div>
  );
}
