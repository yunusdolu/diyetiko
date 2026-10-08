import { expect, test, type Page } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * Running the practice (DESIGN.md v1.16): session packages that count down with attended
 * appointments, payments and what is still owed, lab results against the lab's own range, the
 * dashboard's revenue card and the printable progress report. Local demo backend only; every
 * test removes what it adds.
 */

const tb = tr.admin.billing;
const tl = tr.admin.labs;
const tc = tr.admin.common;
const MERT = '6b2010b0-cd81-5359-9d4b-1e6ef7957fb4'; // demo: 3 of 4 sessions attended, two lab reports
const LAYLA = '82874080-9118-558c-a40b-6ebebb298afc';

test.use({ timezoneId: 'Europe/Istanbul' });

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

function errorsOf(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()))
      errors.push(m.text().slice(0, 200));
  });
  return errors;
}

test('a package counts attended sessions down by itself', async ({ page }) => {
  const errors = errorsOf(page);
  await open(page, `/admin/clients/${MERT}?tab=billing`);
  const card = page.locator('li', { hasText: '4 seanslık takip (demo)' }).first();
  await expect(card.getByText('3/4 seans')).toBeVisible();
  await expect(card.getByText(tb.state.ending)).toBeVisible();
  await expect(page.getByText('1 seans kaldı').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('a new package, a payment against it, and what is left to pay', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await open(page, `/admin/clients/${LAYLA}?tab=billing`);
  const name = `E2E paket ${Date.now()}`;

  await page.getByRole('button', { name: tb.newPackage }).click();
  let sheet = page.getByRole('dialog');
  await sheet.getByLabel(tb.name).fill(name);
  await sheet.getByLabel(tb.sessions).fill('2');
  // typed the Turkish way
  await sheet.getByLabel(tb.price).fill('1.500,50');
  await sheet.getByRole('button', { name: tc.save }).click();
  await expect(sheet).toBeHidden();

  const card = page.locator('li', { hasText: name });
  await expect(card.getByText('0/2 seans')).toBeVisible();
  await expect(card.getByText(/1\.500,50/).first()).toBeVisible();

  // "take payment" opens with the package and the amount still owed filled in
  await card.getByRole('button', { name: tb.takePayment }).click();
  sheet = page.getByRole('dialog');
  await expect(sheet.getByLabel(tb.amount)).toHaveValue('1500.5');
  await sheet.getByLabel(tb.amount).fill('500');
  await sheet.getByRole('button', { name: tc.save }).click();
  await expect(sheet).toBeHidden();
  await expect(card.getByText(/1\.000,50/)).toBeVisible();
  const ledger = page.locator('section', { hasText: tb.payments }).last();
  const payment = ledger.locator('li', { hasText: name });
  await expect(payment).toBeVisible();

  // clean up: the payment, then the package
  await payment.hover();
  await payment.getByRole('button', { name: tc.delete }).click();
  await expect(payment).toHaveCount(0);
  await card.getByRole('button', { name: tc.delete }).click();
  await expect(page.locator('li', { hasText: name })).toHaveCount(0);
});

test('lab results: a value above the lab’s range is flagged, and can be removed', async ({
  page,
}) => {
  page.on('dialog', (d) => d.accept());
  await open(page, `/admin/clients/${LAYLA}?tab=labs`);
  await page.getByRole('button', { name: tl.add }).click();
  const sheet = page.getByRole('dialog');
  const test = tl.tests.vitamin_b12;
  await sheet.getByLabel(`${test} · ${tl.value}`).fill('950');
  await expect(sheet.getByLabel(`${test} · ${tl.unit}`)).toHaveValue('pg/mL');
  await sheet.getByLabel(`${test} · ${tl.refLow}`).fill('200');
  await sheet.getByLabel(`${test} · ${tl.refHigh}`).fill('900');
  await expect(sheet.getByText('1 değer kaydedilecek')).toBeVisible();
  await sheet.getByRole('button', { name: tc.save }).click();
  await expect(sheet).toBeHidden();

  const card = page.locator('li', { hasText: test }).first();
  await expect(card.getByText(tl.flag.high)).toBeVisible();
  await expect(page.getByText('1 değer aralık dışında')).toBeVisible();

  await card.getByRole('button', { name: /1 sonuç/ }).click();
  await card.getByRole('button', { name: tc.delete }).click();
  await expect(page.locator('li', { hasText: test })).toHaveCount(0);
});

test('the dashboard lists packages to talk about', async ({ page }) => {
  await open(page, '/admin');
  const money = page.locator('#money');
  await expect(money.getByText(tr.admin.dashboard.money.title)).toBeVisible();
  const mert = money.getByRole('link', { name: /Mert Kaya \(demo\)/ });
  await expect(mert).toContainText(tr.admin.dashboard.money.reason.ending);
  await mert.click();
  await expect(page).toHaveURL(new RegExp(`/admin/clients/${MERT}\\?tab=billing`));
});

test('the progress report: the client’s language, weights, lab values', async ({ page }) => {
  const errors = errorsOf(page);
  // outside the panel shell (no sidebar): a plain page load
  await page.goto(`/admin/report/${MERT}`);
  await expect(page.getByText(tr.admin.report.title)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mert Kaya (demo)' })).toBeVisible();
  await expect(page.getByRole('cell', { name: tl.tests.glucose_fasting })).toBeVisible();
  await expect(page.getByRole('button', { name: tr.admin.report.print })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a weekly check-in series is booked in one go', async ({ page }) => {
  const ta = tr.admin.appointments;
  await open(page, `/admin/clients/${LAYLA}?tab=appointments`);
  await page.getByRole('button', { name: ta.new }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel(ta.when).fill('2027-03-01T10:00');
  await sheet.getByLabel(ta.repeat.label).selectOption('7');
  await sheet.getByLabel(ta.repeat.count).fill('3');
  await expect(sheet.getByText('Toplam 3 randevu oluşturulacak')).toBeVisible();
  await sheet.getByRole('button', { name: tc.save }).click();
  await expect(sheet).toBeHidden();

  const days = ['1 Mar 2027', '8 Mar 2027', '15 Mar 2027'];
  for (const d of days)
    await expect(page.getByRole('button', { name: new RegExp(`${d} 10:00`) })).toBeVisible();
  // clean up
  for (const d of days) {
    await page.getByRole('button', { name: new RegExp(`${d} 10:00`) }).click();
    await page.getByRole('dialog').getByRole('button', { name: tc.delete }).click();
    await expect(page.getByRole('button', { name: new RegExp(`${d} 10:00`) })).toHaveCount(0);
  }
});
