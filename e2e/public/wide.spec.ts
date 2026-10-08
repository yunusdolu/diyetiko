import { expect, test } from '@playwright/test';

/*
 * Wide screens and resizes: the pinned home sections (hero, example week) must always span the
 * window — no sideways scrollbar, no plate cut off (GSAP measures the pin inside our own
 * wrapper, components/site/home/hero.tsx).
 */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => sessionStorage.setItem('dm_loader_seen', '1'));
});

const width = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    window: window.innerWidth,
    hero: Math.round(document.querySelector('main section')!.getBoundingClientRect().width),
  }));

test('home on a wide screen, and after the window is resized', async ({ page }) => {
  await page.setViewportSize({ width: 1996, height: 1000 });
  await page.goto('/');
  await page.waitForTimeout(2000); // GSAP pins by now
  let w = await width(page);
  expect(w.page).toBe(w.window);
  expect(w.hero).toBe(w.window);
  for (const size of [1280, 2200]) {
    await page.setViewportSize({ width: size, height: 1000 });
    await page.waitForTimeout(1200);
    w = await width(page);
    expect(w.page, `${size}`).toBe(w.window);
    expect(w.hero, `${size}`).toBe(w.window);
  }
});
