/** Line icons for the client portal (24px grid, 1.8 stroke, currentColor). No emoji anywhere. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Today: a plate seen from above with a rising sun edge. */
export const TodayIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="13" r="7" />
    <circle cx="12" cy="13" r="3.2" />
    <path d="M12 2.5v2M4.2 5.7l1.4 1.4M19.8 5.7l-1.4 1.4" />
  </Svg>
);
export const ProgramIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M8 13.5h3M8 17h6" />
  </Svg>
);
export const DiaryIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6" />
    <path d="M6 3.5v17M9.5 8h5M9.5 11.5h5" />
    <path d="M3.5 7h4M3.5 12h4M3.5 17h4" />
  </Svg>
);
export const ProgressIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 19.5h17" />
    <path d="M5 15.5l4.2-4.4 3.5 2.8 6.3-7.4" />
    <path d="M15.2 6.5H19v3.8" />
  </Svg>
);
export const MessageIcon = (p: P) => (
  <Svg {...p}>
    <path d="M20 12.3c0 4-3.6 7.2-8 7.2-1.2 0-2.3-.2-3.3-.6L4 20l1.3-3.6C4.5 15.2 4 13.8 4 12.3 4 8.3 7.6 5 12 5s8 3.3 8 7.3Z" />
  </Svg>
);
export const AccountIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.7" />
    <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
  </Svg>
);
export const LogoutIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Svg>
);
export const CameraIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
    <circle cx="12" cy="13" r="3.4" />
  </Svg>
);
export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const MinusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const CloseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const NoteIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 4.5h14v10.5l-4.5 4.5H5Z" />
    <path d="M14.5 19.5V15H19M8.5 9h7M8.5 12h4" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const ChevronIcon = ({ className, ...p }: P) => (
  <Svg className={['mirror-rtl', className].filter(Boolean).join(' ')} {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Svg>
);
export const SendIcon = ({ className, ...p }: P) => (
  <Svg className={['mirror-rtl', className].filter(Boolean).join(' ')} {...p}>
    <path d="M4.5 12 20 4.5 15.8 20l-3.6-6.2Z" />
    <path d="M12.2 13.8 20 4.5" />
  </Svg>
);
export const CalendarIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Svg>
);
/** A glass of water; `fill` 0..1 shows the level. */
export function GlassIcon({
  fill = 0,
  size = 30,
  className,
}: {
  fill?: number;
  size?: number;
  className?: string;
}) {
  // Water = the glass's inner trapezoid cut at the level (no clipPath → no duplicate ids).
  const top = 4.6;
  const bottom = 19.6;
  const level = bottom - (bottom - top) * Math.max(0, Math.min(1, fill));
  const edge = (y: number) => 1.4 * ((y - top) / (bottom - top)); // inward slope
  const f = (n: number) => Math.round(n * 100) / 100;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={className}>
      {fill > 0 && (
        <path
          d={`M${f(6.3 + edge(level))} ${f(level)}H${f(17.7 - edge(level))}L${f(17.7 - edge(bottom))} ${bottom}H${f(6.3 + edge(bottom))}Z`}
          fill="currentColor"
          opacity=".85"
        />
      )}
      <path
        d="M6 3.5h12l-1.5 17h-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
