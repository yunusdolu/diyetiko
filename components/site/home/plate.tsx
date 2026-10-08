/**
 * Top-down lunch plate illustrating the plate method (half vegetables, a quarter protein, a
 * quarter whole grain) — the same idea as the "plate method" guide. Riso style: flat inks,
 * offset ink outlines, grain texture. Illustrations are NEVER mirrored in RTL: the light source
 * stays upper-left.
 *
 * Structure (class hooks used by the hero timeline — keep them):
 *  .plate-rim / .plate-well  — the plate
 *  .food-veg / .food-protein / .food-grain / .food-garnish — food groups (fly out)
 *  .ring-track-* / .ring-* — macro rings around the plate (draw in)
 */
const INK = 'var(--color-ink)';
/** Round computed coordinates so server and client render identical strings. */
const f2 = (n: number) => Math.round(n * 100) / 100;
/**
 * Deterministic pseudo-random in [0, 1). Integer hashing only (no Math.sin): every JS engine
 * returns the same value, so the server HTML and the hydrated SVG always match.
 */
const rnd = (i: number, seed = 1) => {
  let t = (i * 0x9e3779b1 + seed * 0x85ebca6b) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x21f0aaad) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 0x735a2d97) >>> 0;
  return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
};

export const PLATE_RINGS = [
  { key: 'protein', r: 246, color: 'var(--color-protein-on-light)' },
  { key: 'carb', r: 266, color: 'var(--color-carb-on-light)' },
  { key: 'fat', r: 286, color: 'var(--color-fat-on-light)' },
] as const;

/* ------------------------------------------------------------------ geometry */

type Pt = [number, number];

