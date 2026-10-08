import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

test('the wizard lead from the public project is in the inbox', async ({ page }) => {
  test.skip(!existsSync('e2e/.auth/lead.json'), 'run together with the public project');
  const { name } = JSON.parse(readFileSync('e2e/.auth/lead.json', 'utf8')) as { name: string };
  await page.goto('/admin/leads');
  // every status: the dashboard spec may already have marked it as contacted
  await page.getByRole('tab', { name: /^Tümü/ }).first().click(); // the status tabs come first
  await expect(page.getByText(name).first()).toBeVisible();
});

test('dashboard, settings and the CMS lists load for the signed-in dietitian', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of [
    '/admin',
    '/admin/clients',
    '/admin/recipes',
    '/admin/guides',
    '/admin/foods',
    '/admin/settings',
    '/admin/appointments',
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('the application from the public project: its details, then a client record', async ({
  page,
}) => {
  test.skip(!existsSync('e2e/.auth/application.json'), 'run together with the public project');
  const { name } = JSON.parse(readFileSync('e2e/.auth/application.json', 'utf8')) as {
    name: string;
  };
  const tl = tr.admin.leads;
  await page.goto('/admin/leads');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.getByRole('tab', { name: new RegExp(`^${tl.kinds.application}`) }).click();
  await page.getByText(name).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText(tl.app.durations.m6)).toBeVisible();
  await expect(sheet.getByText(tl.app.termsAccepted)).toBeVisible();
  await expect(sheet.getByText(tl.app.conditions.thyroid)).toBeVisible();
  await expect(sheet.getByText('170 cm')).toBeVisible();
  // converting carries the application into the record
  await sheet.getByRole('button', { name: tl.convert }).click();
  await expect(page).toHaveURL(/\/admin\/clients\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
});
