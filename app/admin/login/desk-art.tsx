/**
 * The sign-in's drawing: three macro rings that draw themselves in, one after the other, around
 * a still centre — the panel's own mark, set like a plate (pure CSS, no script needed).
 */
export function DeskArt() {
  const rings = [
    [84, 'var(--color-protein)', 0.3],
    [66, 'var(--color-carb)', 0.45],
    [48, 'var(--color-fat)', 0.25],
  ] as const;
  return (
    <svg viewBox="0 0 200 200" className="desk-art mt-12 size-52" aria-hidden>
      {rings.map(([r, c, share], i) => (
        <g key={r} transform="rotate(-90 100 100)">
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity=".12"
            strokeWidth="12"
          />
          <circle
            className="desk-ring"
            style={{ ['--share' as string]: share, animationDelay: `${200 + i * 160}ms` }}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={c}
            strokeWidth="12"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray={`${share} 1`}
          />
        </g>
      ))}
      <circle cx="100" cy="100" r="14" fill="var(--color-paper)" opacity=".9" />
    </svg>
  );
}
