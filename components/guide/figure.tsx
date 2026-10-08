'use client';

import { motion } from 'motion/react';
import { ease, spring } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';

/*
 * The "how to use it" pictures (DESIGN.md v1.34): a schematic of each screen — blocks, not
 * screenshots, so they hold in every language and both themes — with numbered pins that match the
 * steps beside it. Colours come from --g-* variables set by the page (portal or dietitian panel).
 *
 * Tones: s soft block · m mid block · k strong · a accent · q faint block on a strong one ·
 * o outline.
 */

type Tone = 's' | 'm' | 'k' | 'a' | 'q' | 'o';
type Rect = [x: number, y: number, w: number, h: number, tone: Tone, r?: number];
interface Fig {
  rects: Rect[];
  /** cx, cy, r, filled share, drawn on a strong block */
  rings?: [number, number, number, number, boolean?][];
  paths?: [d: string, tone: 'k' | 'a'][];
  pins: [x: number, y: number][];
}

const row = (n: number, fn: (i: number) => Rect[]) =>
  Array.from({ length: n }, (_, i) => fn(i)).flat();

const FIGS = {
  today: {
    rects: [
      [8, 8, 304, 54, 'k', 12],
      [62, 24, 70, 4, 'q', 2],
      [62, 33, 54, 4, 'q', 2],
      [62, 42, 62, 4, 'a', 2],
      [228, 16, 36, 17, 'q', 5],
      [268, 16, 36, 17, 'q', 5],
      [228, 37, 36, 17, 'q', 5],
      [268, 37, 36, 17, 'q', 5],
      [8, 70, 148, 122, 's', 10],
      [18, 84, 128, 12, 'm', 6],
      [18, 84, 78, 12, 'a', 6],
      [18, 104, 128, 10, 'm', 5],
      [18, 118, 128, 10, 'm', 5],
      [18, 136, 128, 14, 'm', 7],
      [70, 138, 22, 10, 'k', 5],
      [18, 158, 60, 12, 'o', 6],
      [164, 70, 148, 48, 's', 10],
      [172, 78, 16, 16, 'k', 8],
      [194, 78, 100, 12, 'm', 6],
      [172, 98, 132, 12, 'o', 6],
      [164, 124, 148, 68, 's', 10],
      ...row(3, (i) => [
        [174, 134 + i * 18, 8, 8, i === 0 ? 'a' : 'm', 4] as Rect,
        [188, 134 + i * 18, 78 - i * 6, 8, 'm', 4] as Rect,
        [276, 132 + i * 18, 28, 12, i === 0 ? 'k' : 'o', 6] as Rect,
      ]),
    ],
    rings: [[36, 35, 15, 0.65, true]],
    pins: [
      [82, 90],
      [36, 35],
      [290, 138],
      [238, 84],
    ],
  },
  plan: {
    rects: [
      ...row(7, (i) => [[8 + i * 44, 10, 38, 16, i === 2 ? 'k' : 's', 8] as Rect]),
      [8, 34, 304, 22, 's', 8],
      [16, 40, 50, 10, 'm', 5],
      [72, 40, 50, 10, 'm', 5],
      [128, 40, 50, 10, 'm', 5],
      [262, 39, 42, 12, 'o', 6],
      ...row(3, (i) => [
        [8, 64 + i * 44, 304, 38, 's', 10] as Rect,
        [18, 72 + i * 44, 60, 7, 'k', 3] as Rect,
        [18, 85 + i * 44, 150 - i * 20, 6, 'm', 3] as Rect,
        [262, 77 + i * 44, 42, 12, 'm', 6] as Rect,
      ]),
    ],
    pins: [
      [115, 18],
      [150, 45],
      [100, 83],
      [283, 45],
    ],
  },
  diary: {
    rects: [
      ...row(7, (i) => [[8 + i * 30, 10, 24, 24, i === 5 ? 'k' : 's', 7] as Rect]),
      [226, 10, 86, 182, 's', 10],
      ...row(3, (i) => [
        [238, 92 + i * 16, 62, 5, 'm', 2] as Rect,
        [238, 92 + i * 16, 40 - i * 9, 5, 'a', 2] as Rect,
      ]),
      ...row(3, (i) => [
        [8, 44 + i * 50, 210, 44, 's', 10] as Rect,
        [18, 52 + i * 50, 54, 7, 'k', 3] as Rect,
        [18, 66 + i * 50, 110 - i * 14, 6, 'm', 3] as Rect,
        [140, 62 + i * 50, 22, 18, 'm', 4] as Rect,
        [172, 52 + i * 50, 36, 13, i === 0 ? 'k' : 'o', 6] as Rect,
      ]),
    ],
    rings: [[269, 52, 24, 0.6]],
    pins: [
      [95, 22],
      [190, 58],
      [151, 121],
      [269, 52],
    ],
  },
  chart: {
    rects: [
      ...row(3, (i) => [
        [8 + i * 103, 10, 97, 36, 's', 10] as Rect,
        [16 + i * 103, 18, 40, 6, 'm', 3] as Rect,
        [16 + i * 103, 30, 56, 8, 'k', 4] as Rect,
      ]),
      [8, 54, 196, 138, 's', 10],
      [120, 62, 24, 10, 'm', 5],
      [148, 62, 24, 10, 'k', 5],
      [176, 62, 20, 10, 'm', 5],
      [212, 54, 100, 138, 's', 10],
      ...row(25, (i) => [
        [
          222 + (i % 5) * 17,
          78 + Math.floor(i / 5) * 21,
          13,
          13,
          [1, 2, 4, 5, 6, 8, 11, 12, 13, 15, 18, 19, 22].includes(i) ? 'a' : 'm',
          3,
        ] as Rect,
      ]),
    ],
    paths: [
      ['M20 100H192', 'a'],
      ['M20 168L50 158L80 162L110 140L140 132L170 112L192 104', 'k'],
    ],
    pins: [
      [56, 28],
      [158, 67],
      [110, 140],
      [262, 110],
    ],
  },
  chat: {
    rects: [
      [8, 8, 304, 26, 's', 10],
      [16, 13, 16, 16, 'k', 8],
      [38, 17, 70, 8, 'm', 4],
      [16, 44, 150, 20, 's', 10],
      [130, 72, 174, 20, 'k', 10],
      [16, 100, 120, 30, 's', 10],
      [24, 108, 60, 14, 'm', 5],
      [16, 140, 70, 14, 'o', 7],
      [92, 140, 80, 14, 'o', 7],
      [178, 140, 60, 14, 'o', 7],
      [8, 162, 304, 30, 's', 15],
      [16, 170, 14, 14, 'm', 7],
      [282, 168, 22, 18, 'a', 9],
    ],
    pins: [
      [160, 177],
      [23, 177],
      [130, 147],
      [91, 54],
    ],
  },
  inbox: {
    rects: [
      [8, 8, 96, 184, 's', 10],
      [12, 44, 88, 26, 'm', 8],
      ...row(5, (i) => [
        [16, 18 + i * 30, 18, 18, i === 1 ? 'k' : 'm', 9] as Rect,
        [40, 24 + i * 30, 50, 6, i === 1 ? 'k' : 'm', 3] as Rect,
      ]),
      [92, 14, 7, 7, 'a', 3.5],
      [112, 8, 200, 184, 's', 10],
      [122, 20, 110, 18, 'm', 9],
      [182, 46, 120, 18, 'k', 9],
      [122, 72, 90, 28, 'm', 9],
      [130, 80, 50, 12, 's', 4],
      [122, 160, 180, 22, 'o', 11],
      [128, 165, 12, 12, 'm', 6],
      [282, 163, 16, 16, 'a', 8],
    ],
    pins: [
      [56, 57],
      [212, 171],
      [134, 171],
      [95, 17],
    ],
  },
  care: {
    rects: [
      [8, 10, 150, 56, 'k', 10],
      [16, 18, 30, 40, 'q', 6],
      [54, 24, 70, 7, 'q', 3],
      [54, 36, 90, 5, 'q', 2],
      [100, 47, 50, 12, 'a', 6],
      [8, 74, 150, 26, 's', 8],
      [18, 83, 70, 7, 'm', 3],
      [118, 81, 32, 12, 'm', 6],
      [8, 106, 150, 26, 's', 8],
      [18, 115, 60, 7, 'm', 3],
      [118, 113, 32, 12, 'k', 6],
      [166, 10, 146, 110, 's', 10],
      [176, 20, 80, 8, 'k', 4],
      ...row(8, (i) => [[176 + i * 16, 38, 13, 6, i < 5 ? 'a' : 'm', 3] as Rect]),
      [176, 58, 36, 22, 'm', 6],
      [218, 58, 36, 22, 'm', 6],
      [260, 58, 42, 22, 'm', 6],
      [176, 92, 100, 6, 'm', 3],
      [166, 128, 146, 64, 's', 10],
      ...row(3, (i) => [
        [176, 138 + i * 16, 70, 6, 'm', 3] as Rect,
        [270, 138 + i * 16, 32, 6, 'k', 3] as Rect,
      ]),
    ],
    pins: [
      [30, 38],
      [125, 53],
      [239, 41],
      [239, 160],
    ],
  },
  form: {
    rects: [
      [8, 8, 190, 184, 's', 10],
      ...row(3, (i) => [
        [18, 20 + i * 36, 50, 6, 'm', 3] as Rect,
        [18, 30 + i * 36, 170, 16, 'o', 8] as Rect,
      ]),
      [18, 136, 60, 16, 'k', 8],
      [206, 8, 106, 86, 's', 10],
      [216, 18, 60, 7, 'k', 3],
      [216, 34, 86, 14, 'o', 7],
      [216, 58, 86, 14, 'o', 7],
      [206, 102, 106, 90, 's', 10],
      [216, 112, 60, 7, 'k', 3],
      [216, 128, 86, 16, 'm', 8],
      [216, 152, 86, 16, 'o', 8],
    ],
    pins: [
      [100, 38],
      [259, 41],
      [100, 110],
      [259, 136],
    ],
  },
  dash: {
    rects: [
      [8, 8, 304, 26, 's', 10],
      [18, 16, 90, 9, 'k', 4],
      ...row(4, (i) => [[220 + i * 22, 13, 16, 16, 'm', 8] as Rect]),
      ...row(4, (i) => [
        [8 + i * 77, 42, 71, 36, 's', 10] as Rect,
        [16 + i * 77, 50, 30, 5, 'm', 2] as Rect,
        [16 + i * 77, 62, 44, 9, 'k', 3] as Rect,
      ]),
      [8, 86, 188, 106, 's', 10],
      [140, 93, 48, 11, 'm', 5],
      [204, 86, 108, 106, 's', 10],
      [212, 94, 92, 13, 'o', 6],
      ...row(4, (i) => [
        [214, 116 + i * 18, 9, 9, i === 0 ? 'a' : 'o', 4.5] as Rect,
        [228, 117 + i * 18, 66 - i * 8, 6, 'm', 3] as Rect,
      ]),
    ],
    paths: [['M20 172L46 160L72 166L98 142L124 148L150 124L184 114', 'k']],
    pins: [
      [264, 21],
      [44, 60],
      [164, 98],
      [258, 100],
    ],
  },
  list: {
    rects: [
      [8, 10, 150, 20, 's', 10],
      [8, 10, 42, 20, 'k', 10],
      [166, 13, 40, 14, 'm', 7],
      [210, 13, 40, 14, 'm', 7],
      [262, 10, 50, 20, 'a', 10],
      [8, 40, 304, 152, 's', 10],
      [18, 50, 284, 6, 'm', 3],
      ...row(5, (i) => [
        [18, 66 + i * 25, 16, 16, 'm', 8] as Rect,
        [42, 68 + i * 25, 80 - (i % 3) * 12, 6, 'k', 3] as Rect,
        [42, 77 + i * 25, 50, 4, 'm', 2] as Rect,
        [200, 68 + i * 25, 36, 12, i % 2 ? 'm' : 'a', 6] as Rect,
        [270, 68 + i * 25, 32, 12, 'o', 6] as Rect,
      ]),
    ],
    pins: [
      [83, 20],
      [287, 20],
      [82, 74],
      [208, 20],
    ],
  },
  profile: {
    rects: [
      [8, 8, 304, 40, 's', 10],
      [16, 14, 28, 28, 'k', 14],
      [52, 18, 90, 9, 'k', 4],
      [52, 32, 60, 5, 'm', 2],
      [250, 18, 54, 18, 'a', 9],
      ...row(6, (i) => [[8 + i * 51, 56, 46, 14, i === 1 ? 'k' : 's', 7] as Rect]),
      [8, 78, 150, 114, 's', 10],
      [18, 88, 60, 7, 'k', 3],
      [166, 78, 146, 52, 's', 10],
      [176, 88, 60, 7, 'k', 3],
      [176, 102, 120, 5, 'm', 2],
      [176, 113, 90, 5, 'm', 2],
      [166, 138, 146, 54, 's', 10],
      [176, 148, 60, 7, 'k', 3],
      [176, 162, 110, 5, 'm', 2],
      [176, 173, 126, 8, 'a', 4],
    ],
    paths: [['M18 174L44 164L70 168L96 150L122 142L148 128', 'k']],
    pins: [
      [82, 63],
      [82, 146],
      [239, 104],
      [277, 27],
    ],
  },
  invite: {
    rects: [
      [8, 8, 304, 184, 's', 12],
      [20, 20, 110, 9, 'k', 4],
      [20, 40, 200, 22, 'o', 8],
      [28, 48, 150, 6, 'm', 3],
      [228, 40, 72, 22, 'k', 8],
      [20, 72, 110, 20, 'a', 10],
      [20, 104, 150, 6, 'm', 3],
      [20, 116, 120, 6, 'm', 3],
      [20, 150, 90, 16, 'o', 8],
      [200, 76, 100, 100, 'm', 8],
      [210, 86, 22, 22, 'k', 3],
      [268, 86, 22, 22, 'k', 3],
      [210, 144, 22, 22, 'k', 3],
      [244, 120, 14, 14, 'k', 2],
      [270, 146, 10, 10, 'k', 2],
    ],
    pins: [
      [120, 51],
      [75, 82],
      [250, 126],
      [65, 158],
    ],
  },
  calendar: {
    rects: [
      [8, 10, 70, 18, 's', 9],
      [86, 10, 60, 18, 'm', 9],
      [86, 10, 30, 18, 'k', 9],
      [252, 10, 60, 18, 'a', 9],
      [8, 36, 304, 156, 's', 10],
      ...row(7, (i) => [[18 + i * 42, 44, 30, 6, 'm', 3] as Rect]),
      [18, 60, 34, 30, 'k', 5],
      [60, 84, 34, 22, 'm', 5],
      [102, 60, 34, 40, 'm', 5],
      [186, 110, 34, 26, 'k', 5],
      [228, 70, 34, 22, 'm', 5],
      [270, 130, 34, 30, 'm', 5],
      [144, 140, 34, 24, 'a', 5],
    ],
    pins: [
      [282, 19],
      [116, 19],
      [35, 75],
      [161, 152],
    ],
  },
  explorer: {
    rects: [
      [8, 84, 22, 32, 'm', 8],
      [290, 84, 22, 32, 'm', 8],
      [38, 10, 244, 182, 's', 12],
      [50, 22, 30, 30, 'k', 15],
      [88, 26, 90, 9, 'k', 4],
      [88, 40, 60, 5, 'm', 2],
      [230, 26, 40, 10, 'm', 5],
      [130, 80, 60, 24, 'm', 6],
      [196, 80, 74, 24, 'm', 6],
      [130, 110, 140, 24, 'm', 6],
      [50, 150, 220, 14, 'o', 7],
      [50, 170, 70, 14, 'k', 7],
    ],
    rings: [[82, 106, 24, 0.55]],
    pins: [
      [19, 100],
      [82, 106],
      [200, 92],
      [85, 177],
    ],
  },
  chrome: {
    rects: [
      [8, 8, 56, 184, 's', 10],
      ...row(7, (i) => [[16, 18 + i * 16, 40, 8, i === 1 ? 'k' : 'm', 4] as Rect]),
      [16, 150, 40, 8, 'm', 4],
      [16, 166, 40, 8, 'm', 4],
      [72, 8, 240, 20, 's', 8],
      [78, 11, 50, 14, 'k', 6],
      [132, 11, 50, 14, 'm', 6],
      [186, 11, 50, 14, 'm', 6],
      [240, 11, 14, 14, 'a', 7],
      [100, 50, 184, 112, 's', 12],
      [110, 60, 164, 18, 'o', 9],
      ...row(4, (i) => [[110, 86 + i * 18, 164, 12, i === 0 ? 'k' : 'm', 6] as Rect]),
    ],
    pins: [
      [247, 18],
      [192, 69],
      [36, 38],
      [36, 158],
    ],
  },
} satisfies Record<string, Fig>;

