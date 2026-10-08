'use client';

import { AnimatePresence, motion, useAnimate } from 'motion/react';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { useDir } from '@/lib/motion/hooks';
import { dur, ease } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface FieldChrome {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** show the drawn check when the value is valid (touched + no error) */
  valid?: boolean;
  tone?: 'light' | 'dark';
  suffix?: ReactNode;
}

/**
 * Underlined field with an animated label: rests inside the field, lifts and shrinks on
 * focus/filled. Errors shake the field once (mirrored in RTL) and slide the message in.
 */
function useShake(error?: string) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const dir = useDir();
  const prev = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (error && error !== prev.current && scope.current) {
      const d = 4 * dir;
      animate(scope.current, { x: [0, -d, d, -d, d, 0] }, { duration: 0.28 });
    }
    prev.current = error;
  }, [error, animate, scope, dir]);
  return scope;
}

function Chrome({
  id,
  label,
  error,
  hint,
  valid,
  tone = 'light',
  suffix,
  children,
  multiline,
}: FieldChrome & { id: string; children: ReactNode; multiline?: boolean }) {
  const scope = useShake(error);
  const dark = tone === 'dark';
  return (
    <div className="group/field relative">
      <div
        ref={scope}
        className={cn(
          'relative flex items-end border-b-[1.5px] transition-colors duration-200',
          dark
            ? 'border-sage/50 focus-within:border-citrus'
            : 'border-ink/30 focus-within:border-ink',
          error &&
            (dark
              ? 'border-paprika focus-within:border-paprika'
              : 'border-paprika-deep focus-within:border-paprika-deep'),
          multiline ? 'min-h-32' : 'h-16',
        )}
      >
        {children}
        <label
          htmlFor={id}
          className={cn(
            'pointer-events-none absolute start-0 origin-top-left font-sans transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rtl:origin-top-right',
            'top-1 text-[0.8125rem] font-semibold',
            'peer-placeholder-shown:top-[1.35rem] peer-placeholder-shown:text-[1.0625rem] peer-placeholder-shown:font-normal',
            'peer-focus:top-1 peer-focus:text-[0.8125rem] peer-focus:font-semibold',
            dark ? 'text-sage peer-focus:text-citrus' : 'text-ink-60 peer-focus:text-ink',
          )}
        >
          {label}
        </label>
        <span className="ms-2 mb-3 inline-flex shrink-0 items-center gap-2">
          {suffix}
          <AnimatePresence>
            {valid && !error && (
              <motion.svg
                key="ok"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden
                className={dark ? 'text-citrus' : 'text-green-3'}
              >
                <motion.path
                  d="M4.5 12.5l5 5L19.5 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: dur.md, ease: ease.out }}
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </span>
      </div>
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="err"
            id={`${id}-error`}
            role="alert"
            className={cn(
              'mt-2 text-[0.8125rem] font-semibold',
              dark ? 'text-paprika' : 'text-paprika-deep',
            )}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: dur.sm, ease: ease.out }}
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            id={`${id}-hint`}
            className={cn('mt-2 text-[0.8125rem]', dark ? 'text-sage' : 'text-ink-60')}
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const inputBase =
  'peer w-full min-w-0 bg-transparent pb-2.5 pt-7 font-sans text-[1.0625rem] outline-none placeholder:text-transparent focus-visible:outline-none';

export type FieldProps = FieldChrome & Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'>;

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, valid, tone, suffix, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Chrome
      id={fid}
      label={label}
      error={error}
      hint={hint}
      valid={valid}
      tone={tone}
      suffix={suffix}
    >
      <input
        ref={ref}
        id={fid}
        placeholder=" "
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cn(
          inputBase,
          tone === 'dark' ? 'text-paper caret-citrus' : 'text-ink caret-paprika-deep',
          className,
        )}
        {...rest}
      />
    </Chrome>
  );
});

export type TextAreaProps = FieldChrome &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'placeholder'>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, valid, tone, suffix, id, className, rows = 4, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Chrome
      id={fid}
      label={label}
      error={error}
      hint={hint}
      valid={valid}
      tone={tone}
      suffix={suffix}
      multiline
    >
      <textarea
        ref={ref}
        id={fid}
        rows={rows}
        placeholder=" "
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cn(
          inputBase,
          'resize-none',
          tone === 'dark' ? 'text-paper caret-citrus' : 'text-ink caret-paprika-deep',
          className,
        )}
        {...rest}
      />
    </Chrome>
  );
});
