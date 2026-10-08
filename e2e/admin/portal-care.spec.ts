import { expect, test, type Page } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * What the dietitian shares with the client (DESIGN.md v1.33): a task the client ticks and the
 * dietitian then sees as done; the client's appointments and package / payments, read-only.
 * Local demo backend only; the test removes what it adds.
 */

const td = tr.admin.dashboard;
const tb = tr.admin.billing;
const tc = tr.admin.common;
const hub = tr.portal.hub;
const care = tr.portal.care;
const DENIZ = '8c333d28-8e6c-5635-946c-1e3d9066554c'; // the demo client who uses the portal

test.use({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Istanbul' });

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

test('a shared task: the client ticks it, the dietitian sees it done', async ({
  page,
  browser,
}) => {
  page.on('dialog', (d) => d.accept());
  const title = `E2E danışan görevi ${Date.now()}`;
  const hidden = `E2E özel görev ${Date.now()}`;

  // the dietitian adds two tasks for the client: one shared, one for themselves
  await open(page, `/admin/clients/${DENIZ}`);
  const panel = page.locator('section').filter({
    has: page.getByRole('heading', { name: td.tasks.title, exact: true }),
  });
  await panel.getByPlaceholder(td.tasks.placeholder).fill(title);
  await panel.getByText(td.tasks.share, { exact: true }).click();
  await panel.getByRole('button', { name: td.tasks.add }).click();
  await expect(panel.getByText(title)).toBeVisible();
  await expect(panel.locator('li', { hasText: title }).getByText(td.tasks.shared)).toBeVisible();
  await panel.getByText(td.tasks.share, { exact: true }).click(); // off again
  await panel.getByPlaceholder(td.tasks.placeholder).fill(hidden);
  await panel.getByRole('button', { name: td.tasks.add }).click();
  await expect(panel.getByText(hidden)).toBeVisible();

  // the client sees only the shared one, and ticks it
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/client.json' });
  const client = await ctx.newPage();
  await client.goto('/panel');
  await expect(client.getByRole('heading', { name: hub.tasks.title })).toBeVisible();
  const box = client.getByRole('checkbox', { name: title });
  await expect(box).toHaveAttribute('aria-checked', 'false');
  await expect(client.getByText(hidden)).toHaveCount(0);
  await box.click();
  await expect(box).toHaveAttribute('aria-checked', 'true');
  await expect(client.getByText(hub.tasks.done)).toBeVisible();
  await client.reload();
  await expect(client.getByRole('checkbox', { name: title })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await ctx.close();

  // the dietitian finds it under "done" with the client's tick
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await panel.getByRole('button', { name: new RegExp(td.tasks.recentlyDone) }).click();
  const doneRow = panel.locator('li', { hasText: title });
  await expect(doneRow.getByText(td.tasks.sharedDone)).toBeVisible();

  // clean up both (a finished task is reopened first: only open rows carry the actions)
  await panel.getByRole('button', { name: td.tasks.markOpen.replace('{title}', title) }).click();
  for (const name of [title, hidden]) {
    const row = panel.locator('li', { hasText: name });
    await expect(row).toHaveCount(1); // the row leaving the "done" list has finished its exit
    await row.hover();
    await row.getByRole('button', { name: tc.delete, exact: true }).click();
    await expect(panel.locator('li', { hasText: name })).toHaveCount(0);
  }
});

test('the client sees their appointments and package, read-only', async ({ page, browser }) => {
  page.on('dialog', (d) => d.accept());
  const name = `E2E danışan paketi ${Date.now()}`;

  // a package with a price and one payment, recorded by the dietitian
  await open(page, `/admin/clients/${DENIZ}?tab=billing`);
  await page.getByRole('button', { name: tb.newPackage }).click();
  let sheet = page.getByRole('dialog');
  await sheet.getByLabel(tb.name).fill(name);
  await sheet.getByLabel(tb.sessions).fill('4');
  await sheet.getByLabel(tb.price).fill('2000');
  await sheet.getByRole('button', { name: tc.save }).click();
  await expect(sheet).toBeHidden();
  const card = page.locator('li', { hasText: name });
  await card.getByRole('button', { name: tb.takePayment }).click();
  sheet = page.getByRole('dialog');
  await sheet.getByLabel(tb.amount).fill('500');
  await sheet.getByRole('button', { name: tc.save }).click();
  await expect(sheet).toBeHidden();

  // the client: the package with what is paid and what is left; the payment in the list
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/client.json' });
  const client = await ctx.newPage();
  await client.goto('/panel/care');
  await expect(client.getByRole('heading', { level: 1, name: care.title })).toBeVisible();
  await expect(client.getByRole('heading', { name: care.upcoming })).toBeVisible();
  const pkg = client.locator('li', { hasText: name });
  await expect(pkg).toBeVisible();
  await expect(pkg.getByText('2.000 TL', { exact: true })).toBeVisible();
  await expect(pkg.getByText('500 TL', { exact: true })).toBeVisible();
  await expect(pkg.getByText('1.500 TL', { exact: true })).toBeVisible();
  await expect(client.getByRole('heading', { name: care.payments })).toBeVisible();
  // reachable from the sidebar and from Today
  await client.goto('/panel');
  await client
    .locator('[data-portal-rail]')
    .getByRole('link', { name: tr.portal.nav.care })
    .click();
  await expect(client).toHaveURL(/\/panel\/care$/);
  expect(
    await client.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await ctx.close();

  // clean up: the payment, then the package
  const ledger = page.locator('section', { hasText: tb.payments }).last();
  const payment = ledger.locator('li', { hasText: name });
  await payment.hover();
  await payment.getByRole('button', { name: tc.delete }).click();
  await expect(payment).toHaveCount(0);
  await card.getByRole('button', { name: tc.delete }).click();
  await expect(page.locator('li', { hasText: name })).toHaveCount(0);
});
