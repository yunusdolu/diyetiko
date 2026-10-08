'use client';

import { backOut, motion, useTransform, type MotionValue } from 'motion/react';
import type { SVGProps } from 'react';

/**
 * One micro-graphic per process step, driven by SCROLL: `progress` (0 → 1) comes from the
 * reader's scroll position, so every stroke draws while scrolling down and un-draws while
 * scrolling back up. Nothing plays on a timer. Reduced motion passes a constant 1 (end state).
 */
type P = { progress: MotionValue<number> };

/** A stroke that draws between progress a → b (hidden at 0 so round caps leave no dot). */
function DrawPath({
  p,
  a,
  b,
  ...rest
}: { p: MotionValue<number>; a: number; b: number } & Omit<SVGProps<SVGPathElement>, 'ref'>) {
  const pathLength = useTransform(p, [a, b], [0, 1]);
  const opacity = useTransform(p, [a, a + 0.004], [0, 1]);
  return <motion.path {...(rest as object)} style={{ pathLength, opacity }} />;
}

function DrawCircle({
  p,
  a,
  b,
  ...rest
}: { p: MotionValue<number>; a: number; b: number } & Omit<SVGProps<SVGCircleElement>, 'ref'>) {
  const pathLength = useTransform(p, [a, b], [0, 1]);
  const opacity = useTransform(p, [a, a + 0.004], [0, 1]);
  return <motion.circle {...(rest as object)} style={{ pathLength, opacity }} />;
}

/** Scales in around its own centre between a → b, with a little overshoot. */
function Pop({
  p,
  a,
  b,
  children,
}: {
  p: MotionValue<number>;
  a: number;
  b: number;
  children: React.ReactNode;
}) {
  const scale = useTransform(p, [a, b], [0, 1], { ease: backOut });
  return (
    <motion.g style={{ scale, transformBox: 'fill-box', originX: 0.5, originY: 0.5 }}>
      {children}
    </motion.g>
  );
}

/** Fades and rises into place between a → b. */
function Rise({
  p,
  a,
  b,
  children,
}: {
  p: MotionValue<number>;
  a: number;
  b: number;
  children: React.ReactNode;
}) {
  const opacity = useTransform(p, [a, b], [0, 1]);
  const y = useTransform(p, [a, b], [14, 0]);
  return <motion.g style={{ opacity, y }}>{children}</motion.g>;
}

/* ------------------------------------------------------------------------------------------- */

const LINES = 7;
const lineStart = (i: number) => 0.04 + i * 0.085;
const LINE_LEN = 0.11;
const lineEndX = (i: number) => (i === LINES - 1 ? 200 : 272);
const lineY = (i: number) => 78 + i * 30;

/** 01 — the first conversation: a notebook page written line by line (a pencil follows the
 *  writing), two speech bubbles, then the tape measure. */
