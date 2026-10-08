import { expect, test, type Page } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/** Go to a panel page and wait until it answers clicks (React has hydrated it). */
async function open(page: import('@playwright/test').Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

/*
 * The panel's navigation (DESIGN.md v1.15, components/ui/sidebar.tsx): a sidebar that collapses
 * to an icon rail and back (header toggle, Ctrl+B, the logo while collapsed), remembered across
 * reloads, with the page beside it gliding along on every frame of the 240 ms transition; the theme
 * and language controls; on phones the same sidebar in a drawer.
 */
const nav = tr.admin.nav;
const SIDEBAR = '[data-slot="sidebar"]';

const width = (page: Page) =>
  page.evaluate(
    (sel) => Math.round(document.querySelector(sel)!.getBoundingClientRect().width),
    SIDEBAR,
  );

/** The toggle answers clicks only once React has hydrated the page (dev builds take a moment). */
const hydrated = (page: Page) =>
  page.waitForFunction(() => {
    const el = document.querySelector(
      '[data-slot="sidebar-toggle"], [data-slot="sidebar-header"][role="button"]',
    );
    return Boolean(el && Object.keys(el).some((k) => k.startsWith('__reactProps')));
  });

test.beforeEach(async ({ context }) => {
  // every test starts expanded and in day mode
  await context.addCookies([
    { name: 'admin_sidebar', value: 'expanded', url: 'http://localhost:3000' },
    { name: 'admin_theme', value: 'light', url: 'http://localhost:3000' },
  ]);
});

test('collapse and expand: header toggle, the logo, Ctrl+B — remembered after a reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, '/admin');
  const sidebar = page.locator(SIDEBAR);
  await expect.poll(() => width(page)).toBe(214);
  await hydrated(page);
  await expect(sidebar.getByText(nav.clients, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: nav.collapse }).click();
  await expect.poll(() => width(page)).toBe(60);
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
  // labels fade out in place (they stay in the tree, hidden); the icons keep their names
  await expect(sidebar.getByText(nav.clients, { exact: true })).toBeHidden();
  await expect(sidebar.getByRole('link', { name: nav.clients })).toBeVisible();

  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect.poll(() => width(page)).toBe(60); // the server rendered it collapsed
  await hydrated(page);

  // collapsed: the logo area expands it
  await page.getByRole('button', { name: nav.expand }).click();
  await expect.poll(() => width(page)).toBe(214);

  await page.keyboard.press('Control+b');
  await expect.poll(() => width(page)).toBe(60);
  await page.keyboard.press('Control+b');
  await expect.poll(() => width(page)).toBe(214);
  expect(errors).toEqual([]);
});

test('the page beside it moves with the sidebar on every frame', async ({ page }) => {
  await open(page, '/admin');
  await expect.poll(() => width(page)).toBe(214);
  await hydrated(page);
  // record from the moment the toggle is pressed, for half a second
  await page.evaluate((sel) => {
    const w = window as unknown as { __frames: Promise<{ nav: number; main: number }[]> };
    const toggle = document.querySelector('[data-slot="sidebar-toggle"]')!;
    w.__frames = new Promise((done) => {
      toggle.addEventListener(
        'click',
        () => {
          const navEl = document.querySelector(sel)!;
          const main = document.querySelector('main')!;
          const rows: { nav: number; main: number }[] = [];
          const t0 = performance.now();
          const tick = () => {
            rows.push({
              nav: navEl.getBoundingClientRect().right,
              main: main.getBoundingClientRect().left,
            });
            if (performance.now() - t0 < 500) requestAnimationFrame(tick);
            else done(rows);
          };
          requestAnimationFrame(tick);
        },
        { once: true },
      );
    });
  }, SIDEBAR);
  await page.getByRole('button', { name: nav.collapse }).click();
  const rows = await page.evaluate(
    () => (window as unknown as { __frames: Promise<{ nav: number; main: number }[]> }).__frames,
  );
  // an animation, not a jump: several in-between widths…
  const distinct = new Set(rows.map((r) => Math.round(r.nav)));
  expect(distinct.size).toBeGreaterThan(5);
  // …and the page's edge is glued to the sidebar's in each of them
  for (const r of rows) expect(Math.abs(r.main - r.nav)).toBeLessThanOrEqual(1.5);
});

