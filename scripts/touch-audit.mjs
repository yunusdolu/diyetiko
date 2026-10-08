/**
 * Touch-device audit (phones + tablets, emulated touch: hover none, pointer coarse).
 * Usage: MSYS_NO_PATHCONV=1 node scripts/touch-audit.mjs [--base=http://localhost:3000] [--paths=/,/tarifler]
 *
 * Reports per page and device:
 *  - sideways overflow (the page is wider than the screen)
 *  - tap targets smaller than 44×44 px (WCAG 2.5.5 / Apple HIG), inline text links excluded
 *  - text inputs under 16 px (iOS Safari zooms the page when they get focus)
 *  - horizontal strips whose content is clipped but that cannot be scrolled
 * Read-only: it only loads pages, never submits anything.
 */
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.length ? rest.join('=') : true];
  }),
);
const base = String(args.base ?? 'http://localhost:3000');
const paths = String(
  args.paths ??
    '/,/tarifler,/tarifler/menemen,/rehberler,/araclar,/hedefini-bul,/hakkimda,/meslektaslar,/iletisim,/gizlilik,/en,/ar',
).split(',');
const devices = [
  { name: 'phone 360', viewport: { width: 360, height: 740 } },
  { name: 'phone 390', viewport: { width: 390, height: 844 } },
  { name: 'tablet 768', viewport: { width: 768, height: 1024 } },
  { name: 'tablet 1024 (landscape)', viewport: { width: 1024, height: 768 } },
  { name: 'tablet 1366 (iPad Pro landscape)', viewport: { width: 1366, height: 1024 } },
];

const browser = await chromium.launch();
let problems = 0;
for (const d of devices) {
  const ctx = await browser.newContext({
    viewport: d.viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem('dm_loader_seen', '1');
      document.cookie = 'LANG_SUGGEST_DISMISSED=1; path=/';
    } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const p of paths) {
    errors.length = 0;
    const res = await page.goto(base + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    // walk the page so scroll-triggered parts mount
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 700) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const report = await page.evaluate((deviceWidth) => {
      const out = { overflow: 0, small: [], inputs: [], stuck: [] };
      // isMobile: a too-wide page zooms out (innerWidth grows) instead of scrolling
      out.overflow =
        Math.max(window.innerWidth, document.documentElement.scrollWidth) - deviceWidth;
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          cs.visibility !== 'hidden' &&
          cs.display !== 'none' &&
          Number(cs.opacity) > 0.05
        );
      };
      const label = (el) =>
        (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.tagName)
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40);
      const inlineText = (el) => {
        // links inside running text are fine at text size (WCAG exception)
        if (el.tagName !== 'A') return false;
        const parent = el.parentElement;
        return (
          parent &&
          ['P', 'LI', 'SPAN', 'DD', 'TD'].includes(parent.tagName) &&
          parent.textContent.trim().length > el.textContent.trim().length + 20
        );
      };
      for (const el of document.querySelectorAll(
        'a[href], button, [role="button"], [role="radio"], [role="tab"], input:not([type=hidden]), select, summary, label[for]',
      )) {
        if (!visible(el) || inlineText(el) || el.closest('[aria-hidden="true"]')) continue;
        if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) continue;
        // a label's control is the target; the skip link only shows on keyboard focus
        if (el.matches('label[for]') || el.getAttribute('href') === '#main') continue;
        const r = el.getBoundingClientRect();
        // the effective target includes a pseudo-element stretched over a card
        const after = getComputedStyle(el, '::after');
        const stretched = after.content !== 'none' && after.position === 'absolute';
        if (!stretched && (r.width < 44 || r.height < 44))
          out.small.push(`${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      for (const el of document.querySelectorAll(
        'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), textarea, select',
      )) {
        if (!visible(el)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) out.inputs.push(`${el.name || el.type || el.tagName} ${fs}px`);
      }
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (
          el.scrollWidth > el.clientWidth + 4 &&
          cs.overflowX !== 'auto' &&
          cs.overflowX !== 'scroll' &&
          (cs.overflowX === 'hidden' || cs.overflowX === 'clip')
        ) {
          // clipped wide content: fine for decoration, a problem when it holds links/buttons
          const hidden = [...el.querySelectorAll('a[href], button')].filter((c) => {
            const r = c.getBoundingClientRect();
            const pr = el.getBoundingClientRect();
            return r.width > 0 && (r.left > pr.right - 2 || r.right < pr.left + 2);
          });
          if (hidden.length)
            out.stuck.push(
              `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} hides ${hidden.length} control(s)`,
            );
        }
      }
      out.small = [...new Set(out.small)];
      return out;
    }, d.viewport.width);
    const issues = [];
    if (res && res.status() >= 400) issues.push(`HTTP ${res.status()}`);
    if (report.overflow > 0) issues.push(`sideways overflow ${report.overflow}px`);
    if (report.small.length)
      issues.push(
        `small tap targets (${report.small.length}): ${report.small.slice(0, 12).join(' | ')}`,
      );
    if (report.inputs.length) issues.push(`inputs < 16px: ${report.inputs.join(', ')}`);
    if (report.stuck.length) issues.push(`clipped, not scrollable: ${report.stuck.join(' | ')}`);
    if (errors.length) issues.push(`page errors: ${errors.join(' | ').slice(0, 200)}`);
    if (issues.length) {
      problems += issues.length;
      console.log(`\n[${d.name}] ${p}`);
      for (const i of issues) console.log(`  - ${i}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(problems ? `\n${problems} issue group(s)` : '\nno issues');
