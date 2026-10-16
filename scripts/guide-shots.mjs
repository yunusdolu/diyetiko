/*
 * The guide's screenshots (/panel/help, /admin/help — DESIGN.md v1.35).
 *
 * Takes a picture of every page the guide explains, in each language and (dietitian panel) in both
 * themes, from the LOCAL DEMO backend — fictional seed data only, never a real client — and writes
 *   public/guide/<scope>/<locale>[-dark]/<topic>.webp
 *   lib/guide/pins.json      where each step's number sits on its picture (fractions of the image)
 *
 * The numbers are measured from the page itself: every step names the control it is about (a
 * message key, so the same control is found in every language, or a selector), and the pin is put
 * on that control. A control that is not on screen simply gets no pin; the run prints which.
 *
 * Usage — the test server on :3100 (fresh seed data), signed in once, then the pictures:
 *   node scripts/e2e-server.mjs
 *   E2E_BASE_URL=http://localhost:3100 pnpm exec playwright test e2e/auth.setup.ts --no-deps
 *   node scripts/guide-shots.mjs            # everything
 *   node scripts/guide-shots.mjs portal tr  # one scope / one language
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');

const BASE = process.env.GUIDE_BASE ?? 'http://localhost:3100';
const W = 1280;
const H = 900;
const DENIZ = '8c333d28-8e6c-5635-946c-1e3d9066554c'; // the demo client who uses the portal
const MERT = '6b2010b0-cd81-5359-9d4b-1e6ef7957fb4'; // a demo client without a portal account
const SAMPLE_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n',
);
const [onlyScope, onlyLocale] = process.argv.slice(2);

/** per step: anchors tried in order — "text:<message key>", "leaf:<key name>", "aria:<key>", "css:<selector>" */
const TOPICS = {
  portal: {
    today: {
      url: '/panel',
      // taller than the rest: the programme card (step 3) sits below the first screen
      height: 1480,
      pins: [
        ['css:#checkin h2'],
        ['css:a[href="#checkin"]'],
        ['css:#plan h2'],
        ['css:#dietitian h2'],
      ],
    },
    program: {
      url: '/panel/program',
      pins: [
        ['css:main [role="tablist"]', 'css:main nav'],
        ['text:macros.protein', 'text:portal.diary.vsTarget'],
        ['text:meals.breakfast', 'text:meals.lunch'],
        ['text:portal.program.print'],
      ],
    },
    diary: {
      url: '/panel/diary',
      pins: [
        ['text:portal.diary.today', 'css:main nav'],
        ['text:portal.diary.add'],
        ['text:portal.diary.addPlanned', 'text:portal.diary.planned', 'text:portal.diary.addPhoto'],
        ['text:portal.diary.totalsTitle'],
      ],
    },
    progress: {
      url: '/panel/progress',
      // the habits (step 4) sit below the first screen; the guide pans down to them
      height: 1480,
      pins: [
        ['text:portal.progress.current'],
        ['aria:portal.progress.rangeLabel', 'css:main [role="tablist"]'],
        ['text:portal.progress.chartTitle', 'text:portal.progress.weight'],
        ['text:portal.progress.habits'],
      ],
    },
    week: {
      url: '/panel/week',
      pins: [
        ['css:main dl > div'],
        ['text:portal.week.strip'],
        ['text:portal.week.daily'],
        ['text:portal.week.tell'],
      ],
    },
    messages: {
      url: '/panel/messages',
      pins: [
        ['css:main textarea'],
        ['aria:portal.messages.attachFile', 'leaf:attachFile'],
        ['css:main [data-openers] button'],
        ['css:main ol > li'],
      ],
    },
    care: {
      url: '/panel/care',
      pins: [
        ['text:portal.care.upcoming'],
        ['text:portal.care.addToCalendar', 'text:portal.care.past'],
        ['text:portal.care.plan'],
        ['text:portal.care.payments', 'text:portal.care.sessions'],
      ],
    },
    files: {
      url: '/panel/files',
      pins: [
        ['text:portal.files.send'],
        ['text:portal.files.groups.mine'],
        ['text:portal.files.groups.theirs'],
        ['css:main ul li a'],
      ],
    },
    shopping: {
      url: '/panel/shopping',
      pins: [
        ['text:portal.shopping.days'],
        ['text:portal.shopping.list'],
        ['css:main [role="checkbox"]'],
        ['text:portal.shopping.copy'],
      ],
    },
    account: {
      url: '/panel/account',
      pins: [
        ['text:portal.account.profile'],
        ['text:portal.account.language'],
        ['text:portal.account.password'],
        ['text:portal.account.data'],
      ],
    },
  },
  admin: {
    dashboard: {
      url: '/admin',
      pins: [
        ['css:main h1'],
        ['css:main .grid.grid-cols-2 > *'],
        ['css:main .dash-card [role="tablist"]', 'css:main .dash-card button[aria-haspopup]'],
        ['text:admin.dashboard.tasks.title'],
      ],
    },
    clients: {
      url: '/admin/clients',
      pins: [
        ['text:admin.common.search', 'css:main input[type="search"]'],
        ['text:admin.clients.new', 'text:admin.clients.quickAdd', 'text:admin.common.new'],
        [`css:main a[href^="/admin/clients/"]`],
        ['text:admin.clients.deletedList', 'text:admin.common.view'],
      ],
    },
    profile: {
      url: `/admin/clients/${DENIZ}`,
      // the page's own tabs come after the one in the tab strip
      pins: [
        ['nth:[role="tab"]|1'],
        ['nth:[role="tab"]|6'],
        ['nth:[role="tab"]|3'],
        ['nth:[role="tab"]|9'],
      ],
    },
    invite: {
      // a client without a panel account, with a link just made: the WhatsApp button and the QR
      // code appear only then (the sandbox's own invite, never a real client)
      url: `/admin/clients/${MERT}?tab=general`,
      scrollTo: 'text:admin.portal.title',
      click: ['text:admin.portal.createInvite', 'text:admin.portal.newInvite'],
      pins: [
        ['text:admin.portal.newInvite', 'text:admin.portal.createInvite'],
        ['text:admin.portal.whatsapp'],
        ['text:admin.portal.qr'],
        ['text:admin.portal.createReset', 'text:admin.portal.revoke'],
      ],
    },
    programs: {
      url: '/admin/programs',
      // the status field (step 4) sits in the side column below the first screen; the food list
      // fills the window's height, so it keeps the height it has on a 900 px screen
      height: 1420,
      style: '[data-food-palette]{max-height:670px!important}',
      open: 'main a[href^="/admin/programs/"]',
      pins: [
        ['text:admin.programs.addDay'],
        ['text:admin.programs.dayTotal', 'text:admin.programs.targets'],
        ['text:admin.programs.addMeal', 'text:admin.programs.addItem'],
        [
          'text:admin.common.status',
          'css:main select[name="status"]',
          'text:admin.programs.status.active',
          'text:admin.programs.status.draft',
        ],
      ],
    },
    messages: {
      url: '/admin/messages',
      open: 'main li a, main li button',
      pins: [
        ['css:main a[href*="/admin/messages?"]', 'css:main ul li'],
        ['css:main textarea'],
        ['leaf:attachFile'],
        ['css:[data-slot="sidebar"] a[href="/admin/messages"]', 'css:a[href="/admin/messages"]'],
      ],
    },
    appointments: {
      url: '/admin/appointments',
      pins: [
        ['text:admin.appointments.new'],
        ['text:admin.appointments.calendar'],
        ['css:main li button', 'css:main table tbody tr'],
        ['aria:admin.appointments.nextWeek', 'text:admin.appointments.week'],
      ],
    },
    payments: {
      url: '/admin/payments',
      pins: [
        ['css:main button[aria-haspopup]'],
        ['text:admin.payments.received'],
        ['text:admin.common.search'],
        ['text:admin.payments.list'],
      ],
    },
    leads: {
      url: '/admin/leads',
      pins: [
        ['nth:[role="tab"]|1'],
        ['css:main button[aria-haspopup]'],
        ['css:main ul > li', 'css:main table tbody tr'],
        ['nth:[role="tab"]|3'],
      ],
    },
    explorer: {
      url: '/admin/explorer',
      pins: [
        ['aria:admin.common.next'],
        ['text:admin.explorer.progress', 'text:admin.explorer.goal'],
        ['text:admin.explorer.latest'],
        ['text:admin.explorer.openProfile'],
      ],
    },
    content: {
      url: '/admin/recipes',
      pins: [
        ['nth:[role="tab"]|1'],
        ['text:admin.cms.newRecipe'],
        ['css:main a[href^="/admin/recipes/"]'],
        ['text:admin.cms.published'],
      ],
    },
    settings: {
      url: '/admin/settings',
      // security and two-step sign-in (steps 3–4) are near the end of a long page
      height: 2460,
      pins: [
        ['text:admin.settings.profile'],
        ['text:admin.settings.adminLanguage'],
        ['text:admin.settings.security', 'text:admin.settings.changePassword'],
        ['text:admin.settings.mfa'],
      ],
    },
    shortcuts: {
      url: '/admin',
      pins: [
        ['aria:admin.tabs.new'],
        ['text:admin.nav.search'],
        ['css:[data-slot="sidebar-toggle"]'],
        ['text:admin.nav.theme'],
      ],
    },
  },
};

