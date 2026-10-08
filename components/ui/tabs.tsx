'use client';

import { LayoutGroup, motion } from 'motion/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { spring } from '@/lib/motion';
import { useDir } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/**
 * Tabs with a shared-layout indicator that glides between tabs.
 * Roving tabindex + arrow keys (direction-aware), Home/End.
 * `variant="pill"`: the indicator is a filled pill. `variant="line"`: a 2px underline.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'pill',
  tone = 'light',
  className,
  idPrefix,
  size = 'md',
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  variant?: 'pill' | 'line';
  tone?: 'light' | 'dark';
  className?: string;
  idPrefix?: string;
  size?: 'md' | 'sm';
}) {
  const auto = useId();
  const prefix = idPrefix ?? auto;
  const dir = useDir();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const dark = tone === 'dark';
  const activeIndex = items.findIndex((it) => it.value === value);

  // Overflow hint: fade whichever inline edge still has tabs beyond it (direction-aware).
  const stripRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft); // negative in RTL
      const next = { start: max > 1 && pos > 2, end: max > 1 && pos < max - 2 };
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [items.length]);
  const fade =
    edges.start || edges.end
      ? `linear-gradient(${dir === 1 ? 'to right' : 'to left'}, ${edges.start ? 'transparent 0, #000 28px' : '#000 0'}, ${edges.end ? '#000 calc(100% - 36px), transparent 100%' : '#000 100%'})`
      : undefined;

  // When the list overflows, keep the active tab in view (scroll only the strip, never the page).
  useEffect(() => {
    const el = refs.current[activeIndex];
    const strip = el?.parentElement;
    if (!el || !strip || strip.scrollWidth <= strip.clientWidth) return;
    // Physical rect delta → works for LTR and RTL scroll origins alike.
    const delta =
      el.getBoundingClientRect().left -
      strip.getBoundingClientRect().left -
      (strip.clientWidth - el.offsetWidth) / 2;
    strip.scrollBy({ left: delta, behavior: 'smooth' });
  }, [activeIndex]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = items.length - 1;
    let next = -1;
    if (e.key === 'ArrowRight') next = dir === 1 ? i + 1 : i - 1;
    if (e.key === 'ArrowLeft') next = dir === 1 ? i - 1 : i + 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === -1) return;
    e.preventDefault();
    const target = (next + items.length) % items.length;
    refs.current[target]?.focus();
    onChange(items[target]!.value);
  };

  return (
    <LayoutGroup id={prefix}>
      <div
        ref={stripRef}
        role="tablist"
        aria-label={label}
        style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
        className={cn(
          'relative scrollbar-none flex max-w-full overflow-x-auto',
          variant === 'pill' ? 'gap-1 rounded-pill p-1' : 'gap-6 border-b',
          variant === 'pill' && (dark ? 'bg-green-2' : 'bg-paper-2'),
          variant === 'line' && (dark ? 'border-sage/25' : 'border-ink/15'),
          className,
        )}
      >
        {items.map((item, i) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${prefix}-tab-${item.value}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`${prefix}-panel-${item.value}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'relative isolate inline-flex shrink-0 items-center gap-2 font-sans text-ui font-semibold whitespace-nowrap transition-colors duration-200',
                'focus-visible:[outline-offset:-3px]',
                variant === 'pill'
                  ? size === 'sm'
                    ? 'h-8 rounded-pill px-3 text-[0.8125rem]'
                    : 'h-10 rounded-pill px-4'
                  : 'h-11 px-0.5',
                active
                  ? variant === 'pill'
                    ? dark
                      ? 'text-ink'
                      : 'text-paper'
                    : dark
                      ? 'text-paper'
                      : 'text-ink'
                  : dark
                    ? 'text-sage hover:text-paper'
                    : 'text-ink-60 hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="indicator"
                  transition={spring.snappy}
                  className={cn(
                    'absolute -z-10',
                    variant === 'pill' ? 'inset-0 rounded-pill' : 'inset-x-0 -bottom-px h-0.5',
                    variant === 'pill'
                      ? dark
                        ? 'bg-citrus'
                        : 'bg-ink'
                      : dark
                        ? 'bg-citrus'
                        : 'bg-ink',
                  )}
                />
              )}
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <span
                  className={cn(
                    'num text-[0.75rem] font-medium tabular-nums',
                    active ? 'opacity-80' : 'opacity-60',
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export function TabPanel({
  value,
  active,
  idPrefix,
  children,
  className,
}: {
  value: string;
  active: boolean;
  idPrefix: string;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
