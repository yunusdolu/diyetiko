'use client';

import { motion, useAnimate, useMotionValue, useSpring, type HTMLMotionProps } from 'motion/react';
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import { useDir, useFinePointer, useMotionLevel } from '@/lib/motion/hooks';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { StatusSwap, useHeldState, type ActionState } from './status-icon';

export type ButtonVariant = 'fill' | 'outline' | 'text';
export type ButtonTone = 'ink' | 'paprika' | 'citrus' | 'paper';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonEffect = 'wipe' | 'roll' | 'magnetic' | 'none';

/*
 * Tone = the colour at rest. The hover wipe always brings the "answer" colour:
 *   ink → paprika (ink text)      paprika → ink (paper text)
 *   citrus → paper (ink text)     paper → citrus (ink text)
 */
const toneRest: Record<ButtonTone, string> = {
  ink: 'bg-ink text-paper',
  paprika: 'bg-paprika text-ink',
  citrus: 'bg-citrus text-ink',
  paper: 'bg-paper text-ink',
};
const toneWipe: Record<ButtonTone, string> = {
  ink: 'bg-paprika text-ink',
  paprika: 'bg-ink text-paper',
  citrus: 'bg-paper text-ink',
  paper: 'bg-citrus text-ink',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-ui gap-2',
  md: 'h-12 px-6 text-ui gap-2.5',
  lg: 'h-14 px-8 text-[1.0625rem] gap-3',
};

export function buttonClasses({
  variant = 'fill',
  tone = 'ink',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    'group/btn relative isolate inline-flex shrink-0 select-none items-center justify-center overflow-hidden whitespace-nowrap rounded-pill font-sans font-semibold leading-none',
    'transition-[box-shadow,color,background-color,opacity] duration-200',
    'disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40',
    variant === 'fill' && toneRest[tone],
    variant === 'outline' && 'border-[1.5px] border-current bg-transparent',
    variant === 'text' && 'h-auto px-0 underline-offset-[6px]',
    variant !== 'text' && sizes[size],
    className,
  );
}

interface Common {
  children: ReactNode;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  effect?: ButtonEffect;
  state?: ActionState;
  /** trailing icon (arrows are mirrored in RTL by the caller via `mirror-rtl`) */
  icon?: ReactNode;
  className?: string;
}

/** Label with "text-roll": the label slides up and an identical copy rolls in from below. */
export function RollLabel({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <span
        className={cn(
          'inline-flex items-center transition-transform duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/btn:-translate-y-full',
          active && '-translate-y-full',
        )}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 inline-flex translate-y-full items-center transition-transform duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/btn:translate-y-0',
          active && 'translate-y-0',
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** Content + wipe layers + loading/success/error choreography shared by button and link. */
export function ButtonInner({
  children,
  variant = 'fill',
  tone = 'ink',
  effect = 'wipe',
  state = 'idle',
  icon,
}: Omit<Common, 'className' | 'size'>) {
  const dir = useDir();
  // a result stays until its tick / cross has played in full
  const shown = useHeldState(state);
  const busy = shown !== 'idle';
  const label = (
    <span className="relative z-10 inline-flex items-center gap-[inherit]">
      {effect === 'roll' ? <RollLabel>{children}</RollLabel> : children}
      {icon && (
        <span className="inline-flex transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1">
          {icon}
        </span>
      )}
    </span>
  );

  return (
    <>
      {variant !== 'text' && effect !== 'none' && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 -z-0 transition-[clip-path] duration-[520ms] ease-[cubic-bezier(0.76,0,0.24,1)]',
            variant === 'fill'
              ? toneWipe[tone]
              : tone === 'citrus' || tone === 'paper'
                ? 'bg-citrus text-ink'
                : 'bg-ink text-paper',
            dir === 1
              ? '[clip-path:inset(0_100%_0_0)] group-hover/btn:[clip-path:inset(0_0_0_0)]'
              : '[clip-path:inset(0_0_0_100%)] group-hover/btn:[clip-path:inset(0_0_0_0)]',
          )}
        />
      )}
      {/* The wipe layer carries its own copy of the label so the text colour flips exactly under it. */}
      {variant !== 'text' && effect !== 'none' && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 z-20 inline-flex items-center justify-center gap-[inherit] px-[inherit] transition-[clip-path] duration-[520ms] ease-[cubic-bezier(0.76,0,0.24,1)]',
            variant === 'fill'
              ? toneWipe[tone].split(' ').find((c) => c.startsWith('text-'))
              : tone === 'citrus' || tone === 'paper'
                ? 'text-ink'
                : 'text-paper',
            dir === 1
              ? '[clip-path:inset(0_100%_0_0)] group-hover/btn:[clip-path:inset(0_0_0_0)]'
              : '[clip-path:inset(0_0_0_100%)] group-hover/btn:[clip-path:inset(0_0_0_0)]',
            busy && 'opacity-0',
          )}
        >
          {effect === 'roll' ? <RollLabel>{children}</RollLabel> : children}
          {/* moves with the label's own arrow (same curve, same time): the two never part, so the
              old-coloured arrow can never peek out from under this one */}
          {icon && (
            <span className="inline-flex transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1">
              {icon}
            </span>
          )}
        </span>
      )}
      {/* the label keeps its place (the button never changes width); the mark takes the centre */}
      <span className="relative z-10 inline-flex items-center gap-[inherit]">
        <StatusSwap state={shown}>{label}</StatusSwap>
      </span>
    </>
  );
}

