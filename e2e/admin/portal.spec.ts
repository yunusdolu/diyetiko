import { expect, test, type Page } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * Client portal, end to end (local backend): the dietitian creates a client and an invite link,
 * the client sets a password + gives consent, logs water / a habit / a meal with a photo and
 * writes a message; the dietitian sees all of it, replies, closes access and finally deletes
 * the client (which also removes the photo and the login).
 */

const PASSWORD = 'e2e-portal-sifre-2026';
// contexts opened inside a test inherit the project's storageState (the dietitian) — start empty
const SIGNED_OUT = { storageState: { cookies: [], origins: [] } };

/** A real JPEG made by the browser (the upload path re-encodes and sniffs magic bytes). */
async function jpeg(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 240;
    const g = c.getContext('2d')!;
    g.fillStyle = '#d8f24a';
    g.fillRect(0, 0, 320, 240);
    g.fillStyle = '#ff5b36';
    g.beginPath();
    g.arc(160, 120, 70, 0, Math.PI * 2);
    g.fill();
    return c.toDataURL('image/jpeg', 0.9);
  });
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

test('invite → client logs their day → dietitian follows, replies, closes access, deletes', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now().toString(36);
  const name = `E2E Portal ${stamp}`;
  const email = `portal-${stamp}@example.com`;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`admin: ${e.message}`));

  // --- dietitian: new client + a habit goal + invite link ------------------------------------
  await page.goto('/admin/clients/new');
  await page.locator('input[name="full_name"]').fill(name);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="phone"]').fill('+905550000099');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await page.waitForURL(/\/admin\/clients\/[0-9a-f-]{36}$/);
  const clientUrl = new URL(page.url()).pathname;

  await page.goto(`${clientUrl}?tab=tracking`);
  await page.getByLabel('Yeni hedef').fill('Su iç');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Su iç', { exact: true })).toBeVisible();

  await page.goto(`${clientUrl}?tab=general`); // portal access + danger zone live on "Genel"
  await expect(page.getByText('Davet edilmedi')).toBeVisible();
  await page.getByRole('button', { name: 'Davet linki oluştur' }).click();
  const link = await page.locator('#portal-link').inputValue();
  expect(link).toMatch(/\/panel\/invite\/[A-Za-z0-9_-]{43}$/);
  const invitePath = new URL(link).pathname;

  // --- client: accept the invite -----------------------------------------------------------
  const ctx = await browser.newContext({
    ...SIGNED_OUT,
    locale: 'tr-TR',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const client = await ctx.newPage();
  client.on('pageerror', (e) => errors.push(`client: ${e.message}`));
  await client.goto(invitePath);
  await expect(client.getByText(email)).toBeVisible();
  await client.locator('input[name="password"]').fill(PASSWORD);
  await client.locator('input[name="confirm"]').fill(PASSWORD);
  await client.getByLabel(/açık rıza veriyorum/).check();
  await client.getByRole('button', { name: 'Hesabımı oluştur' }).click();
  await client.waitForURL((u) => u.pathname === '/panel');
  await expect(client.locator('h1')).toContainText('E2E');

  // the link works once
  const reuse = await browser.newContext(SIGNED_OUT);
  const reusePage = await reuse.newPage();
  await reusePage.goto(invitePath);
  await expect(
    reusePage.getByRole('heading', { name: 'Bu bağlantı geçersiz ya da süresi dolmuş.' }),
  ).toBeVisible();
  await reuse.close();

  // --- client: water + habit (autosave) ----------------------------------------------------
  await client.getByRole('button', { name: 'Bir bardak ekle' }).click();
  await client.getByRole('button', { name: 'Bir bardak ekle' }).click();
  await client.getByRole('button', { name: 'Su iç' }).click();
  await expect(client.getByRole('button', { name: 'Su iç' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(client.getByRole('status').filter({ hasText: 'Kaydedildi' })).toBeVisible({
    timeout: 10_000,
  });

  // --- client: diary — a food from the database + a photo --------------------------------
  await client.goto('/panel/diary');
  const breakfast = client.locator('section[aria-labelledby="slot-breakfast"]');
  await breakfast.getByRole('button', { name: 'Ekle', exact: true }).click();
  const sheet = client.getByRole('dialog');
  await sheet.getByRole('searchbox').fill('yumurta');
  await sheet
    .getByRole('button', { name: /^Yumurta/ })
    .first()
    .click();
  await sheet.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(breakfast.getByText('Yumurta', { exact: true })).toBeVisible();

  await breakfast
    .locator('input[type="file"]')
    .setInputFiles({ name: 'kahvalti.jpg', mimeType: 'image/jpeg', buffer: await jpeg(client) });
  await expect(breakfast.locator('img[src^="/api/portal/photo/"]')).toBeVisible({
    timeout: 20_000,
  });

  // --- client: message ----------------------------------------------------------------------
  await client.goto('/panel/messages');
  await client.getByLabel('Mesajını yaz…').fill(`Merhaba, e2e ${stamp}`);
  await client.getByRole('button', { name: 'Gönder' }).click();
  await expect(
    client.getByRole('list', { name: 'Mesajlar' }).getByText(`Merhaba, e2e ${stamp}`),
  ).toBeVisible();
  await expect(client.getByLabel('Mesajını yaz…')).toHaveValue('');

  // the client cannot open the dietitian panel
  await client.goto('/admin');
  await expect(client).toHaveURL(/\/panel$/);

  // --- dietitian: sees tracking, diary (with photo) and the message; replies ---------------
  await page.goto(`${clientUrl}?tab=tracking`);
  await expect(page.getByText('0,5 L').first()).toBeVisible();
  await page.goto(`${clientUrl}?tab=diary`);
  await expect(page.getByText('Yumurta').first()).toBeVisible();
  const photo = page.locator('img[src^="/api/admin/diary-photo/"]').first();
  await expect(photo).toBeVisible();
  // the <img> is visible before it has decoded: wait for real pixels
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0)), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  const photoSrc = (await photo.getAttribute('src'))!;

  await page.goto(`${clientUrl}?tab=messages`);
  await expect(page.getByText(`Merhaba, e2e ${stamp}`)).toBeVisible();
  await page.getByLabel('Yanıtını yaz…').fill(`Yanıt ${stamp}`);
  await page.getByRole('button', { name: 'Gönder' }).click();
  await expect(page.getByLabel('Yanıtını yaz…')).toHaveValue('');
  await expect(page.getByRole('list').getByText(`Yanıt ${stamp}`)).toBeVisible();

  await client.goto('/panel/messages');
  await expect(client.getByText(`Yanıt ${stamp}`)).toBeVisible();

  // --- dietitian: close access → the client is signed out of the portal ------------------
  await page.goto(`${clientUrl}?tab=general`); // portal access + danger zone live on "Genel"
  await expect(page.getByText('Aktif', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Panel erişimini kapat' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Panel erişimini kapat' }).click();
  await expect(page.getByText('Davet edilmedi')).toBeVisible();
  await client.goto('/panel');
  await expect(client).toHaveURL(/\/panel\/login/);

  // records stay with the practice after access is closed
  await page.goto(`${clientUrl}?tab=diary`);
  await expect(page.getByText('Yumurta').first()).toBeVisible();

  // --- cleanup: hard delete (also removes diary photos) ------------------------------------
  await page.goto(`${clientUrl}?tab=general`); // portal access + danger zone live on "Genel"
  await page.getByRole('button', { name: 'Kalıcı olarak sil' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('button', { name: 'Kalıcı olarak sil' }).click();
  await page.waitForURL((u) => u.pathname === '/admin/clients');
  expect((await page.request.get(photoSrc)).status()).toBe(404);

  await ctx.close();
  expect(errors).toEqual([]);
});

test('each side stays on its own surface', async ({ page, browser }) => {
  // the dietitian is sent from the client portal to the admin panel
  await page.goto('/panel');
  await expect(page).toHaveURL(/\/admin$/);
  // …but the clients' sign-in page itself opens for them, with a word about what signing in does
  await page.goto('/panel/login');
  await expect(page).toHaveURL(/\/panel\/login$/);
  await expect(page.getByText(tr.portal.auth.asDietitian)).toBeVisible();
  await page.getByRole('link', { name: tr.portal.auth.toAdmin }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // signed out: the portal asks for a login; a made-up invite is rejected
  const anon = await browser.newContext({ ...SIGNED_OUT, locale: 'tr-TR' });
  const p = await anon.newPage();
  await p.goto('/panel/diary');
  await expect(p).toHaveURL(/\/panel\/login/);
  await p.goto(`/panel/invite/${'x'.repeat(43)}`);
  await expect(
    p.getByRole('heading', { name: 'Bu bağlantı geçersiz ya da süresi dolmuş.' }),
  ).toBeVisible();
  const photo = await p.request.get('/api/portal/photo/00000000-0000-4000-8000-000000000000');
  expect(photo.status()).toBe(401);
  const exp = await p.request.get('/api/portal/export');
  expect(exp.status()).toBe(401);
  const adminPhoto = await p.request.get(
    '/api/admin/diary-photo/00000000-0000-4000-8000-000000000000',
  );
  expect(adminPhoto.status()).toBe(401);
  await anon.close();
});

test('every portal page fits a phone screen, in Turkish and in Arabic (RTL)', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({
    ...SIGNED_OUT,
    locale: 'tr-TR',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/panel/login');
  await page
    .locator('input[name="email"]')
    .fill(process.env.LOCAL_CLIENT_EMAIL ?? 'danisan@local.test');
  await page
    .locator('input[name="password"]')
    .fill(process.env.LOCAL_CLIENT_PASSWORD ?? 'danisan-demo-2026');
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((u) => u.pathname === '/panel');

  for (const locale of ['tr', 'ar'] as const) {
    await ctx.addCookies([
      { name: 'PORTAL_LOCALE', value: locale, url: new URL('/', page.url()).toString() },
    ]);
    for (const path of [
      '/panel',
      '/panel/program',
      '/panel/diary',
      '/panel/progress',
      '/panel/messages',
      '/panel/account',
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), `${locale} ${path}`).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      // with isMobile a too-wide page zooms out (innerWidth grows) instead of scrolling
      const overflow = await page.evaluate(
        (w) => Math.max(window.innerWidth, document.documentElement.scrollWidth) - w,
        page.viewportSize()!.width,
      );
      expect(overflow, `${locale} ${path} is wider than the screen`).toBeLessThanOrEqual(0);
    }
  }
  await ctx.close();
  expect(errors).toEqual([]);
});