const LOCALES = ['tr', 'en', 'ar', 'fr'];
const COOKIE = { portal: 'PORTAL_LOCALE', admin: 'ADMIN_LOCALE' };
const pinsFile = 'lib/guide/pins.json';
mkdirSync('lib/guide', { recursive: true });
let pinsOut = {};
try {
  pinsOut = JSON.parse(readFileSync(pinsFile, 'utf8'));
} catch {
  /* first run */
}

const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const leaves = (obj, name, out = []) => {
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (typeof v === 'string' && k === name) out.push(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, name, out);
  }
  return out;
};

async function locate(page, messages, scope, anchor, h = H) {
  const kind = anchor.slice(0, anchor.indexOf(':'));
  const value = anchor.slice(anchor.indexOf(':') + 1);
  let candidates = [];
  if (kind === 'css') candidates = [page.locator(value)];
  else if (kind === 'nth') {
    const [css, n] = value.split('|');
    candidates = [page.locator(css).nth(Number(n))];
  } else if (kind === 'text') {
    const text = at(messages, value);
    if (typeof text === 'string')
      candidates = [page.getByText(text.replace(/…$/, ''), { exact: false })];
  } else if (kind === 'aria') {
    const text = at(messages, value);
    if (typeof text === 'string')
      candidates = [page.locator(`[aria-label="${text.replace(/"/g, '\\"')}"]`)];
  } else if (kind === 'leaf') {
    candidates = leaves(messages[scope], value).flatMap((text) => [
      page.locator(`[aria-label="${text.replace(/"/g, '\\"')}"]`),
      page.getByText(text, { exact: true }),
    ]);
  }
  for (const c of candidates) {
    const n = Math.min(await c.count(), 12);
    for (let i = 0; i < n; i++) {
      const el = c.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const box = await el.boundingBox();
      if (!box || box.width < 4 || box.height < 4) continue;
      // inside the picture, with room for the pin
      const big = box.width > 320 || box.height > 110;
      const x = big ? box.x + 18 : box.x + Math.min(box.width / 2, 14);
      const y = big ? box.y + 18 : box.y + box.height / 2;
      if (x < 12 || x > W - 12 || y < 12 || y > h - 12) continue;
      return [Math.round((x / W) * 1000) / 1000, Math.round((y / h) * 1000) / 1000];
    }
  }
  return null;
}

