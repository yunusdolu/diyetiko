/**
 * Design verification screenshots (DESIGN.md process step 5).
 * Usage: node scripts/screenshots.mjs --paths=/,/tarifler --locales=tr,en,ar,fr --widths=390,768,1440
 *        [--base=http://localhost:3000] [--full] [--reduced] [--scroll=0,1200] [--out=shots] [--tag=r1]
 * Locale prefixes are resolved from the localized pathnames map for tr-only paths given as tr URLs;
 * pass explicit localized URLs with --urls=/en/recipes,/ar/wasafat when needed.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    const v = rest.length ? rest.join('=') : undefined;
    return [k, v ?? true];
  }),
);

const base = args.base ?? 'http://localhost:3000';
const widths = String(args.widths ?? '390,768,1440')
  .split(',')
  .map(Number);
const out = path.resolve(args.out ?? 'shots');
const tag = args.tag ? `-${args.tag}` : '';
const scrolls = String(args.scroll ?? '0')
  .split(',')
  .map(Number);
mkdirSync(out, { recursive: true });

// tr path → { tr, en, ar, fr } for the common static pages
const map = {
  '/': { tr: '/', en: '/en', ar: '/ar', fr: '/fr' },
  '/tarifler': { tr: '/tarifler', en: '/en/recipes', ar: '/ar/wasafat', fr: '/fr/recettes' },
  '/rehberler': { tr: '/rehberler', en: '/en/guides', ar: '/ar/adilla', fr: '/fr/guides' },
  '/araclar': { tr: '/araclar', en: '/en/tools', ar: '/ar/adawat', fr: '/fr/outils' },
  '/hedefini-bul': {
    tr: '/hedefini-bul',
    en: '/en/find-your-goal',
    ar: '/ar/hadafak',
    fr: '/fr/trouver-mon-objectif',
  },
  '/hakkimda': { tr: '/hakkimda', en: '/en/about', ar: '/ar/nabdha', fr: '/fr/a-propos' },
  '/meslektaslar': {
    tr: '/meslektaslar',
    en: '/en/professionals',
    ar: '/ar/lil-mukhtassin',
    fr: '/fr/professionnels',
  },
  '/iletisim': { tr: '/iletisim', en: '/en/contact', ar: '/ar/tawasul', fr: '/fr/contact' },
  '/gizlilik': {
    tr: '/gizlilik',
    en: '/en/privacy',
    ar: '/ar/al-khususiya',
    fr: '/fr/confidentialite',
  },
};

const locales = String(args.locales ?? 'tr,en,ar,fr').split(',');
let targets = [];
if (args.urls) {
  targets = String(args.urls)
    .split(',')
    .map((u) => ({ name: u.replace(/[/?=&]/g, '_') || 'root', url: u }));
} else {
  for (const p of String(args.paths ?? '/').split(',')) {
    for (const l of locales) {
      const url = map[p]?.[l] ?? (l === 'tr' ? p : `/${l}${p}`);
      targets.push({
        name: `${(p.replace(/\//g, '_') || '_home').replace(/^_$/, '_home')}-${l}`,
        url,
      });
    }
  }
}

const browser = await chromium.launch();

// --login (dietitian) / --portal (demo client): sign in ONCE and reuse the session for every
// width and run — the login forms are rate limited (10 attempts per 15 minutes per IP).
async function session(kind) {
  const file = path.join(os.tmpdir(), `dm-shots-${kind}.json`);
  const home = kind === 'admin' ? '/admin' : '/panel';
  const ctx = await browser.newContext(fs.existsSync(file) ? { storageState: file } : {});
  const page = await ctx.newPage();
  await page.goto(base + home, { waitUntil: 'domcontentloaded' });
  if (new URL(page.url()).pathname !== home) {
    await page.goto(base + home + '/login', { waitUntil: 'networkidle' });
    const email =
      kind === 'admin'
        ? (process.env.LOCAL_ADMIN_EMAIL ?? 'muzahim@local.test')
        : (process.env.LOCAL_CLIENT_EMAIL ?? 'danisan@local.test');
    const password =
      kind === 'admin'
        ? (process.env.LOCAL_ADMIN_PASSWORD ?? 'mutfak-demo-2026')
        : (process.env.LOCAL_CLIENT_PASSWORD ?? 'danisan-demo-2026');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', password);
    await Promise.all([
      page.waitForURL((u) => u.pathname === home, { timeout: 30000 }),
      page.click('button[type=submit]'),
    ]);
  }
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}
const storageState = args.login
  ? await session('admin')
  : args.portal
    ? await session('portal')
    : undefined;

for (const w of widths) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: w, height: w < 500 ? 844 : w < 1000 ? 1024 : 900 },
    deviceScaleFactor: 1,
    reducedMotion: args.reduced ? 'reduce' : 'no-preference',
    hasTouch: w < 1000,
    isMobile: w < 500,
  });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('dm_loader_seen', '1');
      document.cookie = 'LANG_SUGGEST_DISMISSED=1; path=/';
    } catch {}
  });
  const page = await context.newPage();
  if (args.login) {
    if (args.theme)
      await context.addCookies([{ name: 'admin_theme', value: String(args.theme), url: base }]);
    if (args.adminLocale)
      await context.addCookies([
        { name: 'ADMIN_LOCALE', value: String(args.adminLocale), url: base },
      ]);
  }
  if (args.portal && args.portalLocale)
    await context.addCookies([
      { name: 'PORTAL_LOCALE', value: String(args.portalLocale), url: base },
    ]);
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.error(`[console] ${m.text()}`));
  for (const t of targets) {
    const res = await page.goto(base + t.url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1400);
    let positions = scrolls;
    if (args.tour) {
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      const vh = page.viewportSize().height;
      const step = Math.round(vh * Number(args.step ?? 0.9));
      positions = [];
      for (let y = 0; y < total - vh / 2; y += step) positions.push(y);
    }
    for (const y of positions) {
      if (y > 0) {
        await page.evaluate((yy) => {
          const l = window.__lenis;
          if (l) l.scrollTo(yy, { immediate: true, force: true });
          else window.scrollTo(0, yy);
        }, y);
        await page.waitForTimeout(Number(args.wait ?? 1300));
      }
      const file = path.join(
        out,
        `${t.name}-${w}${y ? `-y${String(y).padStart(5, '0')}` : ''}${tag}.png`,
      );
      await page.screenshot({ path: file, fullPage: Boolean(args.full) });
      console.log(`${res?.status()} ${t.url} @${w}${y ? ` y=${y}` : ''} → ${path.basename(file)}`);
    }
  }
  await context.close();
}
await browser.close();
