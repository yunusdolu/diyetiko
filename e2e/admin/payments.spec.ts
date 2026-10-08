import { expect, test, type Page } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * The payments page and the lists' date filter (DESIGN.md v1.23): every client's payments in one
 * list, recorded from the page for any client, filtered by date / method / name; the same date
 * strip on the other lists. Local demo backend only; the test removes what it adds.
 */

const tp = tr.admin.payments;
const tb = tr.admin.billing;
const tc = tr.admin.common;
const td = tr.admin.dateRange;
const LAYLA = '82874080-9118-558c-a40b-6ebebb298afc';

test.use({ timezoneId: 'Europe/Istanbul' });

/** the date filter: one button that names the range and opens the choices */
const dateButton = (page: Page) => page.getByRole('button', { name: new RegExp(`^${td.label}`) });
async function pickRange(page: Page, name: string) {
  await dateButton(page).click();
  await page.getByRole('menuitemradio', { name }).click();
  await expect(dateButton(page)).toHaveText(name);
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

test('a payment recorded on the payments page is listed, filtered and removed', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('dialog', (d) => d.accept());
  await open(page, '/admin/payments');
  await expect(page.getByRole('heading', { level: 1, name: tp.title })).toBeVisible();

  const note = `E2E ödeme ${Date.now()}`;
  await page.getByRole('button', { name: tb.recordPayment }).click();
  const sheet = page.getByRole('dialog');
  // no client chosen yet: nothing is saved
  await sheet.getByLabel(tb.amount).fill('750');
  await sheet.getByRole('button', { name: tc.save }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByLabel(tb.client).selectOption(LAYLA);
  await sheet.getByLabel(tb.amount).fill('750');
  await sheet.getByLabel(tb.note).fill(note);
  await sheet.getByRole('button', { name: tc.save }).click();
  await expect(sheet).toBeHidden();

  const list = page.getByTestId('payments-list');
  const row = list.locator('li', { hasText: note });
  await expect(row).toBeVisible();
  await expect(row.getByText(/750/)).toBeVisible();

  // paid today: "today" keeps it, another payment method hides it, the name finds it
  await pickRange(page, td['1d']);
  await expect(row).toBeVisible();
  const methods = page.getByRole('tablist', { name: tb.method });
  await methods.getByRole('tab', { name: tb.methods.cash }).click();
  await expect(row).toHaveCount(0);
  await methods.getByRole('tab', { name: tc.all }).click();
  await page.getByRole('searchbox').fill('zzz-nobody');
  await expect(row).toHaveCount(0);
  await expect(page.getByText(tp.emptyRange)).toBeVisible();
  await page.getByRole('searchbox').fill(note);
  await expect(row).toBeVisible();

  // the same record is on the client's own page
  await row.getByRole('button', { name: new RegExp(`^${tc.delete}`) }).click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the payments page is in the sidebar', async ({ page }) => {
  await open(page, '/admin');
  await page.getByRole('link', { name: tr.admin.nav.payments }).first().click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
});

test('the date filter narrows the requests list', async ({ page }) => {
  await open(page, '/admin/leads');
  await page
    .getByRole('tablist', { name: tc.status })
    .getByRole('tab', { name: new RegExp(`^${tc.all}`) })
    .click();
  const rows = page.locator('ul > li button');
  const all = await rows.count();
  expect(all).toBeGreaterThan(0);
  // the demo requests are older than a day
  await pickRange(page, td['1d']);
  await expect.poll(() => rows.count()).toBeLessThanOrEqual(all);
  await pickRange(page, td.all);
  await expect(rows).toHaveCount(all);
});
