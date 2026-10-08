import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * Programme application (/basvuru): at least three months (the one-month card exists only to say
 * there is none), four steps that refuse to move on with a gap, explicit consent for health data,
 * and the application waiting in the panel (checked by the admin project, see leads.spec.ts).
 */
const ta = tr.apply;

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => sessionStorage.setItem('dm_loader_seen', '1'));
});

test('the application: four steps, the 3-month rule, consent — then thanks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/basvuru');
  await expect(page.getByText(ta.rule.title)).toBeVisible();
  // the one-month option is shown crossed out, not offered
  await expect(page.getByText(ta.noMonth)).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${ta.durations.m1}`) })).toHaveCount(
    0,
  );

  // a gap keeps you on the step
  await page.getByRole('button', { name: ta.next }).click();
  await expect(page.getByText(tr.form.errors.required).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: ta.programme.title })).toBeVisible();

  await page.getByRole('button', { name: new RegExp(`^${ta.durations.m6}`) }).click();
  await page.getByRole('button', { name: ta.formats.online, exact: true }).click();
  await page.getByRole('button', { name: ta.starts.asap, exact: true }).click();
  await page.getByRole('button', { name: ta.next }).click();

  await expect(page.getByRole('heading', { name: ta.about.title })).toBeVisible();
  await page.getByRole('radio', { name: ta.goals.weight_down }).click();
  await page.getByLabel(ta.about.height).fill('170');
  await page.getByLabel(ta.about.weight).fill('900'); // out of range: stays here
  await page.getByRole('button', { name: ta.next }).click();
  await expect(page.getByText(tr.form.errors.range)).toBeVisible();
  await page.getByLabel(ta.about.weight).fill('82');
  await page.getByRole('button', { name: ta.next }).click();

  await expect(page.getByRole('heading', { name: ta.health.title })).toBeVisible();
  await page.getByRole('button', { name: ta.conditions.thyroid }).click();
  await page.getByRole('button', { name: ta.next }).click();

  await expect(page.getByRole('heading', { name: ta.contact.title })).toBeVisible();
  // what will be sent, before sending
  await expect(
    page.getByText(`${ta.durations.m6} · ${ta.formats.online} · ${ta.starts.asap}`),
  ).toBeVisible();
  await expect(page.getByText(ta.conditions.thyroid)).toBeVisible();
  const name = `E2E Başvuru ${Date.now()}`;
  await page.getByLabel(tr.form.name).fill(name);
  await page.getByLabel(tr.form.phone).fill('0555 000 00 77');
  // both confirmations are required
  await page.getByRole('button', { name: ta.send }).click();
  await expect(page.getByText(tr.form.errors.terms)).toBeVisible();
  await expect(page.getByText(tr.form.errors.consent)).toBeVisible();
  await page.getByLabel(ta.contact.terms).check();
  await page.getByLabel(ta.contact.consent).check();
  await page.getByRole('button', { name: ta.send }).click();

  await expect(
    page.getByRole('status').filter({ hasText: ta.sent.title.replace('{name}', 'E2E') }),
  ).toBeVisible();
  mkdirSync('e2e/.auth', { recursive: true });
  writeFileSync('e2e/.auth/application.json', JSON.stringify({ name }));
  expect(errors).toEqual([]);
});

test('apply is reachable from the header, the home page and the footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header').getByRole('link', { name: tr.nav.apply })).toBeVisible();
  const band = page.locator('section[aria-labelledby="apply-title"]');
  await band.scrollIntoViewIfNeeded();
  await expect(band.getByRole('heading', { name: tr.home.apply.title })).toBeVisible();
  // sign-in for clients and the dietitian, without typing an address
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: tr.footer.clientLogin })).toHaveAttribute(
    'href',
    '/panel/login',
  );
  await expect(footer.getByRole('link', { name: tr.footer.dietitianLogin })).toHaveAttribute(
    'href',
    '/admin/login',
  );
  await band.getByRole('link', { name: tr.home.apply.cta }).click();
  await expect(page).toHaveURL(/\/basvuru$/);
});