/** Smooth closed path through points (quadratic curves through midpoints). */
function smooth(pts: Pt[]): string {
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n = pts.length;
  const start = mid(pts[n - 1]!, pts[0]!);
  let d = `M${f2(start[0])} ${f2(start[1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const m = mid(p, pts[(i + 1) % n]!);
    d += ` Q${f2(p[0])} ${f2(p[1])} ${f2(m[0])} ${f2(m[1])}`;
  }
  return `${d}Z`;
}

/**
 * A leaf from its base along `angle` (degrees, SVG coordinates): a wide rounded body narrowing
 * to a soft tip, with a gentle ruffle on the edge. Returns the outline and the vein lines.
 */
function leafGeometry(
  bx: number,
  by: number,
  angle: number,
  len: number,
  width: number,
  ruffle = 0.045,
  waves = 7,
) {
  const a = (angle * Math.PI) / 180;
  const ax: Pt = [Math.cos(a), Math.sin(a)];
  const nx: Pt = [-ax[1], ax[0]];
  const at = (t: number, side: number): Pt => {
    const body =
      Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)), 0.55) * (1 - 0.35 * t * t);
    const w = (width / 2) * body * (1 + ruffle * Math.sin(t * Math.PI * waves + side));
    return [bx + ax[0] * len * t + nx[0] * w * side, by + ax[1] * len * t + nx[1] * w * side];
  };
  const steps = 22;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    left.push(at(t, 1));
    right.push(at(t, -1));
  }
  const outline = smooth([...left, ...right.reverse()]);
  const tip: Pt = [bx + ax[0] * len * 0.88, by + ax[1] * len * 0.88];
  const veins = [
    `M${f2(bx + ax[0] * len * 0.04)} ${f2(by + ax[1] * len * 0.04)} L${f2(tip[0])} ${f2(tip[1])}`,
  ];
  for (const t of [0.24, 0.42, 0.6, 0.76]) {
    const c: Pt = [bx + ax[0] * len * t, by + ax[1] * len * t];
    for (const side of [1, -1]) {
      const w = (width / 2) * 0.6 * Math.sin(Math.PI * t);
      const e: Pt = [
        c[0] + ax[0] * len * 0.1 + nx[0] * w * side,
        c[1] + ax[1] * len * 0.1 + nx[1] * w * side,
      ];
      veins.push(`M${f2(c[0])} ${f2(c[1])} L${f2(e[0])} ${f2(e[1])}`);
    }
  }
  return { outline, veins };
}

/* ------------------------------------------------------------------ vegetables */

function Leaf({
  bx,
  by,
  angle,
  len,
  width,
  fill,
  vein = '#2f5f2c',
  ruffle,
  waves,
}: {
  bx: number;
  by: number;
  angle: number;
  len: number;
  width: number;
  fill: string;
  vein?: string;
  ruffle?: number;
  waves?: number;
}) {
  const g = leafGeometry(bx, by, angle, len, width, ruffle, waves);
  return (
    <g>
      <path
        d={g.outline}
        transform="translate(3 3)"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d={g.outline} fill={fill} filter="url(#riso-grain)" />
      <path
        d={g.veins.join(' ')}
        fill="none"
        stroke={vein}
        strokeOpacity=".5"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

function TomatoSlice({ x, y, r, rot = 0 }: { x: number; y: number; r: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <circle r={r} transform="translate(3 3)" fill="none" stroke={INK} strokeWidth="2.5" />
      <circle r={r} fill="var(--color-tomato)" />
      <circle r={f2(r * 0.8)} fill="#f06a4f" />
      {[0, 120, 240].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path
            d={`M0 0 L${f2(r * 0.62)} ${f2(-r * 0.3)} A${f2(r * 0.66)} ${f2(r * 0.66)} 0 0 1 ${f2(r * 0.62)} ${f2(r * 0.3)} Z`}
            fill="#f9a58e"
          />
          <ellipse cx={f2(r * 0.42)} cy="-3" rx="2.2" ry="3.6" fill="#fde8cf" />
          <ellipse cx={f2(r * 0.42)} cy="5" rx="2.2" ry="3.6" fill="#fde8cf" />
        </g>
      ))}
      <circle r={f2(r * 0.14)} fill="#f7c2ae" />
      <path
        d={`M${f2(-r * 0.6)} ${f2(-r * 0.35)} a${f2(r * 0.7)} ${f2(r * 0.7)} 0 0 1 ${f2(r * 0.5)} ${f2(-r * 0.4)}`}
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        opacity=".45"
      />
    </g>
  );
}

function CucumberSlice({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} transform="translate(3 3)" fill="none" stroke={INK} strokeWidth="2.5" />
      <circle r={r} fill="#3f7a3a" />
      <circle r={f2(r * 0.86)} fill="#dcebb0" />
      <circle r={f2(r * 0.5)} fill="#eef5cf" />
      {Array.from({ length: 6 }).map((_, k) => {
        const a = (k / 6) * Math.PI * 2;
        const cx = f2(Math.cos(a) * r * 0.36);
        const cy = f2(Math.sin(a) * r * 0.36);
        return (
          <ellipse
            key={k}
            cx={cx}
            cy={cy}
            rx="2.2"
            ry="3.8"
            fill="#fbfdf0"
            stroke="#c8dc8f"
            strokeWidth="1"
            transform={`rotate(${f2((a * 180) / Math.PI + 90)} ${cx} ${cy})`}
          />
        );
      })}
    </g>
  );
}

/** Red onion: a few thin purple rings. */
function OnionRings({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" strokeLinecap="round">
      {[
        [0, 0, 24, 17, -12],
        [18, 10, 19, 14, 20],
      ].map(([dx, dy, rx, ry, rot], i) => (
        <g key={i} transform={`translate(${dx} ${dy}) rotate(${rot})`}>
          <ellipse rx={rx} ry={ry} stroke="#7d2a5a" strokeWidth="6" />
          <ellipse rx={rx} ry={ry} stroke="#c98ab0" strokeWidth="2.5" />
        </g>
      ))}
    </g>
  );
}

/** Shredded purple cabbage. */
function Cabbage({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" strokeLinecap="round">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = ((-40 + i * 9 + rnd(i, 2) * 10) * Math.PI) / 180;
        const r = 20 + rnd(i, 3) * 22;
        const x0 = f2(Math.cos(a) * 6);
        const y0 = f2(Math.sin(a) * 6);
        const x1 = f2(Math.cos(a) * r);
        const y1 = f2(Math.sin(a) * r);
        return (
          <path
            key={i}
            d={`M${x0} ${y0} Q${f2((x0 + x1) / 2 + 8)} ${f2((y0 + y1) / 2 - 6)} ${x1} ${y1}`}
            stroke={i % 3 === 0 ? '#e7cfe0' : i % 2 ? '#8e3b6e' : '#b0568b'}
            strokeWidth="4"
          />
        );
      })}
    </g>
  );
}

function CarrotSticks({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[
        [0, 0, -28],
        [13, 7, -8],
        [-9, 14, -46],
      ].map(([dx, dy, rot], i) => (
        <g key={i} transform={`translate(${dx} ${dy}) rotate(${rot})`}>
          <rect
            x="-5"
            y="-24"
            width="10"
            height="48"
            rx="5"
            transform="translate(2 2)"
            fill="none"
            stroke={INK}
            strokeWidth="2"
          />
          <rect x="-5" y="-24" width="10" height="48" rx="5" fill="#ec8a3a" />
          <path d="M-1.5 -18v36" stroke="#f7b56f" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

/** Black olive with a highlight. */
function Olive({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <ellipse rx="11" ry="8" transform="translate(2 2)" fill="none" stroke={INK} strokeWidth="2" />
      <ellipse rx="11" ry="8" fill="#2d2330" />
      <ellipse cx="-3" cy="-3" rx="3.5" ry="2" fill="#fff" opacity=".45" />
    </g>
  );
}

/* ------------------------------------------------------------------ protein */

/** A slice of grilled chicken breast: golden crust, pale inside, grill marks. */
const SLAB =
  'M-50 -12C-36 -22 26 -24 48 -14C56 -8 54 8 46 14C24 22 -30 22 -48 14C-56 8 -56 -6 -50 -12Z';
function ChickenSlice({ id, x, y, rot }: { id: string; x: number; y: number; rot: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <defs>
        <clipPath id={id}>
          <path d={SLAB} />
        </clipPath>
      </defs>
      <path d={SLAB} transform="translate(3 3)" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d={SLAB} fill="#c9803f" />
      <g clipPath={`url(#${id})`}>
        <path d={SLAB} transform="scale(.86 .66)" fill="#f3d4a4" />
        {[-34, -16, 2, 20, 38].map((cx) => (
          <path
            key={cx}
            d={`M${cx - 9} 20 L${cx + 9} -20`}
            stroke="#6b3f22"
            strokeOpacity=".72"
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}
      </g>
      <path
        d="M-38 -12c16-5 40-6 58-2"
        fill="none"
        stroke="#fff"
        strokeOpacity=".4"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Yoghurt with an olive-oil drizzle and pul biber (chilli flakes). */
function Yoghurt({ x, y }: { x: number; y: number }) {
  const blob = 'M-30 2c-2-18 14-32 32-30 18 2 32 16 28 34-4 16-22 24-38 20-14-4-21-12-22-24Z';
  return (
    <g transform={`translate(${x} ${y}) scale(1.25)`}>
      <path d={blob} transform="translate(3 3)" fill="none" stroke={INK} strokeWidth="2.2" />
      <path d={blob} fill="#fbfaf4" />
      <path
        d="M-14 -4c6-10 22-10 26 0s-8 16-16 10"
        fill="none"
        stroke="#e4ddc9"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M-18 8c10 4 20-6 30-2"
        fill="none"
        stroke="#c9b43a"
        strokeWidth="4"
        strokeLinecap="round"
        opacity=".9"
      />
      {Array.from({ length: 10 }).map((_, i) => {
        const px = f2(-16 + rnd(i, 5) * 34);
        const py = f2(-18 + rnd(i, 6) * 30);
        return (
          <rect
            key={i}
            x={px}
            y={py}
            width="3.2"
            height="2.2"
            rx="0.8"
            fill="#c2410c"
            transform={`rotate(${f2(rnd(i, 7) * 180)} ${px} ${py})`}
          />
        );
      })}
    </g>
  );
}

function Chickpea({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="12" transform="translate(2 2)" fill="none" stroke={INK} strokeWidth="2" />
      <circle r="12" fill="#e6c48a" />
      <path d="M-1 -11c3 6 3 16 0 22" fill="none" stroke="#c9a064" strokeWidth="2" />
      <path
        d="M-6 -4a8 8 0 0 1 7 -6"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".5"
      />
    </g>
  );
}

/* ------------------------------------------------------------------ whole grain */

/** Bulgur pilaf mound: bumpy edge, light top, shaded side, grains and parsley. */
function Bulgur() {
  const cx = 386;
  const cy = 388;
  const outline: Pt[] = Array.from({ length: 36 }).map((_, i) => {
    const t = (i / 36) * Math.PI * 2;
    const r = 80 + 5 * Math.sin(5 * t) + 3.5 * Math.sin(11 * t + 1.3) + rnd(i, 31) * 3;
    return [cx + Math.cos(t) * r * 1.02, cy + Math.sin(t) * r * 0.9];
  });
  const d = smooth(outline);
  const grains = Array.from({ length: 170 }).map((_, i) => {
    const a = rnd(i, 11) * Math.PI * 2;
    const r = Math.sqrt(rnd(i, 12)) * 80;
    const x = f2(cx + Math.cos(a) * r);
    const y = f2(cy + Math.sin(a) * r * 0.88);
    const shade = (x - cx) * 0.6 + (y - cy) > 38;
    return {
      x,
      y,
      rot: f2(rnd(i, 13) * 180),
      tone: shade
        ? i % 3
          ? '#b8732f'
          : '#c98a45'
        : i % 4 === 0
          ? '#f6dca6'
          : i % 3 === 0
            ? '#e9b56a'
            : '#eec27f',
    };
  });
  const flecks = Array.from({ length: 16 }).map((_, i) => {
    const a = rnd(i, 21) * Math.PI * 2;
    const r = Math.sqrt(rnd(i, 22)) * 66;
    return {
      x: f2(cx + Math.cos(a) * r),
      y: f2(cy + Math.sin(a) * r * 0.86),
      rot: f2(rnd(i, 23) * 180),
    };
  });
  return (
    <>
      <defs>
        <clipPath id="plate-bulgur">
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} transform="translate(3 3)" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d={d} fill="#d8954c" filter="url(#riso-grain)" />
      <g clipPath="url(#plate-bulgur)">
        <ellipse cx={cx + 30} cy={cy + 36} rx="92" ry="60" fill="#b97a3a" opacity=".55" />
        <ellipse cx={cx - 16} cy={cy - 18} rx="58" ry="42" fill="#e9b36a" opacity=".7" />
      </g>
      {grains.map((g, i) => (
        <ellipse
          key={i}
          cx={g.x}
          cy={g.y}
          rx="4.2"
          ry="2.5"
          fill={g.tone}
          transform={`rotate(${g.rot} ${g.x} ${g.y})`}
        />
      ))}
      {flecks.map((f, i) => (
        <rect
          key={i}
          x={f.x}
          y={f.y}
          width="6.5"
          height="3.2"
          rx="1.3"
          fill={i % 2 ? '#3f7a3a' : '#5f9a45'}
          transform={`rotate(${f.rot} ${f.x} ${f.y})`}
        />
      ))}
      <path
        d={`M${cx - 52} ${cy - 44}c20-16 56-22 84-12`}
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        opacity=".35"
      />
    </>
  );
}

/* ------------------------------------------------------------------ garnish */

/** A mint sprig: paired leaves along a stem. */
function MintSprig({
  x,
  y,
  rot = 0,
  scale = 1,
}: {
  x: number;
  y: number;
  rot?: number;
  scale?: number;
}) {
  const pairs = [
    [0, -14, 30, 18],
    [0, -34, 26, 16],
    [0, -52, 20, 13],
  ] as const;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
      <path
        d="M0 6C0 -20 1 -44 2 -66"
        fill="none"
        stroke="#3f7a3a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {pairs.flatMap(([bx, by, len, w], i) =>
        [-1, 1].map((side) => {
          const g = leafGeometry(bx, by, side === 1 ? -20 : 200, len, w, 0.08, 9);
          return (
            <g key={`${i}${side}`}>
              <path
                d={g.outline}
                fill={i % 2 ? '#4f8a3c' : '#5f9a45'}
                stroke="#2f5f2c"
                strokeOpacity=".5"
                strokeWidth="1.2"
              />
              <path
                d={g.veins[0]}
                stroke="#2f5f2c"
                strokeOpacity=".5"
                strokeWidth="1.2"
                fill="none"
              />
            </g>
          );
        }),
      )}
      <path
        d="M-9 -70c4-10 14-12 18-4-4 10-14 12-18 4Z"
        fill="#6aa04f"
        stroke="#2f5f2c"
        strokeOpacity=".5"
        strokeWidth="1.2"
      />
    </g>
  );
}

