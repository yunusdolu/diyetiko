'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The panel's search field, drawn as one of the filter strips: a dark pill with a magnifier and
 * "Ara" — the strip's selected pill — sitting in the strip's own track. Pressed (or reached with
 * the keyboard), the track grows out towards the end of the row and is the writing space. It
 * stays open while it holds text and closes when left empty; Escape or the × clears it.
 */
export function SearchPill({
  value,
  onChange,
  placeholder,
  label,
  className,
  width = '13rem',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** accessible name */
  label: string;
  className?: string;
  /** how far the writing space opens */
  width?: string;
}) {
  const tc = useTranslations('admin.common');
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const open = focused || value !== '';
  return (
    <label
      data-open={open ? 'true' : 'false'}
      className={cn(
        'inline-flex h-[38px] max-w-full shrink-0 cursor-pointer items-center rounded-pill bg-a-surface-2 p-[3px] transition-shadow duration-300',
        open && 'cursor-text shadow-[0_0_0_2px_color-mix(in_srgb,var(--a-text)_10%,transparent)]',
        className,
      )}
    >
      <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill bg-a-accent px-3 text-[0.8125rem] font-semibold text-a-accent-text transition-transform duration-150 active:scale-95">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        {tc('search')}
      </span>
      {/* the writing space: the track itself, growing out of the pill */}
      <span
        className="flex h-8 min-w-0 items-center overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.25,1.1,0.4,1)] motion-reduce:transition-none"
        style={{ width: open ? width : 0 }}
      >
        <input
          ref={input}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape' || !value) return;
            e.stopPropagation();
            onChange('');
          }}
          placeholder={placeholder}
          aria-label={label}
          className="h-full min-w-0 flex-1 bg-transparent ps-2.5 pe-1 text-[0.8125rem] font-medium text-a-text outline-none placeholder:font-normal placeholder:text-a-muted [&::-webkit-search-cancel-button]:hidden"
          style={{ width }}
        />
        {value !== '' && (
          <button
            type="button"
            aria-label={tc('remove')}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              input.current?.focus();
            }}
            className="me-1.5 grid size-5 shrink-0 place-items-center rounded-full text-a-muted hover:bg-a-surface hover:text-a-text"
          >
            <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </span>
    </label>
  );
}
