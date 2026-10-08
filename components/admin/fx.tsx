'use client';

import { motion, useInView } from 'motion/react';
import { useId, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';

/*
 * The panel's motion vocabulary (DESIGN.md v1.13). Purposeful, short, and every piece has a
 * reduced-motion form:
 *  - Rise: a block arrives (fade + 14px up, 0.45s expo-out), staggered by index.
 *  - Spotlight: a soft glow follows a mouse over a card (fine pointers only).
 *  - Sparkline / Meter: data draws itself in from the reading-start side.
 */

export const RISE = { y: 14, duration: 0.45, step: 0.05 } as const;

/** One block of a page entering. `i` staggers siblings (50 ms apart). */
export function Rise({
  children,
  i = 0,
  className,
  id,
  as = 'div',
}: {
  children: ReactNode;
  i?: number;
  className?: string;
  id?: string;
  as?: 'div' | 'section' | 'li';
}) {
  const reduced = usePrefersReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      id={id}
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: RISE.y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0.15 : RISE.duration,
        ease: ease.out,
        delay: reduced ? 0 : i * RISE.step,
      }}
    >
      {children}
    </Tag>
  );
}

/**
 * Card with a pointer-following glow (a radial gradient positioned by two CSS variables, so the
 * pointer never causes a React render). Touch and keyboard users get the plain card.
 */
