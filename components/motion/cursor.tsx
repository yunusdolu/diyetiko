'use client';

import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useState } from 'react';
import { useFinePointer, useMotionLevel } from '@/lib/motion/hooks';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Custom cursor companion: a small dot + a ring that swells over interactive elements and
 * shows a label over [data-cursor="…"] elements (plus an arrow with [data-cursor-arrow]). Colours follow the section underneath
 * (.on-dark → citrus, otherwise ink). The system cursor stays visible (never replaced).
 * Fine pointer + full motion only. Positioned with physical left/top (pointer coords are
 * physical even in RTL).
 */
export function Cursor() {
  const fine = useFinePointer();
  const level = useMotionLevel();
  const enabled = fine && level === 'full';
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, spring.follow);
  const ry = useSpring(y, spring.follow);
  const [label, setLabel] = useState<string | null>(null);
  const [arrow, setArrow] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let last: { x: number; y: number } | null = null;
    const evaluate = (el: Element | null, px: number, py: number) => {
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) {
        setDark(Boolean(el.closest('.on-dark')));
        setVisible(false);
        return;
      }
      setVisible(true);
      const target = el?.closest<HTMLElement>(
        '[data-cursor], a, button, [role="button"], label, summary',
      );
      setHovering(Boolean(target));
      // The label belongs to the element that carries data-cursor. A link stretched over a whole
      // card ([data-cursor-zones]) hides what is under it: look through it, so the label shows
      // only over the labelled zone (the recipe image), not over the card's text.
      const zone =
        target?.dataset.cursor !== undefined
          ? target
          : target?.hasAttribute('data-cursor-zones')
            ? (document
                .elementsFromPoint(px, py)
                .find(
                  (n): n is HTMLElement =>
                    n instanceof HTMLElement && n.dataset.cursor !== undefined,
                ) ?? null)
            : null;
      setLabel(zone?.dataset.cursor ?? null);
      setArrow(zone?.dataset.cursorArrow !== undefined);
      // [data-cursor-dark]: elements that turn dark under the pointer (hover:bg-ink cards)
      setDark(Boolean((zone ?? el)?.closest('.on-dark, [data-cursor-dark]')));
    };
    const move = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY };
      x.set(e.clientX);
      y.set(e.clientY);
      evaluate(e.target as Element | null, e.clientX, e.clientY);
    };
    // Scrolling moves the page under a still pointer: re-check what is under it now, so the
    // ring doesn't stay "hovering" over something that has scrolled away.
    const scroll = () => {
      if (last) evaluate(document.elementFromPoint(last.x, last.y), last.x, last.y);
    };
    const leave = () => {
      last = null;
      setVisible(false);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', scroll);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <motion.div
        className={cn('absolute size-1.5 rounded-full', dark ? 'bg-citrus' : 'bg-paprika')}
        style={{ x, y, left: -3, top: -3 }}
        animate={{ opacity: visible && !hovering ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      />
      <motion.div
        className={cn(
          'absolute grid place-items-center rounded-full border-[1.5px] font-sans text-[0.75rem] font-semibold',
          dark ? 'border-citrus text-ink' : 'border-ink text-paper',
          // a thin outline in the opposite tone keeps the label disc visible on any surface
          // (e.g. the dark data layer of a recipe card, which is not an .on-dark section)
          label &&
            (dark
              ? 'bg-citrus shadow-[0_0_0_2px_var(--color-ink)]'
              : 'bg-ink shadow-[0_0_0_2px_var(--color-paper)]'),
        )}
        style={{ x: rx, y: ry, left: 0, top: 0, translateX: '-50%', translateY: '-50%' }}
        animate={{
          width: label ? 88 : hovering ? 56 : 32,
          height: label ? 88 : hovering ? 56 : 32,
          opacity: visible ? (hovering || label ? 1 : 0.55) : 0,
        }}
        transition={spring.soft}
      >
        <AnimatePresence>
          {label && (
            <motion.span
              key={label}
              className="flex flex-col items-center gap-1 px-2 text-center leading-tight"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
            >
              {label}
              {arrow && (
                <motion.svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  className="mirror-rtl"
                  initial={{ x: -4 }}
                  animate={{ x: [-3, 3, -3] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
