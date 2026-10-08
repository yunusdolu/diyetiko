import { cn } from '@/lib/utils';

/** "1,4 MB" / "320 KB" — enough precision for a file in a message. */
export function fileSize(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: mb >= 10 ? 0 : 1 });
  return mb >= 1 ? `${nf.format(mb)} MB` : `${nf.format(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

export const UPLOAD_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * A file inside a message: pictures show themselves (opened full size in a new tab), a PDF is a
 * card with its name and size. The link goes to an auth-checked route — never to storage itself.
 */
export function FileChip({
  href,
  name,
  mime,
  size,
  locale,
  onDark,
  openLabel,
  className,
  compact,
}: {
  href: string;
  name: string;
  mime: string;
  size: number | null;
  locale: string;
  /** inside a dark bubble */
  onDark?: boolean;
  /** accessible name for the link ("Dosyayı aç") */
  openLabel: string;
  className?: string;
  /** a row in a list of files: no picture preview */
  compact?: boolean;
}) {
  const image = mime.startsWith('image/');
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${openLabel}: ${name}`}
      className={cn(
        'group/file block max-w-full overflow-hidden rounded-[12px] border text-start transition-colors',
        onDark
          ? 'border-white/15 bg-white/10 hover:bg-white/15'
          : 'border-black/10 bg-white/60 hover:bg-white/90 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15',
        className,
      )}
    >
      {image && !compact && (
        // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked bytes: not for the image optimiser
        <img
          src={href}
          alt=""
          loading="lazy"
          decoding="async"
          className="block max-h-56 w-full max-w-[18rem] object-cover"
        />
      )}
      <span className="flex min-w-0 items-center gap-2.5 px-3 py-2">
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-[8px] text-[0.625rem] font-bold tracking-wide',
            image ? 'bg-[#2e7d4f] text-white' : 'bg-[#b23114] text-white',
          )}
        >
          {image ? 'IMG' : 'PDF'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] leading-tight font-semibold">
            {name}
          </span>
          {size != null && (
            <span className="block text-[0.6875rem] leading-tight opacity-70">
              {fileSize(size, locale)}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-60 transition-opacity group-hover/file:opacity-100"
        >
          <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
        </svg>
      </span>
    </a>
  );
}

/** The paperclip for composers. */
export function ClipIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1l8.2-8.2a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.6-2.6l7.3-7.3" />
    </svg>
  );
}