/** keep pins from sitting on top of each other */
function spread(pins, h = H) {
  const placed = [];
  return pins.map((p) => {
    if (!p) return p;
    let [x, y] = p;
    for (let guard = 0; guard < 6; guard++) {
      if (!placed.some(([px, py]) => Math.abs(px - x) * W < 26 && Math.abs(py - y) * h < 26)) break;
      x = Math.min(0.985, x + 30 / W);
    }
    placed.push([x, y]);
    return [x, y];
  });
}

// fictional seed data only, and preparing the pictures writes (a sample file, an invite link):
// never anywhere but the local demo backend
const login = await (await fetch(`${BASE}/admin/login`)).text();
if (!login.includes('data-backend="local"')) {
  console.error(`refused: ${BASE} is not running the local demo backend`);
  process.exit(1);
}

const browser = await chromium.launch();

/** a file in the client's list, for the Files page's "open a file" step — once per database */
async function prepare() {
  const tr = JSON.parse(readFileSync('messages/tr.json', 'utf8'));
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/client.json' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/panel/files`);
  await page.waitForLoadState('networkidle').catch(() => {});
  if (!(await page.locator('main ul li a').count())) {
    await page.goto(`${BASE}/panel/messages`);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'kan-tahlili.pdf', mimeType: 'application/pdf', buffer: SAMPLE_PDF });
    await page.getByLabel(tr.portal.messages.placeholder).fill('Son tahlil sonuçlarım ekte.');
    await page.getByRole('button', { name: tr.portal.messages.send }).click();
    await page
      .getByRole('link', { name: /kan-tahlili\.pdf/ })
      .first()
      .waitFor();
  }
  await ctx.close();
}
await prepare();

