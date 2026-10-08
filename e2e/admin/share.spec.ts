import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

// Seeded demo program (scripts/gen-seed.ts → uid('program:c1')).
const PROGRAM = '/admin/programs/754274d3-6afe-5580-b37e-880bc48c494f';
const PROGRAM_TITLE = 'Eylül — düzenli öğünler';

test('share link: create → open signed out → revoke → gone', async ({ page, browser }) => {
  await page.goto(PROGRAM);
  await page.getByRole('button', { name: tr.admin.share.title }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();

  // No client name by default (privacy); create a fresh link and wait for it to be prepended.
  const rows = sheet.locator('li');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  await sheet.getByRole('button', { name: tr.admin.share.create }).click();
  await expect(rows).toHaveCount(before + 1);
  const newest = rows.first();
  const urlEl = newest.locator('p[dir="ltr"]');
  await expect(urlEl).toHaveAttribute('title', /\/p\/[A-Za-z0-9_-]{43,}$/);
  const url = (await urlEl.getAttribute('title'))!;
  const token = url.split('/p/')[1]!;
  expect(token.length).toBeGreaterThanOrEqual(43); // ≥ 32 random bytes, base64url

  // Open it in a clean, signed-out context.
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const visitor = await anon.newPage();
  const res = await visitor.goto(`/p/${token}`);
  expect(res?.status()).toBe(200);
  await expect(visitor.getByRole('heading', { name: PROGRAM_TITLE })).toBeVisible();
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  // Sanitised DTO: none of the seeded client's private fields may reach the share page.
  const html = await visitor.content();
  for (const secret of [
    'Aksoy',
    '5550000001',
    'deniz.demo@example.com',
    'Demo tıbbi not',
    'Laktoz',
  ]) {
    expect(html, secret).not.toContain(secret);
  }

  // Revoke from the sheet → the same URL is a 404.
  await newest.getByRole('button', { name: tr.admin.share.revoke }).click();
  await expect(newest.getByText(tr.admin.share.revokedAt.split(':')[0]!)).toBeVisible();
  const after = await visitor.goto(`/p/${token}`);
  expect(after?.status()).toBe(404);
  await anon.close();
});

test('a malformed token is a 404, not an error', async ({ browser }) => {
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await anon.newPage();
  const res = await page.goto('/p/not-a-real-token');
  expect(res?.status()).toBe(404);
  await anon.close();
});
