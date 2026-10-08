/**
 * Rough lab Web Vitals (LCP, CLS) for a few routes against a running server — ideally `pnpm start`.
 * Mobile viewport, 4× CPU slowdown, ~Fast 4G network via CDP. Not a substitute for field data.
 *   node scripts/vitals.mjs [--base=http://localhost:3100] [--paths=/,/ar,/tarifler]
 */
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const base = args.base ?? 'http://localhost:3100';
const paths = (args.paths ?? '/,/ar,/tarifler,/ar/wasafat,/tarifler/menemen').split(',');

const browser = await chromium.launch();
for (const path of paths) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (9 * 1024 * 1024) / 8,
    uploadThroughput: (1.5 * 1024 * 1024) / 8,
  });
  await page.addInitScript(() => {
    window.__v = { lcp: 0, cls: 0, lcpEl: '' };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__v.lcp = e.startTime;
        window.__v.lcpEl = e.element
          ? `${e.element.tagName.toLowerCase()}.${String(e.element.className).slice(0, 40)}`
          : '';
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  // a little scrolling surfaces shifts from late content / fonts
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1200);
  const v = await page.evaluate(() => window.__v);
  console.log(
    `${path.padEnd(22)} LCP ${Math.round(v.lcp)}ms  CLS ${v.cls.toFixed(3)}  (${v.lcpEl})`,
  );
  await ctx.close();
}
await browser.close();
