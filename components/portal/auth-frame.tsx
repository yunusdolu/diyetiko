import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/site/header';

/**
 * Shared frame of the portal's entry pages (sign-in, invite, consent). Desktop: a dark
 * editorial panel beside the form. Phones: the brand on top, the form full width.
 */
export function AuthFrame({
  brand,
  surface,
  headline,
  children,
  siteLabel,
  className,
  art,
  ...rest
}: {
  /** extra classes for <main> (the admin sign-in sets its own surface colours) */
  className?: string;
  /** replaces the rings under the headline */
  art?: ReactNode;
  /** data-* attributes for <main> */
  [data: `data-${string}`]: string | undefined;
  brand: string;
  surface: string;
  headline: ReactNode;
  children: ReactNode;
  siteLabel: string;
}) {
  return (
    <main
      data-auth=""
      className={cn(
        'grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]',
        className,
      )}
      {...rest}
    >
      <div className="on-dark relative hidden overflow-clip bg-ink grain-light p-12 text-paper lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark className="size-9 text-paper" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[1.35rem] font-semibold ar:font-bold">{brand}</span>
            <span className="mt-1.5 label text-sage">{surface}</span>
          </span>
        </Link>
        <div>
          {/* decorative on desktop; the page's real h1 sits in the form column (sr-only at lg) */}
          <p
            aria-hidden
            className="max-w-lg font-display text-[clamp(3rem,5.2vw,5.25rem)] leading-[0.92] tracking-[-0.03em] ar:leading-[1.25] ar:font-bold ar:tracking-normal"
          >
            {headline}
          </p>
          {art ?? (
            <svg viewBox="0 0 200 200" className="mt-12 size-48" aria-hidden>
              {(
                [
                  [84, 'var(--color-protein)', 0.3],
                  [66, 'var(--color-carb)', 0.45],
                  [48, 'var(--color-fat)', 0.25],
                ] as const
              ).map(([r, c, share], i) => (
                <g key={i} transform="rotate(-90 100 100)">
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
            </svg>
          )}
        </div>
        <Link
          href="/"
          className="text-[0.8125rem] font-semibold text-sage underline-offset-4 hover:text-paper hover:underline"
        >
          {siteLabel}
        </Link>
      </div>

      <div className="flex min-h-dvh flex-col px-5 pt-6 pb-10 sm:px-10 lg:justify-center lg:px-16 lg:py-16">
        <Link href="/" className="flex items-center gap-2.5 lg:hidden">
          <BrandMark className="size-8 text-ink" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[1.2rem] font-semibold ar:font-bold">{brand}</span>
            <span className="mt-1 label text-[0.5625rem] text-ink-60">{surface}</span>
          </span>
        </Link>
        <div className="mx-auto mt-12 w-full max-w-md lg:mt-0">{children}</div>
      </div>
    </main>
  );
}
