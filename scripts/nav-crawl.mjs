/**
 * Clicks through the site like a visitor (client-side navigation, not full reloads) and reports
 * every page error / console error per step. Catches bugs that only happen when one page is
 * replaced by another (e.g. DOM moved by an animation library).
 *   node scripts/nav-crawl.mjs [--base=http://localhost:3000] [--locale=tr] [--width=1440]
 */
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const base = args.base ?? 'http://localhost:3000';
const locale = args.locale ?? 'tr';
const width = Number(args.width ?? 1440);
const start = locale === 'tr' ? '/' : `/${locale}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width, height: 900 },
  hasTouch: width < 800,
  isMobile: width < 500,
});
await ctx.addInitScript(() => sessionStorage.setItem('dm_loader_seen', '1'));
const page = await ctx.newPage();
const problems = [];
let step = 'initial load';
page.on('pageerror', (e) => problems.push(`[${step}] pageerror: ${e.message.split('\n')[0]}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/React DevTools|Download the React/.test(m.text()))
    problems.push(`[${step}] console: ${m.text().split('\n')[0].slice(0, 200)}`);
});

await page.goto(base + start, { waitUntil: 'networkidle' });

// Internal links reachable from the header/footer/body of each visited page.
const internal = async () =>
  page.$$eval('a[href^="/"]', (as) =>
    [...new Set(as.map((a) => a.getAttribute('href')))].filter(
      (h) =>
        h &&
        !h.startsWith('/admin') &&
        !h.startsWith('/p/') &&
        !h.startsWith('/api') &&
        !h.includes('#'),
    ),
  );

const seen = new Set([start]);
const queue = await internal();
let visits = 0;
let reloads = 0;
while (queue.length && visits < 60) {
  const href = queue.shift();
  if (seen.has(href)) continue;
  seen.add(href);
  // Every other step goes through the home page first: it has the scroll-pinned sections, so
  // home → X and X → home are the riskiest transitions.
  if (visits % 2 === 1) {
    step = `${page.url().replace(base, '')} → ${start} (home)`;
    await page.evaluate((h) => document.querySelector(`a[href="${h}"]`)?.click(), start);
    await page.waitForURL((u) => u.pathname === start, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500); // GSAP loads and pins
  }
  // Scroll first so scroll-driven animations (pins, parallax) are active when we leave.
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(400);
  step = `${page.url().replace(base, '')} → ${href}`;
  try {
    // Programmatic click: still goes through Next's <Link> client navigation, even when the link
    // sits in a hidden header/menu. A silent full reload here would hide unmount bugs.
    const clicked = await page.evaluate((h) => {
      const a = document.querySelector(`a[href="${h}"]`);
      if (!a) return false;
      a.click();
      return true;
    }, href);
    if (!clicked) throw new Error('no link');
    await page.waitForURL((u) => decodeURI(u.pathname) === decodeURI(href.split('?')[0]), {
      timeout: 10000,
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  } catch {
    reloads++;
    await page.goto(base + href, { waitUntil: 'networkidle' });
  }
  visits++;
  for (const h of await internal()) if (!seen.has(h)) queue.push(h);
  // Go back sometimes — back/forward is its own code path.
  if (visits % 4 === 0) {
    step = `back from ${href}`;
    await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(400);
  }
}
console.log(
  `visited ${visits} pages (${visits - reloads} via client-side clicks, ${reloads} full loads) (${locale}, ${width}px); problems: ${problems.length}`,
);
for (const p of [...new Set(problems)]) console.log(' -', p);
await browser.close();