export function GraphicMeet({ progress: p }: P) {
  // Pencil tip rides the line currently being written.
  const pencil = useTransform(p, (v) => {
    const i = Math.max(0, Math.min(LINES - 1, Math.floor((v - 0.04) / 0.085)));
    const f = Math.max(0, Math.min(1, (v - lineStart(i)) / LINE_LEN));
    return { x: 96 + f * (lineEndX(i) - 96), y: lineY(i) + Math.sin(f * Math.PI * 3) * 3 };
  });
  const px = useTransform(pencil, (v) => v.x);
  const py = useTransform(pencil, (v) => v.y);
  const pencilOpacity = useTransform(p, [0.02, 0.05, 0.66, 0.72], [0, 1, 1, 0]);
  return (
    <svg viewBox="0 0 400 320" className="h-auto w-full overflow-visible" aria-hidden>
      <g transform="rotate(-4 200 160)">
        <rect
          x="70"
          y="30"
          width="230"
          height="260"
          rx="6"
          transform="translate(5 5)"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <rect x="70" y="30" width="230" height="260" rx="6" fill="var(--color-paper)" />
        {/* ruled lines + margin, printed on the page */}
        {Array.from({ length: LINES }).map((_, i) => (
          <line
            key={i}
            x1="84"
            x2="288"
            y1={lineY(i) + 9}
            y2={lineY(i) + 9}
            stroke="var(--color-ink)"
            strokeOpacity=".08"
            strokeWidth="1.5"
          />
        ))}
        <line
          x1="88"
          x2="88"
          y1="34"
          y2="286"
          stroke="var(--color-paprika)"
          strokeOpacity=".35"
          strokeWidth="1.5"
        />
        {Array.from({ length: LINES }).map((_, i) => (
          <DrawPath
            key={i}
            p={p}
            a={lineStart(i)}
            b={lineStart(i) + LINE_LEN}
            d={`M96 ${lineY(i)} C ${140 + (i % 2) * 20} ${lineY(i) - 8}, ${190 - (i % 3) * 10} ${lineY(i) + 8}, ${lineEndX(i)} ${lineY(i)}`}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ))}
        <circle cx="96" cy="48" r="7" fill="var(--color-paprika)" />
        {/* the pencil */}
        <motion.g style={{ x: px, y: py, opacity: pencilOpacity }}>
          <g transform="rotate(32)">
            <rect
              x="-4"
              y="-46"
              width="9"
              height="40"
              rx="1.5"
              fill="var(--color-mustard)"
              stroke="var(--color-ink)"
              strokeWidth="2"
            />
            <rect
              x="-4"
              y="-52"
              width="9"
              height="7"
              rx="1.5"
              fill="var(--color-paprika)"
              stroke="var(--color-ink)"
              strokeWidth="2"
            />
            <path
              d="M-4 -6 L0.5 4 L5 -6 Z"
              fill="#f2d6a8"
              stroke="var(--color-ink)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M-0.8 1.2 L0.5 4 L1.8 1.2 Z" fill="var(--color-ink)" />
          </g>
        </motion.g>
      </g>
      {/* two speech bubbles: the conversation comes before the numbers */}
      <Rise p={p} a={0.16} b={0.3}>
        <path
          d="M262 26h112a14 14 0 0 1 14 14v38a14 14 0 0 1-14 14h-70l-22 18 4-18h-24a14 14 0 0 1-14-14V40a14 14 0 0 1 14-14Z"
          transform="translate(4 4)"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M262 26h112a14 14 0 0 1 14 14v38a14 14 0 0 1-14 14h-70l-22 18 4-18h-24a14 14 0 0 1-14-14V40a14 14 0 0 1 14-14Z"
          fill="var(--color-paprika)"
        />
        {[288, 318, 348].map((x) => (
          <circle key={x} cx={x} cy="59" r="6" fill="var(--color-ink)" />
        ))}
      </Rise>
      <Rise p={p} a={0.34} b={0.48}>
        <path
          d="M318 122h54a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12h-8l4 16-20-16h-30a12 12 0 0 1-12-12v-24a12 12 0 0 1 12-12Z"
          transform="translate(4 4)"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M318 122h54a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12h-8l4 16-20-16h-30a12 12 0 0 1-12-12v-24a12 12 0 0 1 12-12Z"
          fill="var(--color-citrus)"
        />
        <path d="M322 146h44" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" />
      </Rise>
      {/* tape measure */}
      <DrawPath
        p={p}
        a={0.62}
        b={0.9}
        d="M20 300 C 120 250, 180 330, 380 270"
        fill="none"
        stroke="var(--color-mustard)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      {Array.from({ length: 12 }).map((_, i) => (
        <Tick key={i} p={p} i={i} />
      ))}
    </svg>
  );
}

function Tick({ p, i }: { p: MotionValue<number>; i: number }) {
  const a = 0.66 + i * 0.02;
  const opacity = useTransform(p, [a, a + 0.04], [0, 0.6]);
  return (
    <motion.line
      x1={40 + i * 28}
      x2={40 + i * 28}
      y1={292 - Math.sin(i / 2) * 8}
      y2={302 - Math.sin(i / 2) * 8}
      stroke="var(--color-ink)"
      strokeWidth="2"
      style={{ opacity }}
    />
  );
}

