'use client';

import Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getLenis, setLenis } from '@/lib/motion/gsap';
import { useMotionLevel } from '@/lib/motion/hooks';

/** Lenis on the public site only; off for reduced motion and low-end/save-data devices. */
export function SmoothScroll() {
  const level = useMotionLevel();
  const pathname = usePathname();

  useEffect(() => {
    if (level !== 'full') return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.11, wheelMultiplier: 0.95, anchors: true });
    setLenis(lenis);
    // Exposed for the screenshot/e2e scripts (they scroll programmatically).
    if (process.env.NODE_ENV !== 'production') Object.assign(window, { __lenis: lenis });
    return () => {
      lenis.destroy();
      setLenis(null);
    };
  }, [level]);

  useEffect(() => {
    getLenis()?.scrollTo(0, { immediate: true, force: true });
  }, [pathname]);

  return null;
}
