import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * The site's prompts (components/site/prompts.ts), from a clean browser: the cookie choice after
 * the loader, reopenable from the footer; the programme invitation once the visitor has read
 * most of a page, snoozed by "later" and never on the application itself.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => sessionStorage.setItem('dm_loader_seen', '1'));
});

test('cookie choice: reject is as easy as accept, remembered, and can be reopened', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const banner = page.getByRole('region', { name: tr.cookies.title });
  await expect(banner).toBeVisible({ timeout: 8000 });
  await banner.getByRole('button', { name: tr.cookies.reject }).click();
  await expect(banner).toBeHidden();
  await expect
    .poll(async () => (await context.cookies()).find((c) => c.name === 'dm_consent')?.value)
    .toBe('rejected');

  // not asked again on the next page…
  await page.goto('/tarifler');
  await page.waitForTimeout(2500);
  await expect(banner).toBeHidden();
  // …until the visitor asks for it
  await page.locator('footer').getByRole('button', { name: tr.cookies.settings }).click();
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: tr.cookies.accept }).click();
  await expect
    .poll(async () => (await context.cookies()).find((c) => c.name === 'dm_consent')?.value)
    .toBe('accepted');
});

test('the programme invitation: after reading, "later" snoozes it', async ({ page, context }) => {
  await context.addCookies([
    { name: 'dm_consent', value: 'rejected', url: 'http://localhost:3000' },
  ]);
  await page.goto('/');
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.7));
  const dialog = page.getByRole('dialog', { name: tr.applyPrompt.title });
  await expect(dialog).toBeVisible({ timeout: 8000 });
  await expect(dialog.getByText(tr.applyPrompt.points.minimum.title)).toBeVisible();
  await dialog.getByRole('button', { name: tr.applyPrompt.later }).click();
  await expect(dialog).toBeHidden();
  // snoozed: not again on the next page
  await page.goto('/tarifler');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  await expect(dialog).toHaveCount(0);
});

test('no invitation on the application page itself', async ({ page, context }) => {
  await context.addCookies([
    { name: 'dm_consent', value: 'rejected', url: 'http://localhost:3000' },
  ]);
  await page.goto('/basvuru');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
