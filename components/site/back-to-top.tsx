'use client';

import { getLenis } from '@/lib/motion/gsap';

export function BackToTop({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(0);
        else
          window.scrollTo({
            top: 0,
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          });
        document.getElementById('main')?.focus({ preventScroll: true });
      }}
      className="group/top inline-flex items-center gap-2 font-semibold text-paper coarse:min-h-11"
    >
      {label}
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        aria-hidden
        className="transition-transform duration-300 group-hover/top:-translate-y-0.5"
      >
        <path
          d="M12 19V5M6 11l6-6 6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
