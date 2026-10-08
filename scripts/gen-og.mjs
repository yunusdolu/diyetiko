/**
 * Captures the localized Open Graph images from the dev-only /dev/og route:
 *   pnpm dev   (in another terminal)
 *   node scripts/gen-og.mjs [--base=http://localhost:3000]
 * Writes public/og/og-{tr,en,ar,fr}.png (1200×630). Chromium does the text shaping, so Arabic
 * joins correctly. Re-run after changing the hero headline; commit the PNGs.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const base = args.base ?? 'http://localhost:3000';
const routes = { tr: '/dev/og', en: '/en/dev/og', ar: '/ar/dev/og', fr: '/fr/dev/og' };

mkdirSync('public/og', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1320, height: 760 },
  deviceScaleFactor: 1,
});
// Skip the once-per-session ink loader and hide the site chrome around the card.
await page.addInitScript(() => sessionStorage.setItem('dm_loader_seen', '1'));
for (const [locale, route] of Object.entries(routes)) {
  const res = await page.goto(base + route, { waitUntil: 'networkidle' });
  if (res?.status() !== 200) throw new Error(`${route} → ${res?.status()} (is pnpm dev running?)`);
  // Hide every fixed overlay (header, cursor, WhatsApp button, loader, dev badge) — only the card remains.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *'))
      if (getComputedStyle(el).position === 'fixed') el.style.display = 'none';
    document.querySelector('nextjs-portal')?.remove();
  });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#og').screenshot({ path: `public/og/og-${locale}.png` });
  console.log(`public/og/og-${locale}.png`);
}
await browser.close();
