import { expect, test, type Page } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * The 3/6/12-month plan (a package with a first and a last day): the client watches it fill on
 * Today — by day, week or month — and the dietitian sees the very same numbers on the client's
 * page. Seed: the demo client Deniz started a six-month plan 47 days before the database was built.
 * Local demo backend only; nothing is changed.
 */

const DENIZ = '8c333d28-8e6c-5635-946c-1e3d9066554c';
const tp = tr.plan;

test.use({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Istanbul' });

/** the plan card's big counter ("48. gün / 183") */
const counter = (scope: ReturnType<Page['locator']>) =>
  scope
    .locator('.num-wide')
    .filter({ hasText: /\/\s*\d+$/ })
    .first();

test('the client sees their plan fill, and the dietitian sees the same', async ({ browser }) => {
  // --- the client, on Today ----------------------------------------------------------------------
  const clientCtx = await browser.newContext({ storageState: 'e2e/.auth/client.json' });
  const client = await clientCtx.newPage();
  await client.goto('/panel');
  const card = client.locator('#membership');
  await expect(card.getByRole('heading', { name: tr.portal.plan.title })).toBeVisible();
  await expect(card.getByText('6 aylık plan')).toBeVisible();
  const meter = card.getByRole('meter');
  await expect(meter).toHaveAttribute('aria-valuenow', /^(2[0-9]|3[0-9])$/); // ~26 % on day 48
  const byDay = (await counter(card).textContent())!.trim();
  expect(byDay).toMatch(/^4[7-9]\. gün \/ 18[1-4]$/);

  // by week, then by month: the counter and the segments follow
  await card.getByRole('radio', { name: tp.modes.week }).click();
  await expect(counter(card)).toHaveText(/^7\. hafta \/ 2[67]$/);
  await card.getByRole('radio', { name: tp.modes.month }).click();
  await expect(counter(card)).toHaveText('2. ay / 6');
  await expect(card.getByText(/^\d+ ay kaldı$/)).toHaveText('4 ay kaldı');
  // the choice is remembered on this device
  await client.reload();
  await expect(card.getByRole('radio', { name: tp.modes.month })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // the "Appointments & payments" page shows the plan in its package card
  await client.goto('/panel/care');
  await expect(client.getByRole('meter', { name: /Plan ilerlemesi/ })).toBeVisible();
  await clientCtx.close();

  // --- the dietitian, on the client's page: the same day of the same plan -----------------------
  const dietitian = await browser.newPage({ storageState: 'e2e/.auth/admin.json' });
  await dietitian.goto(`/admin/clients/${DENIZ}`);
  await expect(dietitian.getByText('6 aylık plan').first()).toBeVisible();
  await expect(dietitian.getByText(byDay)).toBeVisible();
  // and on the client's card in the list
  await dietitian.goto('/admin/clients');
  const deniz = dietitian
    .locator('a[href^="/admin/clients/"]')
    .filter({ hasText: 'Deniz Aksoy (demo)' })
    .first();
  await expect(deniz.getByText('6 aylık plan')).toBeVisible();
  await expect(deniz.getByText('2. ay / 6')).toBeVisible();
  await dietitian.close();
});

test('a new package can start a plan from a template', async ({ page }) => {
  await page.goto(`/admin/clients/${DENIZ}?tab=billing`);
  await page.getByRole('button', { name: tr.admin.billing.newPackage }).first().click();
  const sheet = page.getByRole('dialog', { name: tr.admin.billing.newPackage });
  await sheet.getByRole('radio', { name: '3 ay' }).click();
  await expect(sheet.getByLabel(tr.admin.billing.name)).toHaveValue('3 aylık plan');
  await expect(sheet.getByLabel(tr.admin.billing.sessions)).toHaveValue('');
  // the last day follows the first: 3 months on, minus a day
  const start = await sheet.getByLabel(tr.admin.billing.startsOn).inputValue();
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1 + 3, 1));
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), Math.min(d, last)));
  end.setUTCDate(end.getUTCDate() - 1);
  await expect(sheet.getByLabel(tr.admin.billing.endsOn)).toHaveValue(
    end.toISOString().slice(0, 10),
  );
  await expect(sheet.getByRole('radio', { name: '3 ay' })).toHaveAttribute('aria-checked', 'true');
  // not saved: the sandbox's plan stays as it was for the other tests
  await sheet.getByRole('button', { name: tr.admin.common.cancel }).click();
});
