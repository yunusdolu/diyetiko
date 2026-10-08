import { expect, test as setup } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL ?? process.env.LOCAL_ADMIN_EMAIL ?? 'muzahim@local.test';
const password =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.LOCAL_ADMIN_PASSWORD ?? 'mutfak-demo-2026';

setup('log in once as the dietitian', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/admin');
  await expect(page.getByRole('navigation').first()).toBeVisible();
  // the first-visit card that offers the guide is answered once, so it never sits over a test
  await page.evaluate(() => localStorage.setItem('admin_tour_seen', '1'));
  await page.context().storageState({ path: 'e2e/.auth/admin.json' });
});

setup('log in once as the demo client', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/panel/login');
  await page
    .locator('input[name="email"]')
    .fill(process.env.LOCAL_CLIENT_EMAIL ?? 'danisan@local.test');
  await page
    .locator('input[name="password"]')
    .fill(process.env.LOCAL_CLIENT_PASSWORD ?? 'danisan-demo-2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/panel');
  await page.evaluate(() => localStorage.setItem('portal_tour_seen', '1'));
  await ctx.storageState({ path: 'e2e/.auth/client.json' });
  await ctx.close();
});