export function Spotlight({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--sx', `${e.clientX - r.left}px`);
    ref.current.style.setProperty('--sy', `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      onPointerMove={move}
      style={style}
      className={cn(
        'group/spot relative isolate overflow-clip',
        // the glow layer: invisible until hovered with a mouse
        'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-0 before:transition-opacity before:duration-300 fine:hover:before:opacity-100',
        'before:bg-[radial-gradient(420px_circle_at_var(--sx,50%)_var(--sy,0%),var(--a-glow),transparent_60%)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A tiny trend line (no axes — the number next to it carries the meaning). The drawing is
 * stretched by the browser (a 0…100 wide viewBox, strokes that do not scale), so it follows its
 * card on every frame of a resize — nothing is measured or redrawn in JS. It wipes in once on
 * screen. Mirrored in RTL so time runs with the reading direction.
 */
export function Sparkline({
  values,
  height = 40,
  className,
  strokeWidth = 2,
  area = true,
}: {
  values: number[];
  height?: number;
  className?: string;
  strokeWidth?: number;
  area?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, margin: '-5% 0px' });
  const gid = useId().replace(/:/g, '');
  const pts = values.length === 1 ? [values[0]!, values[0]!] : values;
  const show = reduced || inView;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const pad = strokeWidth + 3;
  const xy = pts.map((v, i) => [
    (i / Math.max(1, pts.length - 1)) * 100,
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ]) as [number, number][];
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(1)}`).join(' ');
  const end = xy.at(-1);
  return (
    <div
      ref={box}
      className={cn('relative px-1.5 rtl:-scale-x-100', className)}
      style={{ height }}
      aria-hidden
    >
      {end && (
        <div className="relative h-full">
          <motion.div
            className="h-full"
            initial={{
              clipPath: reduced ? 'inset(-8px -8px -8px -8px)' : 'inset(-8px 100% -8px -8px)',
            }}
            animate={{
              clipPath: show ? 'inset(-8px -8px -8px -8px)' : 'inset(-8px 100% -8px -8px)',
            }}
            transition={{ duration: reduced ? 0 : 0.9, ease: ease.out }}
          >
            <svg
              viewBox={`0 0 100 ${height}`}
              preserveAspectRatio="none"
              width="100%"
              height={height}
              className="block overflow-visible"
            >
              <defs>
                <linearGradient id={`sp${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              {area && <path d={`${line} L100 ${height} L0 ${height} Z`} fill={`url(#sp${gid})`} />}
              <path
                d={line}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </motion.div>
          <motion.span
            className="absolute size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-a-surface bg-current"
            style={{ left: `${end[0]}%`, top: end[1] }}
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: show ? 1 : 0 }}
            transition={{ duration: 0.25, delay: reduced ? 0 : 0.8 }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Small columns for a count per period (weeks, days): the last one — "now" — in full colour, the
 * rest quieter. Pure CSS heights, so it follows its card's width by itself.
 */
export function MiniBars({
  values,
  height = 40,
  className,
}: {
  values: number[];
  height?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, margin: '-5% 0px' });
  const show = reduced || inView;
  const max = Math.max(1, ...values);
  return (
    <div
      ref={box}
      className={cn('flex items-end gap-[3px] rtl:flex-row-reverse', className)}
      style={{ height }}
      aria-hidden
    >
      {values.map((v, i) => (
        <motion.span
          key={i}
          className={cn(
            'min-w-0 flex-1 origin-bottom rounded-t-[3px] bg-current',
            i === values.length - 1 ? 'opacity-100' : 'opacity-30',
          )}
          style={{ height: `${Math.max(7, (v / max) * 100)}%` }}
          initial={{ scaleY: reduced ? 1 : 0 }}
          animate={{ scaleY: show ? 1 : 0 }}
          transition={{
            duration: reduced ? 0 : 0.5,
            ease: ease.out,
            delay: reduced ? 0 : Math.min(i, 14) * 0.03,
          }}
        />
      ))}
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  /** any CSS colour (a theme token) */
  color: string;
}

/**
 * Parts of a whole as a ring: each part drawn in turn, a 2 px gap of the card's surface between
 * them, the total in the middle. The legend beside it carries the names and numbers (never colour
 * alone).
 */
export function Donut({
  segments,
  size = 148,
  stroke = 16,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, margin: '-5% 0px' });
  const show = reduced || inView;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);
  const parts = segments.filter((s) => s.value > 0);
  const gap = parts.length > 1 ? 3 : 0;
  // where each part starts along the ring
  const starts = parts.map((_, i) =>
    parts.slice(0, i).reduce((a, x) => a + (x.value / total) * c, 0),
  );
  return (
    <div ref={box} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--a-surface-2)"
          strokeWidth={stroke}
        />
        {parts.map((s, i) => {
          const len = Math.max(0, (s.value / total) * c - gap);
          const offset = -starts[i]!;
          return (
            <motion.circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDashoffset={offset}
              initial={{ strokeDasharray: `${reduced ? len : 0} ${c}` }}
              animate={{ strokeDasharray: `${show ? len : 0} ${c}` }}
              transition={{
                duration: reduced ? 0 : 0.7,
                ease: ease.out,
                delay: reduced ? 0 : 0.15 + i * 0.12,
              }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Horizontal fill 0…1 from the inline-start edge. */
export function Meter({
  value,
  className,
  barClassName,
  delay = 0,
  label,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  delay?: number;
  label?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-pill bg-a-surface-2', className)}
      role={label ? 'meter' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
    >
      <motion.div
        className={cn('h-full origin-left rounded-pill bg-a-chart rtl:origin-right', barClassName)}
        initial={{ scaleX: reduced ? v : 0 }}
        animate={{ scaleX: v }}
        transition={{ duration: reduced ? 0 : 0.9, ease: ease.out, delay: reduced ? 0 : delay }}
      />
    </div>
  );
}

const AVATAR_TONES = [
  'bg-[#d8f24a] text-[#0f1b17]',
  'bg-[#f6c9b8] text-[#5a1d0c]',
  'bg-[#cfe3d6] text-[#123c2c]',
  'bg-[#f2dd9b] text-[#4f3a05]',
  'bg-[#dcd3f0] text-[#2e2350]',
  'bg-[#c9e2ef] text-[#0f3446]',
] as const;

/** Initials on a soft brand tint; the tint is stable per name (not per render). */
export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const clean = name.replace(/\(.*?\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const initials = (
    (parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toLocaleUpperCase('tr');
  let h = 0;
  for (const ch of clean) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold select-none',
        AVATAR_TONES[h % AVATAR_TONES.length],
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}
