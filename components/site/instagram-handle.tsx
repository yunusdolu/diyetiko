import { DrawUnderline } from '@/components/ui/motion-link';

/**
 * "@handle" as the site writes it everywhere it lists the Instagram account, with the blue tick
 * beside it when the dietitian has marked the account as verified (Ayarlar → İletişim). The tick
 * keeps its own blue in every theme: it is Instagram's mark, not a brand colour.
 */
export function InstagramHandle({
  handle,
  verified,
  verifiedLabel,
}: {
  handle: string;
  verified: boolean;
  verifiedLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <DrawUnderline>@{handle}</DrawUnderline>
      {verified && <VerifiedBadge label={verifiedLabel} />}
    </span>
  );
}

export function VerifiedBadge({ label, className }: { label: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className={className ?? 'size-[1.05em] shrink-0'}
    >
      <title>{label}</title>
      <path
        fill="#0095f6"
        d="M12 2.4Q16.82.36 18.79 5.21Q23.64 7.18 21.6 12Q23.64 16.82 18.79 18.79Q16.82 23.64 12 21.6Q7.18 23.64 5.21 18.79Q.36 16.82 2.4 12Q.36 7.18 5.21 5.21Q7.18.36 12 2.4Z"
      />
      <path
        d="M7.6 12.3l3 3 5.8-6.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