export type FigureKind = keyof typeof FIGS;

const FILL: Record<Tone, string> = {
  s: 'var(--g-soft)',
  m: 'var(--g-mid)',
  k: 'var(--g-ink)',
  a: 'var(--g-acc)',
  q: 'var(--g-faint)',
  o: 'none',
};

export function GuideFigure({
  kind,
  pins,
  active,
  onPick,
  label,
}: {
  kind: FigureKind;
  /** how many pins to show (one per step) */
  pins: number;
  /** the step being read, from 0; -1 for none */
  active: number;
  onPick: (i: number) => void;
  label: string;
}) {
  const reduced = usePrefersReducedMotion();
  const fig: Fig = FIGS[kind];
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={label} className="block h-auto w-full">
      <motion.g
        key={kind}
        initial={{ opacity: 0, y: reduced ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: ease.out }}
      >
        {fig.rects.map(([x, y, w, h, tone, r = 0], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={r}
            fill={FILL[tone]}
            stroke={tone === 'o' ? 'var(--g-mid)' : undefined}
            strokeWidth={tone === 'o' ? 1.5 : undefined}
          />
        ))}
        {fig.rings?.map(([cx, cy, r, share, onInk], i) => {
          const c = 2 * Math.PI * r;
          return (
            <g key={i} transform={`rotate(-90 ${cx} ${cy})`} fill="none" strokeWidth={r / 3}>
              <circle cx={cx} cy={cy} r={r} stroke={onInk ? 'var(--g-faint)' : 'var(--g-mid)'} />
              <motion.circle
                cx={cx}
                cy={cy}
                r={r}
                stroke="var(--g-acc)"
                strokeLinecap="round"
                strokeDasharray={c}
                initial={{ strokeDashoffset: reduced ? c * (1 - share) : c }}
                animate={{ strokeDashoffset: c * (1 - share) }}
                transition={{ duration: reduced ? 0 : 0.9, ease: ease.out, delay: 0.15 }}
              />
            </g>
          );
        })}
        {fig.paths?.map(([d, tone], i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke={tone === 'a' ? 'var(--g-acc)' : 'var(--g-ink)'}
            strokeWidth={tone === 'a' ? 1.5 : 2.5}
            strokeDasharray={tone === 'a' ? '4 4' : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={tone === 'a' ? { opacity: 0 } : { pathLength: reduced ? 1 : 0 }}
            animate={tone === 'a' ? { opacity: 1 } : { pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 0.9, ease: ease.out, delay: 0.15 }}
          />
        ))}
      </motion.g>

      {fig.pins.slice(0, pins).map(([x, y], i) => {
        const on = i === active;
        return (
          <motion.g
            key={`${kind}-${i}`}
            initial={{ scale: reduced ? 1 : 0 }}
            animate={{ scale: on ? 1.25 : 1 }}
            transition={
              reduced ? { duration: 0 } : { ...spring.snappy, delay: on ? 0 : 0.25 + i * 0.07 }
            }
            style={{ transformOrigin: `${x}px ${y}px`, cursor: 'pointer' }}
            onMouseEnter={() => onPick(i)}
            onClick={() => onPick(i)}
            aria-hidden
          >
            {on && !reduced && (
              <motion.circle
                cx={x}
                cy={y}
                r={10}
                fill="none"
                stroke="var(--g-pin)"
                strokeWidth={1.5}
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: 1.9, opacity: 0 }}
                transition={{ duration: 1.3, ease: 'easeOut', repeat: Infinity }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={10}
              fill={on ? 'var(--g-pin-on)' : 'var(--g-pin)'}
              stroke="var(--g-bg)"
              strokeWidth={2}
            />
            <text
              x={x}
              y={y + 3.6}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={on ? 'var(--g-pin-on-text)' : 'var(--g-pin-text)'}
            >
              {i + 1}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