test('theme and language controls', async ({ page }) => {
  await open(page, '/admin');
  const sidebar = page.locator(SIDEBAR);
  await sidebar.getByRole('button', { name: new RegExp(`^${nav.theme}`) }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // saved (cookie) before reloading
  await expect
    .poll(async () => (await page.context().cookies()).find((c) => c.name === 'admin_theme')?.value)
    .toBe('dark');
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await sidebar.getByRole('button', { name: new RegExp(`^${nav.theme}`) }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  // the day/night reveal (a view transition) takes the clicks while it plays
  await expect(page.locator('html[data-vt-theme]')).toHaveCount(0);

  await sidebar.locator(`button[aria-label^="${tr.admin.common.language}"]`).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitemradio')).toHaveCount(4);
  await expect(menu.getByRole('menuitemradio', { name: /Türkçe/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the drawer slides in from the menu button and closes', async ({ page }) => {
    await open(page, '/admin');
    // the desktop sidebar is not shown on a phone
    await expect(page.locator(SIDEBAR)).toBeHidden();
    const dock = page.getByRole('navigation', { name: nav.more });
    await dock.getByRole('button', { name: nav.more }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: nav.settings })).toBeVisible();
    await expect
      .poll(() => drawer.evaluate((el) => Math.round(el.getBoundingClientRect().left)))
      .toBe(0);
    await drawer.getByRole('button', { name: tr.admin.common.close }).click();
    await expect(drawer).toBeHidden();
    // following a link closes it too
    await dock.getByRole('button', { name: nav.more }).click();
    await page.getByRole('dialog').getByRole('link', { name: nav.appointments }).click();
    await expect(page).toHaveURL(/\/admin\/appointments$/);
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test('moving between pages: the knife cut beneath a sidebar that stays put', async ({ page }) => {
  await open(page, '/admin');
  await page.evaluate(() => {
    const w = window as unknown as { __vt: Promise<string[]> };
    w.__vt = new Promise((done) => {
      const seen = new Set<string>();
      const t0 = performance.now();
      const tick = () => {
        for (const a of document.getAnimations())
          if (a instanceof CSSAnimation)
            seen.add(`${(a.effect as KeyframeEffect).pseudoElement ?? ''} ${a.animationName}`);
        if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
        else done([...seen]);
      };
      tick();
    });
  });
  await page.locator(`${SIDEBAR} a[href="/admin/clients"]`).click();
  const seen = await page.evaluate(() => (window as unknown as { __vt: Promise<string[]> }).__vt);
  expect(seen).toContain('::view-transition-new(root) vt-cut');
  // the sidebar is its own layer, not cut with the page
  expect(seen.some((s) => s.includes('admin-sidebar'))).toBe(false);
  await expect(page).toHaveURL(/\/admin\/clients$/);
});

test('collapsed: the logo stays a link home, the button under it expands', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'admin_sidebar', value: 'collapsed', url: 'http://localhost:3000' },
  ]);
  await open(page, '/admin/clients');
  await expect.poll(() => width(page)).toBe(60);
  await page.locator('[data-slot="sidebar-header"] a').click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator(SIDEBAR)).toHaveAttribute('data-collapsed', 'true');
  // the button sits under the logo, centred on the rail (once the row under the logo has opened)
  const measure = () =>
    page.evaluate((sel) => {
      const r = (el: Element | null) => el!.getBoundingClientRect();
      const [logo, button, rail] = [
        r(document.querySelector('[data-slot="sidebar-header"] a')),
        r(document.querySelector('[data-slot="sidebar-toggle"]')),
        r(document.querySelector(sel)),
      ].map((b) => ({ top: b.top, mid: b.left + b.width / 2 }));
      return { below: button!.top > logo!.top, off: Math.abs(button!.mid - rail!.mid) };
    }, SIDEBAR);
  await expect.poll(async () => (await measure()).off).toBeLessThanOrEqual(1);
  expect((await measure()).below).toBe(true);
  await page.getByRole('button', { name: nav.expand }).click();
  await expect.poll(() => width(page)).toBe(214);
});