/** Pointer-follow for the "magnetic" effect (fine pointers only, off for reduced motion). */
export function useMagnet(strength = 0.28) {
  const fine = useFinePointer();
  const level = useMotionLevel();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, spring.magnet);
  const sy = useSpring(y, spring.magnet);
  const enabled = fine && level === 'full';
  const handlers = enabled
    ? {
        onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
          const r = e.currentTarget.getBoundingClientRect();
          x.set((e.clientX - (r.left + r.width / 2)) * strength);
          y.set((e.clientY - (r.top + r.height / 2)) * strength);
        },
        onPointerLeave: () => {
          x.set(0);
          y.set(0);
        },
      }
    : {};
  return { style: enabled ? { x: sx, y: sy } : undefined, handlers };
}

export type MotionButtonProps = Common & Omit<HTMLMotionProps<'button'>, 'children' | 'ref'>;

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(function MotionButton(
  {
    children,
    variant = 'fill',
    tone = 'ink',
    size = 'md',
    effect = 'wipe',
    state = 'idle',
    icon,
    className,
    disabled,
    ...rest
  },
  ref,
) {
  const magnet = useMagnet();
  const dir = useDir();
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  useImperativeHandle(ref, () => scope.current, [scope]);
  const prev = useRef(state);
  useEffect(() => {
    // Error: short horizontal shake (mirrored in RTL). Focus is kept — the node never remounts.
    if (state === 'error' && prev.current !== 'error' && scope.current) {
      const d = 4 * dir;
      animate(scope.current, { x: [0, -d, d, -d, d, 0] }, { duration: 0.28, ease: 'easeOut' });
    }
    prev.current = state;
  }, [state, animate, scope, dir]);

  return (
    <motion.button
      ref={scope}
      type="button"
      disabled={disabled}
      aria-busy={state === 'loading' || undefined}
      data-state={state}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={spring.snappy}
      style={effect === 'magnetic' ? magnet.style : undefined}
      {...(effect === 'magnetic' ? magnet.handlers : {})}
      className={cn(buttonClasses({ variant, tone, size }), className)}
      {...rest}
    >
      <ButtonInner
        variant={variant}
        tone={tone}
        effect={effect === 'magnetic' ? 'wipe' : effect}
        state={state}
        icon={icon}
      >
        {children}
      </ButtonInner>
    </motion.button>
  );
});

/** Arrow that points along the reading direction. */
export function ArrowIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className={cn('mirror-rtl', className)}
    >
      <path
        d="M4 12h15M13 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
