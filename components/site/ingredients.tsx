/**
 * The ingredient illustration system (DESIGN.md §6).
 * Rules shared by every drawing (viewBox 0 0 200 200):
 *  - flat fills from the palette + food inks
 *  - ONE light source, upper-left: highlight crescent at ~10–11 o'clock (white, 0.35),
 *    shadow crescent at ~4–5 o'clock (ink, 0.16)
 *  - a 2.5px ink outline offset by (3, 3) under the fill: the "risograph mis-registration"
 *  - optional grain via the global #riso-grain filter (see <IllustrationDefs/>)
 * Server-safe (no hooks).
 */
import type { ReactNode, SVGProps } from 'react';

const INK = 'var(--color-ink)';
/** Round computed coordinates so server and client render identical strings. */
const f2 = (n: number) => Math.round(n * 100) / 100;
const HI = { fill: '#fff', opacity: 0.35 } as const;
const SH = { fill: INK, opacity: 0.16 } as const;

function Offset({ d, fill, grain = true }: { d: string; fill: string; grain?: boolean }) {
  return (
    <g>
      <path
        d={d}
        transform="translate(3 3)"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d={d} fill={fill} filter={grain ? 'url(#riso-grain)' : undefined} />
    </g>
  );
}

const drawings: Record<string, ReactNode> = {
  lemon: (
    <>
      <path d="M118 44c10-14 30-18 40-12-6 12-22 20-40 12Z" fill="var(--color-leaf)" />
      <Offset
        d="M26 106q1-9 12-13c20-40 112-46 136-7q10 3 11 14-1 11-11 14c-24 39-116 34-136-7q-11-4-12-11Z"
        fill="var(--color-citrus)"
      />
      <path d="M52 88c16-18 50-26 76-22-26 2-52 12-66 30Z" {...HI} />
      <path d="M160 116c-18 26-62 34-96 24 36 2 70-6 90-30Z" {...SH} />
    </>
  ),
  egg: (
    <>
      <Offset d="M100 28c40 0 68 44 68 86s-30 60-68 60-68-18-68-60 28-86 68-86Z" fill="#fbf8f1" />
      <circle cx="100" cy="118" r="34" fill="var(--color-yolk)" />
      <circle
        cx="100"
        cy="118"
        r="34"
        transform="translate(2 2)"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        opacity=".5"
      />
      <path d="M84 104c6-8 16-11 24-9-9 2-15 7-18 14Z" {...HI} opacity={0.55} />
      <path d="M58 60c10-16 26-24 40-24-14 6-28 18-34 34Z" {...HI} />
      <path d="M160 128c-6 28-30 42-60 42 24-6 44-20 52-44Z" {...SH} />
    </>
  ),
  avocado: (
    <>
      <Offset
        d="M100 20c26 0 34 30 44 56 12 30 34 44 34 70 0 28-34 42-78 42s-78-14-78-42c0-26 22-40 34-70 10-26 18-56 44-56Z"
        fill="#3f6b2f"
      />
      <path
        d="M100 36c18 0 26 26 34 48 10 26 28 40 28 60 0 22-28 32-62 32s-62-10-62-32c0-20 18-34 28-60 8-22 16-48 34-48Z"
        fill="#c9d77a"
      />
      <circle cx="100" cy="134" r="28" fill="var(--color-crust)" />
      <path d="M86 122c5-7 13-10 20-9-8 3-13 8-15 14Z" {...HI} opacity={0.6} />
      <path d="M150 150c-10 16-30 22-50 22 18-6 34-14 44-28Z" {...SH} />
    </>
  ),
  chickpea: (
    <>
      {[
        [70, 80, 30],
        [122, 72, 28],
        [96, 124, 32],
        [148, 118, 26],
        [54, 134, 24],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <Offset
            d={`M${x! - r!} ${y}a${r} ${r} 0 1 0 ${r! * 2} 0a${r} ${r} 0 1 0 ${-r! * 2} 0Z`}
            fill="#e6c48a"
          />
          <path
            d={`M${x! + r! * 0.3} ${y! - r! * 0.9}q${r! * 0.35} ${-r! * 0.25} ${r! * 0.5} ${r! * 0.1}`}
            fill="none"
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".5"
          />
          <path
            d={`M${x! - r! * 0.65} ${y! - r! * 0.1}c${r! * 0.1} ${-r! * 0.4} ${r! * 0.35} ${-r! * 0.6} ${r! * 0.6} ${-r! * 0.62}`}
            fill="none"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".4"
          />
        </g>
      ))}
    </>
  ),
  pomegranate: (
    <>
      <path d="M86 38l6-16 8 12 8-12 6 16Z" fill="#8f1f22" />
      <Offset d="M100 36c42 0 72 30 72 72s-30 72-72 72-72-30-72-72 30-72 72-72Z" fill="#b8282b" />
      <path d="M48 88c8-24 30-40 54-42-22 8-40 24-46 46Z" {...HI} />
      <path d="M162 124c-8 30-34 50-64 52 26-10 46-30 54-58Z" {...SH} />
      {[
        [168, 150],
        [180, 166],
        [158, 172],
      ].map(([x, y], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx="6"
          ry="8"
          transform={`rotate(${i * 30} ${x} ${y})`}
          fill="#e3414a"
          stroke={INK}
          strokeWidth="1.5"
        />
      ))}
    </>
  ),
  olive: (
    <>
      <path
        d="M30 150C70 120 120 90 176 40"
        fill="none"
        stroke="var(--color-olive)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M120 88c10-22 34-30 50-26-8 18-30 30-50 26Z" fill="var(--color-leaf)" />
      <path d="M88 112c-24-6-38-26-36-42 18 2 34 20 36 42Z" fill="var(--color-leaf)" />
      <Offset
        d="M76 116c20 0 34 16 34 34s-14 30-34 30-34-12-34-30 14-34 34-34Z"
        fill="var(--color-aubergine)"
      />
      <Offset
        d="M140 102c18 0 30 14 30 30s-12 28-30 28-30-12-30-28 12-30 30-30Z"
        fill="var(--color-olive)"
      />
      <path d="M58 134c4-8 10-12 18-13-6 4-10 9-12 16Z" {...HI} />
      <path d="M126 118c4-7 9-10 16-11-5 3-9 8-10 14Z" {...HI} />
    </>
  ),
  tomato: (
    <>
      <Offset
        d="M100 42c46 0 74 30 74 66 0 40-32 68-74 68s-74-28-74-68c0-36 28-66 74-66Z"
        fill="var(--color-tomato)"
      />
      <path
        d="M100 36l8 18 20-6-12 16 18 8-22 2-12 14-2-18-18 8 10-16-20-6 22-2Z"
        fill="var(--color-leaf)"
      />
      <path d="M46 94c6-22 26-38 46-42-18 10-32 24-38 44Z" {...HI} />
      <path d="M164 118c-6 30-30 50-62 54 26-10 46-28 54-56Z" {...SH} />
    </>
  ),
  fig: (
    <>
      <Offset
        d="M100 26c10 0 12 14 20 24 22 26 50 40 50 76 0 34-30 54-70 54s-70-20-70-54c0-36 28-50 50-76 8-10 10-24 20-24Z"
        fill="var(--color-aubergine)"
      />
      <path
        d="M100 58c16 18 52 36 52 68 0 26-24 40-52 40s-52-14-52-40c0-32 36-50 52-68Z"
        fill="#e8866f"
      />
      <path
        d="M100 76c10 14 34 28 34 50 0 18-16 28-34 28s-34-10-34-28c0-22 24-36 34-50Z"
        fill="#f4b8a4"
      />
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <ellipse
            key={i}
            cx={f2(100 + Math.cos(a) * 20)}
            cy={f2(128 + Math.sin(a) * 16)}
            rx="2.2"
            ry="3.4"
            fill="#7a2a1e"
            transform={`rotate(${(a * 180) / Math.PI} ${f2(100 + Math.cos(a) * 20)} ${f2(128 + Math.sin(a) * 16)})`}
          />
        );
      })}
      <path d="M58 104c8-14 20-26 32-34-8 12-18 24-22 40Z" {...HI} />
    </>
  ),
  carrot: (
    <>
      <path d="M142 58c6-20 22-30 36-30-4 16-20 30-36 30Z" fill="var(--color-leaf)" />
      <path d="M136 50c-4-20 4-34 16-40 4 14-4 32-16 40Z" fill="var(--color-leaf)" />
      <Offset
        d="M150 60c10 10 8 24-2 34L52 176c-8 6-18-4-12-12L118 60c10-10 24-10 32 0Z"
        fill="#f07a2c"
      />
      <path
        d="M96 116l14 6M78 138l12 5M116 92l12 5"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".35"
      />
      <path d="M122 66c8-6 16-6 22-2-8 0-14 4-20 10Z" {...HI} />
    </>
  ),
  walnut: (
    <>
      <Offset
        d="M100 32c40 0 70 28 70 68s-30 70-70 70-70-30-70-70 30-68 70-68Z"
        fill="var(--color-crust)"
      />
      <path d="M100 36v132" stroke={INK} strokeWidth="3" opacity=".45" />
      <path
        d="M58 70c14 6 20 20 14 34s-2 26 10 32M142 70c-14 6-20 20-14 34s2 26-10 32"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity=".35"
      />
      <path d="M48 86c6-22 24-40 46-44-18 10-32 26-38 46Z" {...HI} />
      <path d="M164 118c-6 28-28 48-56 50 24-8 42-26 50-52Z" {...SH} />
    </>
  ),
  bread: (
    <>
      <Offset
        d="M40 170V92c-14-4-18-20-10-32 14-22 48-32 70-32s56 10 70 32c8 12 4 28-10 32v78Z"
        fill="var(--color-crust)"
      />
      <path
        d="M52 160V96c-12-4-14-16-8-24 12-18 40-28 56-28s44 10 56 28c6 8 4 20-8 24v64Z"
        fill="#f2dcb0"
      />
      {[
        [80, 110, 5],
        [112, 100, 4],
        [96, 132, 6],
        [128, 138, 4],
        [70, 146, 3],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#d9b77a" />
      ))}
      <path d="M58 76c10-12 26-20 42-22-14 6-28 14-36 26Z" {...HI} />
    </>
  ),
  yogurt: (
    <>
      <path d="M44 96c4-26 30-44 56-44s52 18 56 44Z" fill="#fbf8f1" />
      <path d="M78 70c8-6 18-9 28-8-10 3-18 8-24 14Z" {...HI} opacity={0.8} />
      <path
        d="M96 58c10 10 26 12 34 30"
        fill="none"
        stroke="var(--color-mustard)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Offset d="M28 96h144c0 44-30 76-72 76s-72-32-72-76Z" fill="var(--color-green-2)" />
      <path d="M40 104h120" stroke="#fff" strokeWidth="3" opacity=".25" />
      <path d="M150 116c-8 30-28 48-52 50 20-8 38-24 46-50Z" {...SH} />
    </>
  ),
  pepper: (
    <>
      <path
        d="M156 38c10-8 22-8 28-2"
        fill="none"
        stroke="var(--color-leaf)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Offset
        d="M160 44c10 8 8 22-2 36-26 38-68 74-116 90-10 4-16-6-8-12 40-28 70-64 94-104 8-12 22-18 32-10Z"
        fill="#5f9a3a"
      />
      <path d="M128 60c6-8 16-12 24-10-8 4-14 10-18 18Z" {...HI} />
      <path d="M146 92c-22 32-54 58-92 74 32-20 60-46 82-80Z" {...SH} />
    </>
  ),
  fish: (
    <>
      <Offset
        d="M24 100c28-40 90-54 128-24l24-20c4 26 4 62 0 88l-24-20c-38 30-100 16-128-24Z"
        fill="#8fb3b0"
      />
      <path d="M58 100c20-26 60-36 90-20-30-4-62 6-90 20Z" {...HI} />
      <path d="M150 118c-34 28-86 26-116-8 34 20 80 22 116 8Z" {...SH} />
      <circle cx="60" cy="94" r="6" fill={INK} />
      <path
        d="M86 78c10 12 10 32 0 44"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity=".45"
      />
      <path d="M104 118l22 20" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity=".35" />
    </>
  ),
  oats: (
    <>
      <Offset d="M26 110h148c0 40-32 66-74 66s-74-26-74-66Z" fill="var(--color-paprika)" />
      {[
        [58, 102, -20],
        [82, 94, 14],
        [106, 100, -8],
        [130, 92, 22],
        [148, 104, -14],
        [70, 84, 30],
        [118, 80, -24],
        [96, 76, 8],
      ].map(([x, y, r], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx="14"
          ry="9"
          transform={`rotate(${r} ${x} ${y})`}
          fill="#f1dfb8"
          stroke={INK}
          strokeWidth="1.5"
        />
      ))}
      <path d="M46 126c30 18 80 20 110 0" fill="none" stroke="#fff" strokeWidth="3" opacity=".3" />
      <path d="M158 126c-10 28-32 44-58 46 22-8 40-22 50-46Z" {...SH} />
    </>
  ),
  cucumber: (
    <>
      <Offset
        d="M30 64c30-30 110-40 150-8 6 6 0 16-8 14-40-12-100-6-132 16-8 6-18-14-10-22Z"
        fill="#3f7a3a"
      />
      <path d="M44 62c30-18 84-24 118-12-36-4-78 2-110 18Z" {...HI} />
      {[
        [70, 132],
        [128, 148],
      ].map(([x, y], i) => (
        <g key={i}>
          <Offset d={`M${x! - 34} ${y}a34 34 0 1 0 68 0a34 34 0 1 0 -68 0Z`} fill="#3f7a3a" />
          <circle cx={x} cy={y} r="28" fill="#d8e8a8" />
          {Array.from({ length: 6 }).map((_, k) => {
            const a = (k / 6) * Math.PI * 2;
            return (
              <ellipse
                key={k}
                cx={f2(x! + Math.cos(a) * 11)}
                cy={f2(y! + Math.sin(a) * 11)}
                rx="2.5"
                ry="4"
                fill="#f4f7e4"
                transform={`rotate(${f2((a * 180) / Math.PI + 90)} ${f2(x! + Math.cos(a) * 11)} ${f2(y! + Math.sin(a) * 11)})`}
              />
            );
          })}
        </g>
      ))}
    </>
  ),
  apple: (
    <>
      <path
        d="M100 52c0-14 4-24 12-30"
        fill="none"
        stroke="#6b4a2a"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M110 40c14-14 34-14 42-6-12 12-30 14-42 6Z" fill="var(--color-leaf)" />
      <Offset
        d="M100 56c16-10 42-12 58 4 18 18 18 58 0 86-14 22-34 32-58 22-24 10-44 0-58-22-18-28-18-68 0-86 16-16 42-14 58-4Z"
        fill="#d8402e"
      />
      <path d="M50 92c4-18 16-30 32-32-12 8-22 20-26 36Z" {...HI} />
      <path d="M154 120c-6 22-20 40-40 46 16-12 28-28 34-48Z" {...SH} />
    </>
  ),
  lentil: (
    <>
      <Offset d="M20 160c20-40 50-70 80-70s60 30 80 70Z" fill="#e0703b" />
      {Array.from({ length: 22 }).map((_, i) => {
        const x = 40 + ((i * 37) % 120);
        const y = 120 + ((i * 23) % 36);
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx="7"
            ry="4.5"
            fill="#f08a4f"
            stroke={INK}
            strokeWidth="1.2"
            opacity=".9"
            transform={`rotate(${(i * 47) % 180} ${x} ${y})`}
          />
        );
      })}
      <path d="M60 116c12-12 26-20 40-22-12 6-24 14-32 26Z" {...HI} />
    </>
  ),
  onion: (
    <>
      <path
        d="M100 40c-4-12 0-22 8-28"
        fill="none"
        stroke="var(--color-leaf)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Offset
        d="M100 40c8 16 28 22 48 40 22 22 22 62-4 82-12 10-28 14-44 14s-32-4-44-14c-26-20-26-60-4-82 20-18 40-24 48-40Z"
        fill="#9a3b5c"
      />
      <path
        d="M100 52c-16 30-26 66-12 120M100 52c16 30 26 66 12 120M100 52v120"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        opacity=".3"
      />
      <path d="M52 104c6-18 18-30 32-38-10 12-18 24-22 40Z" {...HI} />
      <path d="M156 132c-8 20-26 36-50 42 20-10 36-24 44-44Z" {...SH} />
    </>
  ),
  mushroom: (
    <>
      <Offset d="M80 110h40l6 56c0 8-8 12-26 12s-26-4-26-12Z" fill="#f3ead8" />
      <Offset
        d="M24 112c0-44 34-76 76-76s76 32 76 76c0 6-6 8-14 8H38c-8 0-14-2-14-8Z"
        fill="var(--color-crust)"
      />
      {[
        [66, 72, 7],
        [110, 60, 9],
        [140, 88, 6],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#f3ead8" opacity=".75" />
      ))}
      <path d="M44 92c8-24 30-42 56-46-22 10-40 26-48 48Z" {...HI} />
    </>
  ),
  garlic: (
    <>
      <path
        d="M100 38c-2-12 2-20 8-26"
        fill="none"
        stroke="#c9b98f"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Offset
        d="M100 38c10 14 34 22 50 42 18 24 12 60-12 78-10 8-24 12-38 12s-28-4-38-12c-24-18-30-54-12-78 16-20 40-28 50-42Z"
        fill="#f6f0e2"
      />
      <path
        d="M100 44c-14 30-22 70-6 124M100 44c14 30 22 70 6 124M100 44c-30 30-44 70-26 116M100 44c30 30 44 70 26 116"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        opacity=".2"
      />
      <path d="M150 124c-8 24-26 40-48 46 18-10 34-26 42-48Z" {...SH} />
    </>
  ),
};

export const illustrationKeys = Object.keys(drawings);

export function Ingredient({
  name,
  title,
  className,
  ...rest
}: { name: string; title?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const content = drawings[name] ?? drawings.lemon;
  return (
    <svg
      viewBox="0 0 200 200"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      {...rest}
    >
      {title && <title>{title}</title>}
      {content}
    </svg>
  );
}

/** Global SVG defs (grain filter). Render once per document. */
export function IllustrationDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
      <defs>
        <filter
          id="riso-grain"
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.95"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 6.2"
            result="mask"
          />
          <feComposite in="SourceGraphic" in2="mask" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
