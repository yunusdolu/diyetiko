import { expect, test, type Page } from '@playwright/test';

/*
 * The ink loader (components/motion/ink-loader.tsx): plays on the first page of a visit and after
 * a language switch — always to the end — and never on later pages. The headline waits under it
 * and rises as it opens, without its timing ever jumping.
 */

/** The headline's first letter, offset (px) from its resting place; 0 = risen. */
const firstLetter = (page: Page) =>
  page.evaluate(() => {
    const u = document.querySelector('.kin-unit');
    return u ? new DOMMatrix(getComputedStyle(u).transform).m42 : null;
  });

test('first visit: the loader plays to the end, then the headline rises', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const loader = page.locator('.ink-loader');
  await expect(loader).toBeVisible();
  // under the loader, the headline has not started
  expect(await firstLetter(page)).toBeGreaterThan(10);
  await expect(loader).toHaveCount(0, { timeout: 8000 });
  await expect.poll(() => firstLetter(page), { timeout: 5000 }).toBe(0);
});

test('a later page in the same visit: no loader, not even for a frame', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ink-loader')).toHaveCount(0, { timeout: 8000 });
  await page.goto('/tarifler', { waitUntil: 'commit' });
  // decided by the inline script before the first paint
  await page.waitForFunction(() => document.body !== null);
  expect(await page.evaluate(() => document.documentElement.dataset.noloader)).toBe('1');
});

test('switching language plays the loader once more, in full', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ink-loader')).toHaveCount(0, { timeout: 8000 });
  await page.locator('header button[aria-haspopup="menu"]').click();
  await page.getByRole('menuitemradio', { name: /English/ }).click();
  await page.waitForURL(/\/en$/);
  await expect(page.locator('.ink-loader')).toBeVisible();
  await expect(page.locator('.ink-loader')).toHaveCount(0, { timeout: 8000 });
  await expect.poll(() => firstLetter(page), { timeout: 5000 }).toBe(0);
  // and a plain reload afterwards does not play it again
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => document.documentElement.dataset.noloader)).toBe('1');
});

test('the headline plays once: nothing moves it in the page while it rises', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('dm_loader_seen', '1');
    const w = window as unknown as { __moved: number };
    w.__moved = 0;
    // a removed-and-reinserted headline restarts its CSS animation from zero
    new MutationObserver((recs) => {
      for (const r of recs)
        for (const n of r.removedNodes)
          if (n instanceof Element && (n.matches('section, h1') || n.querySelector('.kin-unit')))
            w.__moved++;
    }).observe(document, { subtree: true, childList: true });
  });
  await page.goto('/');
  await expect.poll(() => firstLetter(page), { timeout: 6000 }).toBe(0);
  await page.waitForTimeout(1500); // GSAP has pinned the hero by now
  expect(await page.evaluate(() => (window as unknown as { __moved: number }).__moved)).toBe(0);
});

for (const [name, path] of [
  ['العربية', '/ar'],
  ['Français', '/fr'],
] as const) {
  test(`switching to ${path}: the loader plays through, without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('.ink-loader')).toHaveCount(0, { timeout: 8000 });
    await page.locator('header button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitemradio', { name: new RegExp(name) }).click();
    await page.waitForURL((u) => u.pathname === path);
    await expect(page.locator('.ink-loader')).toBeVisible();
    await expect(page.locator('.ink-loader')).toHaveCount(0, { timeout: 8000 });
    await expect.poll(() => firstLetter(page), { timeout: 5000 }).toBe(0);
    expect(errors).toEqual([]);
  });
}
