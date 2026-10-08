import { Amiri, Bodoni_Moda, Martian_Mono, Readex_Pro, Schibsted_Grotesk } from 'next/font/google';

/*
 * Latin fonts are preloaded (they carry the LCP headline for tr/en/fr).
 * Arabic fonts are not preloaded globally — they are only requested when an Arabic page
 * actually renders Arabic glyphs (unicode-range), so tr/en/fr never download them.
 */

export const bodoni = Bodoni_Moda({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-bodoni',
});

export const schibsted = Schibsted_Grotesk({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-schibsted',
});

export const martian = Martian_Mono({
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-martian',
  preload: false,
});

export const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-amiri',
  preload: false,
});

export const readex = Readex_Pro({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-readex',
  preload: false,
});

export const fontVariables = [bodoni, schibsted, martian, amiri, readex]
  .map((f) => f.variable)
  .join(' ');
