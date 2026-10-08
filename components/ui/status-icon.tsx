'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';

export type ActionState = 'idle' | 'loading' | 'success' | 'error';

/** How long a result (tick / cross) stays on the button, however soon the caller resets. */
const RESULT_MS = 1000;
/** The ring closes, then the mark draws: the order a result is read in. */
const CLOSE_S = 0.32;
const MARK_S = 0.3;

/**
 * The state a button should SHOW: a success or error is held until its animation has played in
 * full (callers often go back to idle after 400 ms, which cut the tick half-way).
 */
export function useHeldState(state: ActionState): ActionState {
  const [shown, setShown] = useState(state);
  const since = useRef(0);
  useEffect(() => {
    if (state === 'success' || state === 'error') {
      since.current = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(state);
      return;
    }
    if ((shown === 'success' || shown === 'error') && state === 'idle') {
      const left = RESULT_MS - (Date.now() - since.current);
      if (left > 0) {
        const id = window.setTimeout(() => setShown('idle'), left);
        return () => window.clearTimeout(id);
      }
    }
    setShown(state);
  }, [state, shown]);
  return shown;
}

/**
 * One continuous mark for every button: while loading, an arc turns on a faint ring; when the
 * answer comes, the arc stops where it is and closes into a full ring, and only then is the tick
 * (or cross) drawn, centred inside it. A closed ring looks the same at any angle, so stopping the
 * spin never shows a jump.
 */
export function StatusIcon({ state, size = 20 }: { state: ActionState; size?: number }) {
  const reduced = usePrefersReducedMotion();
  const done = state === 'success' || state === 'error';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="block">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="2.25"
      />
      <g
        className="status-spin"
        style={{
          transformOrigin: '12px 12px',
          // the spin freezes at its current angle when the result arrives
          animationPlayState: done || reduced ? 'paused' : 'running',
        }}
      >
        <motion.circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
          initial={{ pathLength: 0.28 }}
          animate={{ pathLength: done ? 1 : 0.28 }}
          transition={{ duration: reduced ? 0 : CLOSE_S, ease: [0.16, 1, 0.3, 1] }}
        />
      </g>
      {state === 'success' && (
        <motion.path
          d="M7.6 12.4l3.1 3.1 5.8-6.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            duration: reduced ? 0 : MARK_S,
            delay: reduced ? 0 : CLOSE_S * 0.8,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      )}
      {state === 'error' && (
        <motion.path
          d="M8.7 8.7l6.6 6.6M15.3 8.7l-6.6 6.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            duration: reduced ? 0 : MARK_S,
            delay: reduced ? 0 : CLOSE_S * 0.8,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      )}
    </svg>
  );
}

/**
 * The label and the status share one box: the label keeps its place (so the button never
 * changes width), fading up and out; the mark rises into the exact centre.
 */
export function StatusSwap({
  state,
  children,
  size,
}: {
  state: ActionState;
  children: React.ReactNode;
  size?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const busy = state !== 'idle';
  const t = { duration: reduced ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] as const };
  return (
    <span className="relative inline-grid place-items-center gap-[inherit]">
      <motion.span
        className="col-start-1 row-start-1 inline-flex items-center gap-[inherit]"
        initial={false}
        animate={{ opacity: busy ? 0 : 1, y: busy && !reduced ? '-60%' : '0%' }}
        transition={t}
        aria-hidden={busy || undefined}
      >
        {children}
      </motion.span>
      {/* one fresh mark per busy spell; leaving, it keeps its last state while it fades */}
      <AnimatePresence initial={false}>
        {busy && (
          <motion.span
            key="status"
            className="pointer-events-none col-start-1 row-start-1 grid place-items-center"
            initial={{ opacity: 0, y: reduced ? '0%' : '60%' }}
            animate={{ opacity: 1, y: '0%' }}
            exit={{ opacity: 0, y: reduced ? '0%' : '-40%' }}
            transition={t}
            aria-hidden
          >
            <StatusIcon state={state} size={size} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