const missing = [];
let shots = 0;
for (const scope of ['portal', 'admin']) {
  if (onlyScope && onlyScope !== scope) continue;
  for (const locale of LOCALES) {
    if (onlyLocale && onlyLocale !== locale) continue;
    const messages = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8'));
    for (const theme of scope === 'admin' ? ['light', 'dark'] : ['light']) {
      const ctx = await browser.newContext({
        storageState: `e2e/.auth/${scope === 'admin' ? 'admin' : 'client'}.json`,
        viewport: { width: W, height: H },
        deviceScaleFactor: 1,
        timezoneId: 'Europe/Istanbul',
      });
      await ctx.addCookies([
        { name: COOKIE[scope], value: locale, url: BASE },
        ...(scope === 'admin' ? [{ name: 'admin_theme', value: theme, url: BASE }] : []),
        {
          name: scope === 'admin' ? 'admin_sidebar' : 'portal_sidebar',
          value: 'expanded',
          url: BASE,
        },
      ]);
      // no first-visit card, no stale tabs; the pictures show the page as it opens
      await ctx.addInitScript(() => {
        localStorage.setItem('portal_tour_seen', '1');
        localStorage.setItem('admin_tour_seen', '1');
        localStorage.setItem('portal_welcome_closed', '1');
        localStorage.removeItem('admin_tabs');
      });
      const page = await ctx.newPage();
      const dir = `public/guide/${scope}/${locale}${theme === 'dark' ? '-dark' : ''}`;
      mkdirSync(dir, { recursive: true });
      for (const [topic, spec] of Object.entries(TOPICS[scope])) {
        const h = spec.height ?? H;
        try {
          await page.setViewportSize({ width: W, height: h });
          await page.goto(BASE + spec.url, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
          if (spec.open) {
            const link = page.locator(spec.open).first();
            if (await link.count()) {
              await link.click();
              await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
            }
          }
          // development chrome is not part of the product
          await page.addStyleTag({
            content:
              'nextjs-portal,[data-nextjs-toast],[data-first-run],[data-slot="sidebar"]>p{display:none!important}*{caret-color:transparent!important}' +
              (spec.style ?? ''),
          });
          if (spec.click) {
            for (const a of spec.click) {
              const text = at(messages, a.slice(5));
              const el =
                typeof text === 'string' ? page.getByText(text, { exact: true }).first() : null;
              if (el && (await el.count())) {
                await el.click();
                await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
                break;
              }
            }
          }
          if (spec.scrollTo) {
            const key = spec.scrollTo.slice(5);
            const text = at(messages, key);
            const el =
              typeof text === 'string' ? page.getByText(text, { exact: true }).first() : null;
            if (el && (await el.count()))
              await el.evaluate((n) => {
                const top = n.getBoundingClientRect().top;
                const box =
                  document.querySelector('main')?.closest('[class*="overflow-y"]') ??
                  document.scrollingElement;
                (box === document.scrollingElement ? window : box).scrollBy(0, top - 220);
              });
          }
          await page.mouse.move(W - 4, h - 4);
          await page.waitForTimeout(1500);
          const pins = [];
          for (const [i, anchors] of spec.pins.entries()) {
            let pin = null;
            for (const a of anchors) {
              pin = await locate(page, messages, scope, a, h);
              if (pin) break;
            }
            if (!pin) missing.push(`${scope}/${locale}/${theme}/${topic} step ${i + 1}`);
            pins.push(pin);
          }
          const png = await page.screenshot({ type: 'png' });
          await sharp(png).webp({ quality: 74, effort: 5 }).toFile(`${dir}/${topic}.webp`);
          pinsOut[`${scope}/${locale}/${theme}/${topic}`] = spread(pins, h);
          shots++;
        } catch (e) {
          missing.push(`${scope}/${locale}/${theme}/${topic}: ${String(e).slice(0, 120)}`);
        }
      }
      await ctx.close();
      console.log(`${scope} ${locale} ${theme}: done`);
    }
  }
}
await browser.close();
// laid out the way Prettier writes it (one pin per line), so a new run passes `pnpm format`
const pinLine = (p) => `    ${p ? `[${p[0]}, ${p[1]}]` : 'null'}`;
const entries = Object.entries(pinsOut).sort(([a], [b]) => a.localeCompare(b));
writeFileSync(
  pinsFile,
  `{\n${entries
    .map(([k, pins]) => `  ${JSON.stringify(k)}: [\n${pins.map(pinLine).join(',\n')}\n  ]`)
    .join(',\n')}\n}\n`,
);
console.log(`${shots} pictures`);
console.log(missing.length ? `no pin / failed:\n${missing.join('\n')}` : 'every step has a pin');