function LemonWedge() {
  const seg = (a: number, r: number) => [
    f2(Math.sin((a * Math.PI) / 180) * r),
    f2(-Math.cos((a * Math.PI) / 180) * r - 2),
  ];
  return (
    <g transform="translate(452 448) rotate(28)">
      <path
        d="M-46 0a46 46 0 0 1 92 0Z"
        transform="translate(3 3)"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
      />
      <path d="M-46 0a46 46 0 0 1 92 0Z" fill="#f2d640" />
      <path d="M-40 -1a40 40 0 0 1 80 0Z" fill="#fbf3b6" />
      {[-64, -32, 0, 32, 64].map((a) => {
        const [ex, ey] = seg(a, 36);
        return <path key={a} d={`M0 -2L${ex} ${ey}`} stroke="#ecd96a" strokeWidth="2.5" />;
      })}
      {[-48, -16, 16, 48].map((a) => {
        const [x0, y0] = seg(a - 12, 8);
        const [x1, y1] = seg(a - 6, 33);
        const [x2, y2] = seg(a + 6, 33);
        return (
          <path
            key={a}
            d={`M${x0} ${y0} L${x1} ${y1} L${x2} ${y2} Z`}
            fill="#fff7c9"
            opacity=".7"
          />
        );
      })}
      <path
        d="M-40 -6a42 42 0 0 1 14 -24"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".6"
      />
    </g>
  );
}