/** 02 — the week fills meal by meal as you scroll. */
export function GraphicPlan({ progress: p }: P) {
  const colors = [
    'var(--color-citrus)',
    'var(--color-paprika)',
    'var(--color-mustard)',
    'var(--color-sage)',
  ];
  const headers = useTransform(p, [0, 0.08], [0.25, 0.85]);
  return (
    <svg viewBox="0 0 400 320" className="h-auto w-full overflow-visible" aria-hidden>
      {Array.from({ length: 7 }).map((_, d) => (
        <g key={d}>
          <motion.rect
            x={20 + d * 53}
            y="16"
            width="44"
            height="18"
            rx="9"
            fill="var(--color-ink)"
            style={{ opacity: headers }}
          />
          {Array.from({ length: 4 }).map((__, m) => {
            // fill order: day by day, top to bottom
            const k = d * 4 + m;
            const a = 0.06 + k * (0.74 / 28);
            return (
              <g key={m}>
                <rect
                  x={20 + d * 53}
                  y={48 + m * 66}
                  width="44"
                  height="56"
                  rx="8"
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeOpacity=".25"
                  strokeWidth="2"
                />
                <Pop p={p} a={a} b={a + 0.09}>
                  <rect
                    x={20 + d * 53}
                    y={48 + m * 66}
                    width="44"
                    height="56"
                    rx="8"
                    fill={colors[(d + m) % colors.length]}
                    stroke="var(--color-ink)"
                    strokeWidth="2"
                  />
                </Pop>
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/** 03 — follow-up: a calm, gently rising habit line; each point lands as the line reaches it. */
export function GraphicTrack({ progress: p }: P) {
  const pts = [
    [30, 230],
    [80, 210],
    [130, 220],
    [180, 180],
    [230, 190],
    [280, 150],
    [330, 140],
    [370, 110],
  ] as const;
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const LINE_A = 0.04;
  const LINE_B = 0.68;
  return (
    <svg viewBox="0 0 400 320" className="h-auto w-full overflow-visible" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="20"
          x2="385"
          y1={80 + i * 50}
          y2={80 + i * 50}
          stroke="currentColor"
          strokeOpacity=".18"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
      ))}
      <DrawPath
        p={p}
        a={LINE_A}
        b={LINE_B}
        d={d}
        fill="none"
        stroke="var(--color-citrus)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => {
        const a = LINE_A + (i / (pts.length - 1)) * (LINE_B - LINE_A) - 0.015;
        return (
          <Pop key={i} p={p} a={Math.max(0, a)} b={Math.max(0, a) + 0.07}>
            <circle
              cx={x}
              cy={y}
              r="8"
              fill="var(--color-green)"
              stroke="var(--color-citrus)"
              strokeWidth="4"
            />
          </Pop>
        );
      })}
      {Array.from({ length: 7 }).map((_, i) => (
        <g key={i} transform={`translate(${44 + i * 48} 282)`}>
          <rect
            x="-15"
            y="-15"
            width="30"
            height="30"
            rx="7"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".4"
            strokeWidth="2"
          />
          <DrawPath
            p={p}
            a={0.62 + i * 0.045}
            b={0.62 + i * 0.045 + 0.06}
            d="M-8 0l5 6 11-12"
            fill="none"
            stroke="var(--color-citrus)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}

/** 04 — outcome: the rings close with the scroll; the plate idea comes back as a whole. */
export function GraphicOutcome({ progress: p }: P) {
  return (
    <svg viewBox="0 0 400 320" className="h-auto w-full overflow-visible" aria-hidden>
      <circle
        cx="200"
        cy="160"
        r="118"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".14"
        strokeWidth="22"
      />
      <DrawCircle
        p={p}
        a={0.04}
        b={0.62}
        cx="200"
        cy="160"
        r="118"
        fill="none"
        stroke="var(--color-citrus)"
        strokeWidth="22"
        strokeLinecap="round"
        transform="rotate(-90 200 160)"
      />
      <circle
        cx="200"
        cy="160"
        r="84"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".14"
        strokeWidth="14"
      />
      <DrawCircle
        p={p}
        a={0.14}
        b={0.72}
        cx="200"
        cy="160"
        r="84"
        fill="none"
        stroke="var(--color-paprika)"
        strokeWidth="14"
        strokeLinecap="round"
        transform="rotate(-90 200 160)"
      />
      <DrawPath
        p={p}
        a={0.74}
        b={0.92}
        d="M168 162l22 24 44-52"
        fill="none"
        stroke="var(--color-paper)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const storyGraphics = [GraphicMeet, GraphicPlan, GraphicTrack, GraphicOutcome];
