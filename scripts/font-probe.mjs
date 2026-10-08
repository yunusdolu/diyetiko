/**
 * Lists elements whose text is rendered with a system fallback font (Arial/Times/Segoe/Tahoma)
 * instead of the brand faces — catches missing glyphs and next/font metric-fallback traps.
 *   MSYS_NO_PATHCONV=1 node scripts/font-probe.mjs /ar/wasafat
 */
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ baseURL: process.env.BASE_URL ?? 'http://localhost:3000' });
const page = await ctx.newPage();
const url = process.argv[2] ?? '/ar';
await page.goto(url);
await page.evaluate(() => document.fonts.ready);
const cdp = await ctx.newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
const hits = new Map();
async function walk(n) {
  if (n.nodeType === 1 && !['SCRIPT', 'STYLE', 'svg'].includes(n.nodeName)) {
    try {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: n.nodeId });
      for (const f of fonts)
        if (/arial|times|segoe|tahoma/i.test(f.familyName)) {
          const { outerHTML } = await cdp.send('DOM.getOuterHTML', { nodeId: n.nodeId });
          hits.set(outerHTML.slice(0, 160), f.familyName + ' ×' + f.glyphCount);
        }
    } catch {}
  }
  for (const c of n.children ?? []) await walk(c);
}
await walk(root);
console.log(url, hits.size ? '' : 'no system-font fallbacks');
for (const [k, v] of hits) console.log(v, '←', k);
await b.close();