/* ------------------------------------------------------------------ plate */

export function Plate({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden>
      {/* Macro ring tracks + rings (outside the plate) */}
      {PLATE_RINGS.map((ring) => (
        <circle
          key={`t-${ring.key}`}
          className={`ring-track ring-track-${ring.key}`}
          cx="300"
          cy="300"
          r={ring.r}
          fill="none"
          stroke={INK}
          strokeOpacity="0.08"
          strokeWidth="14"
        />
      ))}
      {PLATE_RINGS.map((ring) => (
        <circle
          key={ring.key}
          className={`ring ring-${ring.key}`}
          cx="300"
          cy="300"
          r={ring.r}
          fill="none"
          stroke={ring.color}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="1 1"
          strokeDashoffset="1"
          opacity="0"
          transform="rotate(-90 300 300)"
        />
      ))}

      {/* Plate: ceramic with a çini-style dotted band and a glaze highlight */}
      <g className="plate-rim">
        <circle cx="304" cy="304" r="232" fill="none" stroke={INK} strokeWidth="3" />
        <circle cx="300" cy="300" r="232" fill="var(--color-paper-2)" />
        <circle
          cx="300"
          cy="300"
          r="222"
          fill="none"
          stroke="var(--color-green-3)"
          strokeOpacity=".35"
          strokeWidth="1.5"
        />
        <circle
          cx="300"
          cy="300"
          r="190"
          fill="none"
          stroke="var(--color-green-3)"
          strokeOpacity=".35"
          strokeWidth="1.5"
        />
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2;
          const x = f2(300 + Math.cos(a) * 206);
          const y = f2(300 + Math.sin(a) * 206);
          return i % 2 ? (
            <circle key={i} cx={x} cy={y} r="2.6" fill="var(--color-green-3)" opacity=".4" />
          ) : (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="5"
              ry="2.4"
              fill="var(--color-green-3)"
              opacity=".3"
              transform={`rotate(${f2((a * 180) / Math.PI + 90)} ${x} ${y})`}
            />
          );
        })}
        <path
          d="M118 176a232 232 0 0 1 152 -104"
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
          opacity=".55"
        />
        <path
          d="M96 250a232 232 0 0 1 10 -34"
          fill="none"
          stroke="#fff"
          strokeWidth="6"
          strokeLinecap="round"
          opacity=".45"
        />
      </g>
      <g className="plate-well">
        <circle cx="300" cy="300" r="178" fill="#fbf8f1" />
        <circle
          cx="300"
          cy="300"
          r="178"
          fill="none"
          stroke={INK}
          strokeOpacity=".1"
          strokeWidth="6"
        />
        <circle
          cx="306"
          cy="308"
          r="170"
          fill="none"
          stroke={INK}
          strokeOpacity=".04"
          strokeWidth="10"
        />
      </g>

      {/* Vegetables — the half facing inline-start (left of the plate): a heaped salad */}
      <g className="food food-veg">
        <Leaf bx={286} by={300} angle={186} len={168} width={112} fill="#5f9a45" />
        <Leaf
          bx={282}
          by={324}
          angle={146}
          len={150}
          width={100}
          fill="#4f8a3c"
          ruffle={0.06}
          waves={9}
        />
        <Leaf bx={286} by={276} angle={222} len={150} width={98} fill="#6aa04f" />
        <Leaf bx={292} by={262} angle={254} len={110} width={74} fill="#3f7a3a" vein="#24502a" />
        <Leaf bx={276} by={350} angle={118} len={112} width={76} fill="#6aa04f" />
        <Cabbage x={156} y={360} />
        <TomatoSlice x={196} y={236} r={38} rot={12} />
        <TomatoSlice x={160} y={312} r={34} rot={-30} />
        <TomatoSlice x={236} y={378} r={32} rot={40} />
        <OnionRings x={222} y={296} />
        <CucumberSlice x={252} y={232} r={26} />
        <CucumberSlice x={188} y={418} r={26} />
        <CucumberSlice x={272} y={416} r={22} />
        <CarrotSticks x={228} y={176} />
        <Olive x={262} y={330} rot={-20} />
        <Olive x={146} y={262} rot={30} />
        <Olive x={214} y={444} rot={10} />
      </g>

      {/* Protein — upper quarter on the other side: grilled chicken, yoghurt, chickpeas */}
      <g className="food food-protein">
        <ChickenSlice id="plate-chk-1" x={352} y={186} rot={-30} />
        <ChickenSlice id="plate-chk-2" x={380} y={204} rot={-22} />
        <ChickenSlice id="plate-chk-3" x={408} y={224} rot={-12} />
        <ChickenSlice id="plate-chk-4" x={432} y={248} rot={-4} />
        <Yoghurt x={352} y={272} />
        <Chickpea x={452} y={294} />
        <Chickpea x={428} y={306} />
        <Chickpea x={470} y={272} />
        <Chickpea x={404} y={304} />
      </g>

      {/* Whole grain — lower quarter: bulgur pilaf */}
      <g className="food food-grain">
        <Bulgur />
      </g>

      {/* Garnish on the rim */}
      <g className="food food-garnish">
        <LemonWedge />
        <MintSprig x={132} y={470} rot={-36} />
        <MintSprig x={98} y={420} rot={-70} scale={0.75} />
      </g>
    </svg>
  );
}
