import { expect, test, type Page } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * Browser-like tabs in the panel (DESIGN.md v1.26): a tab is a place in the panel; "+" opens a
 * new one and offers every section on hover; tabs close, survive a reload and follow navigation.
 */

const nav = tr.admin.nav;
const tabsT = tr.admin.tabs;
const MERT = '6b2010b0-cd81-5359-9d4b-1e6ef7957fb4';

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}
const strip = (page: Page) => page.getByRole('tablist', { name: tabsT.label });
const names = (page: Page) =>
  strip(page)
    .getByRole('tab')
    .evaluateAll((els) => els.map((e) => e.getAttribute('title')));

test('tabs: open, navigate inside, switch, close, and keep after a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await open(page, '/admin');
  await page.evaluate(() => localStorage.removeItem('admin_tabs'));
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(strip(page).getByRole('tab')).toHaveCount(1);
  expect(await names(page)).toEqual([nav.dashboard]);

  // "+" opens a second tab on the overview; the sidebar then moves THAT tab
  await page.getByRole('button', { name: tabsT.new }).click();
  await expect(strip(page).getByRole('tab')).toHaveCount(2);
  await page.locator('[data-slot="sidebar"]').getByRole('link', { name: nav.payments }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await expect.poll(() => names(page)).toEqual([nav.dashboard, nav.payments]);

  // resting on "+" offers the sections: one click opens that section in a new tab
  await page.getByRole('button', { name: tabsT.new }).hover();
  const quick = page.locator('[data-radix-popper-content-wrapper]');
  await expect(quick.getByText(tabsT.quickOpen)).toBeVisible();
  await quick.getByRole('button', { name: nav.clients }).click();
  await expect(page).toHaveURL(/\/admin\/clients$/);
  await expect.poll(() => names(page)).toEqual([nav.dashboard, nav.payments, nav.clients]);

  // a page below a section takes its own title
  await page.goto(`/admin/clients/${MERT}`);
  await expect.poll(async () => (await names(page))[2]).toMatch(/Mert Kaya/);

  // switching tabs goes back to where that tab was
  await strip(page).getByRole('tab', { name: nav.payments }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await expect(strip(page).getByRole('tab', { name: nav.payments })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // kept after a reload
  await page.waitForTimeout(500);
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(strip(page).getByRole('tab')).toHaveCount(3);
  await expect(strip(page).getByRole('tab', { name: nav.payments })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // closing the active tab hands over to its neighbour
  await strip(page)
    .getByRole('tab', { name: nav.payments })
    .getByRole('button', { name: new RegExp(`^${tabsT.close}`) })
    .click();
  await expect(strip(page).getByRole('tab')).toHaveCount(2);
  await expect(page).toHaveURL(new RegExp(`/admin/clients/${MERT}`));

  // right-click: close the others
  await strip(page).getByRole('tab').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: tabsT.closeOthers }).click();
  await expect(strip(page).getByRole('tab')).toHaveCount(1);
  await expect(page).toHaveURL(/\/admin$/);

  // the "…" menu opens a tab too
  await page.getByRole('button', { name: tabsT.more }).click();
  await page.getByRole('menuitem', { name: tabsT.new }).click();
  await expect(strip(page).getByRole('tab')).toHaveCount(2);
  await page.getByRole('button', { name: tabsT.more }).click();
  await page.getByRole('menuitem', { name: tabsT.closeAll }).click();
  await expect(strip(page).getByRole('tab')).toHaveCount(1);

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
