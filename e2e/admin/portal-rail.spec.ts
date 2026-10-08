import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * The client portal's side rail (DESIGN.md v1.24): it narrows to an icon rail and back with the
 * dietitian panel's motion — the page follows the real width, labels fade in place, the arrow
 * beside the brand collapses and the one under the mark expands; remembered after a reload.
 */

const nav = tr.portal.nav;
test.use({ storageState: 'e2e/.auth/client.json', viewport: { width: 1440, height: 900 } });

test('the portal rail collapses, expands and is remembered', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto('/panel');
  const rail = page.locator('[data-portal-rail]');
  const main = page.locator('main#main');
  await expect(rail).toHaveAttribute('data-collapsed', 'false');
  const wide = (await main.boundingBox())!.width;
  const iconX = async () =>
    Math.round((await rail.locator('[data-slot="sidebar-item"] svg').first().boundingBox())!.x);

  await rail.getByRole('button', { name: nav.collapse }).click();
  await expect(rail).toHaveAttribute('data-collapsed', 'true');
  await expect.poll(async () => Math.round((await rail.boundingBox())!.width)).toBe(60);
  // the page took the room; the labels are gone but every destination still has a name
  expect((await main.boundingBox())!.width).toBeGreaterThan(wide + 150);
  await expect(rail.getByText(nav.program, { exact: true })).toBeHidden();
  await expect(rail.getByRole('link', { name: nav.program })).toBeVisible();
  // the icon sits in the middle of the rail
  await expect
    .poll(async () => {
      const icon = (await rail.locator('[data-slot="sidebar-item"] svg').first().boundingBox())!;
      return Math.abs(icon.x + icon.width / 2 - 30);
    })
    .toBeLessThanOrEqual(1);

  await page.reload();
  await expect(rail).toHaveAttribute('data-collapsed', 'true');
  const railX = await iconX();

  await rail.getByRole('button', { name: nav.expand }).click();
  await expect(rail).toHaveAttribute('data-collapsed', 'false');
  await expect.poll(async () => Math.round((await rail.boundingBox())!.width)).toBe(214);
  await expect(rail.getByText(nav.program, { exact: true })).toBeVisible();
  // icons sit in fixed cells: they do not move when the sidebar opens
  expect(Math.abs((await iconX()) - railX)).toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
