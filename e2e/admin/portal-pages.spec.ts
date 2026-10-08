import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * The client portal's added pages (DESIGN.md v1.35): the weekly summary, the files exchanged with
 * the dietitian, the programme as a shopping list — and the card that offers the guide on a first
 * visit. Local demo backend only; nothing here writes to the database.
 */

const p = tr.portal;
test.use({ storageState: 'e2e/.auth/client.json', timezoneId: 'Europe/Istanbul' });

test('the sidebar leads to the new pages; each fits the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/panel');
  const rail = page.locator('[data-portal-rail]');
  for (const [key, path, title] of [
    ['week', '/panel/week', p.week.title],
    ['files', '/panel/files', p.files.title],
    ['shopping', '/panel/shopping', p.shopping.title],
  ] as const) {
    await rail.getByRole('link', { name: p.nav[key], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  }
  // the site's tools open in the client's language
  await expect(rail.getByRole('link', { name: p.nav.calc, exact: true })).toHaveAttribute(
    'href',
    /\/(tr\/)?(araclar|tools)/,
  );
});

test('the weekly summary counts the last seven days', async ({ page }) => {
  await page.goto('/panel/week');
  await expect(page.getByText(p.week.stats.days, { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d\/7$/).first()).toBeVisible();
  // seven rows, each a way into that day's diary
  await expect(page.locator('tbody tr')).toHaveCount(7);
  await expect(page.locator('tbody a[href^="/panel/diary?day="]')).toHaveCount(7);
});

test('the shopping list: days narrow it, ticks are remembered', async ({ page }) => {
  await page.goto('/panel/shopping');
  const items = page.getByRole('checkbox');
  const all = await items.count();
  expect(all).toBeGreaterThan(3);
  const first = items.first();
  await first.click();
  await expect(first).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'true');
  // one day only: a shorter list
  const days = page.getByRole('group', { name: p.shopping.days }).getByRole('button');
  const n = await days.count();
  for (let i = 1; i < n; i++) await days.nth(i).click();
  await expect.poll(() => page.getByRole('checkbox').count()).toBeLessThan(all);
  await page.getByRole('button', { name: p.shopping.clear }).click();
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);
});

test('a first visit is offered the guide once; the offer does not block the page', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: 'e2e/.auth/client.json',
    viewport: { width: 1280, height: 800 },
  });
  // a browser that has not answered yet
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('reset')) {
      localStorage.removeItem('portal_tour_seen');
      sessionStorage.setItem('reset', '1');
    }
  });
  const page = await ctx.newPage();
  await page.goto('/panel');
  const card = page.locator('[data-first-run]');
  await expect(card).toBeVisible();
  await expect(card).toContainText(p.help.tour.title);
  // the page under it stays usable
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await card.getByRole('link', { name: p.help.tour.start }).click();
  await expect(page).toHaveURL(/\/panel\/help$/);
  await page.goto('/panel');
  await page.waitForTimeout(2200);
  await expect(page.locator('[data-first-run]')).toHaveCount(0);
  await ctx.close();
});
