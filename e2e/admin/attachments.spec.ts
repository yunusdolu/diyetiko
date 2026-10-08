import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * Files in messages and movement in the check-in (DESIGN.md v1.31): the client sends a lab report
 * as a PDF from the portal; the dietitian sees it on the messages page, opens it, answers with a
 * file of their own, and finds both in the client's file. Local demo backend only.
 */

const pm = tr.portal.messages;
const am = tr.admin.portal.messages;
const DENIZ = 'Deniz Aksoy (demo)';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n');
// a 1×1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.use({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Istanbul' });

test('a client sends a PDF; the dietitian opens it, answers with a file, and both are on file', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const clientCtx = await browser.newContext({ storageState: 'e2e/.auth/client.json' });
  const client = await clientCtx.newPage();
  const stamp = Date.now();
  const note = `E2E tahlil notu ${stamp}`;
  const pdfName = `tahlil-${stamp}.pdf`;

  // --- the client: something that is not a PDF or a picture is refused by the server ----------
  await client.goto('/panel/messages');
  await client.locator('input[type="file"]').setInputFiles({
    name: 'sahte.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('MZ not a pdf'),
  });
  await client.getByRole('button', { name: pm.send }).click();
  await expect(client.getByText(pm.fileType)).toBeVisible();
  await client.getByRole('button', { name: pm.removeFile }).click();

  // --- the client sends the report with a note --------------------------------------------------
  await client
    .locator('input[type="file"]')
    .setInputFiles({ name: pdfName, mimeType: 'application/pdf', buffer: PDF });
  await client.getByLabel(pm.placeholder).fill(note);
  await client.getByRole('button', { name: pm.send }).click();
  const sent = client.getByRole('link', { name: new RegExp(pdfName) }).first();
  await expect(sent).toBeVisible();
  await expect(client.getByText(note)).toBeVisible();
  // their own file opens for them
  const own = await client.request.get((await sent.getAttribute('href'))!);
  expect(own.status()).toBe(200);
  expect(own.headers()['content-type']).toBe('application/pdf');

  // --- the dietitian: the thread shows it, unread, with a paperclip -----------------------------
  await page.goto('/admin/messages');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page
    .getByRole('link', { name: new RegExp(DENIZ.replace(/[()]/g, '\\$&')) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/messages\?c=/);
  const file = page.getByRole('link', { name: new RegExp(pdfName) }).first();
  await expect(file).toBeVisible();
  await expect(page.getByText(note).first()).toBeVisible();
  const href = (await file.getAttribute('href'))!;
  const opened = await page.request.get(href);
  expect(opened.status()).toBe(200);
  expect(opened.headers()['content-type']).toBe('application/pdf');
  expect(opened.headers()['x-content-type-options']).toBe('nosniff');

  // nobody else gets it: the client cannot use the dietitian's route, a stranger gets nothing
  expect((await client.request.get(href)).status()).toBe(401);
  const stranger = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  expect((await stranger.request.get(`http://localhost:3000${href}`)).status()).toBe(401);
  await stranger.close();

  // --- the dietitian answers with a picture -----------------------------------------------------
  const reply = `E2E yanıt ${stamp}`;
  const pngName = `plan-${stamp}.png`;
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: pngName, mimeType: 'image/png', buffer: PNG });
  await page.getByLabel(am.placeholder).fill(reply);
  await page.getByRole('button', { name: am.send }).click();
  await expect(page.getByRole('link', { name: new RegExp(pngName) }).first()).toBeVisible();

  // both files are in the client's file, under "files"
  const clientId = new URL(page.url()).searchParams.get('c')!;
  await page.goto(`/admin/clients/${clientId}?tab=files`);
  await expect(page.getByText(tr.admin.files.shared.title)).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(pdfName) })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(pngName) })).toBeVisible();

  // --- the client sees the answer ---------------------------------------------------------------
  await client.reload();
  await expect(client.getByText(reply)).toBeVisible();
  await expect(client.getByRole('link', { name: new RegExp(pngName) }).first()).toBeVisible();
  expect(errors).toEqual([]);
  await clientCtx.close();
});

test('the client records the day’s movement; the dietitian sees it under tracking', async ({
  page,
  browser,
}) => {
  const pt = tr.portal.today;
  const clientCtx = await browser.newContext({ storageState: 'e2e/.auth/client.json' });
  const client = await clientCtx.newPage();
  await client.goto('/panel');
  const minutes = client.getByRole('radio', { name: pt.activityMin.replace('{n}', '45') });
  if ((await minutes.getAttribute('aria-checked')) !== 'true') await minutes.click();
  const kind = client.getByRole('radio', { name: pt.activityKinds[0]!, exact: true });
  if ((await kind.getAttribute('aria-checked')) !== 'true') await kind.click();
  // autosaved: still there after a reload
  await client.waitForTimeout(1500);
  await client.reload();
  await expect(
    client.getByRole('radio', { name: pt.activityMin.replace('{n}', '45') }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(
    client.getByRole('radio', { name: pt.activityKinds[0]!, exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await clientCtx.close();

  await page.goto('/admin/messages');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page
    .getByRole('link', { name: new RegExp(DENIZ.replace(/[()]/g, '\\$&')) })
    .first()
    .click();
  await page.getByRole('link', { name: am.tabs.tracking, exact: true }).click();
  await expect(page).toHaveURL(/tab=tracking/);
  await expect(
    page.getByRole('cell', { name: new RegExp(`45 dk · ${pt.activityKinds[0]}`) }).first(),
  ).toBeVisible();
});
