import { expect, test } from '@playwright/test';

// No stored session here: the public project runs signed out.

for (const path of ['/admin', '/admin/clients', '/admin/programs', '/admin/settings']) {
  test(`${path} redirects to login when signed out`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
}

test('admin API routes refuse anonymous requests', async ({ request }) => {
  for (const path of [
    '/api/admin/export/clients',
    '/api/admin/files/00000000-0000-0000-0000-000000000000',
  ]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect([401, 403, 307, 302]).toContain(res.status());
    expect(await res.text()).not.toContain('@');
  }
});

test('admin pages carry a strict nonce CSP and are not frameable', async ({ request }) => {
  const res = await request.get('/admin/login');
  const csp = res.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/script-src[^;]*'nonce-/);
  expect(csp).toContain("frame-ancestors 'none'");
});
