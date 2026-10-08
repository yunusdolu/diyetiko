/**
 * Verifies the printable share page in a given program language (default: ar):
 *   node scripts/verify-share-pdf.mjs [--lang=ar] [--token=...] [--program=<uuid>]
 * Temporarily switches the program's language through the builder UI (the same path the
 * dietitian uses), writes shots/share-<lang>-{390,1440}.png and shots/share-<lang>.pdf,
 * then restores the original language. Requires `pnpm dev` and e2e/.auth/admin.json
 * (created by `pnpm test:e2e`).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import tr from '../messages/tr.json' with { type: 'json' };

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const base = args.base ?? 'http://localhost:3000';
const lang = args.lang ?? 'ar';
const program = args.program ?? '754274d3-6afe-5580-b37e-880bc48c494f';
const token = args.token ?? 'demo-share-token-7f3a9c2e41b8d6f05a1e3c9b7d2f4a6e8c0b1d3f5a7';
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const admin = await browser.newContext({ storageState: 'e2e/.auth/admin.json', baseURL: base });
const page = await admin.newPage();

async function setLanguage(value) {
  await page.goto(`/admin/programs/${program}`);
  // The builder's own field (the sidebar also has a language select — that one is the admin UI language).
  const select = page.getByLabel(tr.admin.programs.language, { exact: true });
  const previous = await select.inputValue();
  if (previous !== value) {
    await select.selectOption(value);
    // autosave: the badge leaves "idle", then returns to it once the save lands
    const badge = page.getByRole('status').filter({ hasText: /./ }).first();
    const idle = tr.admin.programs.autosave.idle;
    await page
      .waitForFunction(
        (t) =>
          ![...document.querySelectorAll('[role=status]')].some((e) => e.textContent?.includes(t)),
        idle,
        { timeout: 5000 },
      )
      .catch(() => {});
    await badge.filter({ hasText: idle }).waitFor({ timeout: 15000 });
  }
  return previous;
}

const original = await setLanguage(lang);
try {
  const visitor = await (await browser.newContext({ baseURL: base })).newPage();
  for (const width of [390, 1440]) {
    await visitor.setViewportSize({ width, height: 900 });
    const res = await visitor.goto(`/p/${token}`);
    console.log(
      `share ${lang} @${width}: ${res?.status()} lang=${await visitor.locator('html').getAttribute('lang')} dir=${await visitor.locator('html').getAttribute('dir')}`,
    );
    await visitor.screenshot({ path: `shots/share-${lang}-${width}.png`, fullPage: width === 390 });
  }
  // Print layout at A4 width (the PDF is rendered from exactly this layout by the same engine).
  await visitor.emulateMedia({ media: 'print' });
  await visitor.setViewportSize({ width: 794, height: 1123 });
  await visitor.reload();
  await visitor.evaluate(() => document.fonts.ready);
  await visitor.waitForTimeout(2000); // let the rings finish drawing
  await visitor.screenshot({ path: `shots/share-${lang}-print.png`, fullPage: true });
  await visitor.pdf({ path: `shots/share-${lang}.pdf`, format: 'A4', printBackground: true });
  // Fonts embedded in the PDF (subset names look like ABCDEF+ReadexPro-Regular).
  const raw = readFileSync(`shots/share-${lang}.pdf`, 'latin1');
  const fonts = [
    ...new Set([...raw.matchAll(/\/BaseFont\s*\/([A-Z]{6}\+)?([A-Za-z0-9-]+)/g)].map((m) => m[2])),
  ];
  console.log(
    `pdf → shots/share-${lang}.pdf · embedded fonts: ${fonts.join(', ') || '(none found)'}`,
  );
} finally {
  if (original !== lang) await setLanguage(original);
  console.log(`restored program language → ${original}`);
  await browser.close();
}
