'use client';

import type Lenis from 'lenis';

/** Lenis instance shared with GSAP (set by <SmoothScroll/>). */
let lenisInstance: Lenis | null = null;
export function setLenis(l: Lenis | null) {
  lenisInstance = l;
}
export function getLenis() {
  return lenisInstance;
}

type GsapBundle = {
  gsap: typeof import('gsap').gsap;
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
};

let loading: Promise<GsapBundle> | null = null;

/** GSAP + ScrollTrigger are dynamically imported only by sections that scrub/pin. */
export function loadGsap(): Promise<GsapBundle> {
  if (!loading) {
    loading = Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([g, st]) => {
      g.gsap.registerPlugin(st.ScrollTrigger);
      const l = getLenis();
      if (l) l.on('scroll', st.ScrollTrigger.update);
      return { gsap: g.gsap, ScrollTrigger: st.ScrollTrigger };
    });
  }
  return loading;
}
