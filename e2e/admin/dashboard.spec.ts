import { expect, test, type Page } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/** Go to a panel page and wait until it answers clicks (React has hydrated it). */
async function open(page: import('@playwright/test').Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

/*
 * The dietitian's dashboard and client overview (DESIGN.md v1.13): today's agenda with one-tap
 * statuses, tasks, "needs attention", the goal board, the client overview and the measurement
 * comparison. Runs on the local demo backend only (global-setup refuses anything else).
 */

const td = tr.admin.dashboard;
const ov = tr.admin.clients.overview;
const DENIZ = '8c333d28-8e6c-5635-946c-1e3d9066554c'; // demo client with portal data

test.use({ timezoneId: 'Europe/Istanbul' });

function errorsOf(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()))
      errors.push(m.text().slice(0, 200));
  });
  return errors;
}

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, in the page's (Istanbul) time. */
function localInput(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
}

test('dashboard: the day at a glance, every panel present, no errors', async ({ page }) => {
  const errors = errorsOf(page);
  await open(page, '/admin');
  await expect(page.locator('h1')).toBeVisible();
  for (const title of [td.agenda.title, td.attention.title, td.tasks.title, td.goals.title])
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  // the hero's shortcuts: unread → messages, attention → the list on this page
  await expect(page.locator('a[href="/admin/messages"]').first()).toBeVisible();
  await expect(page.locator('a[href="#attention"]')).toBeVisible();
  // headline numbers draw their sparkline
  await expect(page.locator('main svg path[stroke="currentColor"]').first()).toBeVisible();
  // every "needs attention" row links into the client at the tab that resolves it
  const rows = page.locator('#attention li a[href*="/admin/clients/"]');
  const n = await rows.count();
  for (let i = 0; i < n; i++)
    expect(await rows.nth(i).getAttribute('href')).toMatch(
      /^\/admin\/clients\/[0-9a-f-]{36}\?tab=(messages|tracking|general|overview|measurements|appointments)$/,
    );
  expect(errors).toEqual([]);
});

test('agenda: an appointment that has started is marked "came" in one tap', async ({ page }) => {
  const now = new Date();
  const start = new Date(now.getTime() - 20 * 60_000);
  // the test needs the appointment on today's (Istanbul) calendar day
  test.skip(localInput(start).slice(0, 10) !== localInput(now).slice(0, 10), 'just after midnight');
  const title = `E2E randevu ${Date.now()}`;

  await open(page, '/admin/appointments?new=1');
  const sheet = page.getByRole('dialog');
  await sheet.locator('input[name="title"]').fill(title);
  await sheet.locator('input[name="starts_at"]').fill(localInput(start));
  await sheet.locator('select[name="kind"]').selectOption('online');
  await sheet.getByRole('button', { name: tr.admin.common.save }).click();
  await expect(sheet).toBeHidden();

  await open(page, '/admin');
  const row = page.locator('#agenda li').filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: td.agenda.came }).click();
  await expect(row.getByText(tr.admin.appointments.statuses.done)).toBeVisible();
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(
    page
      .locator('#agenda li')
      .filter({ hasText: title })
      .getByText(tr.admin.appointments.statuses.done),
  ).toBeVisible();

  // clean up through the calendar
  await open(page, '/admin/appointments');
  await page
    .getByRole('button', { name: new RegExp(title) })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: tr.admin.common.delete }).click();
  await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0);
});

test('tasks: add for a client with a due day, tick, untick, delete', async ({ page }) => {
  const errors = errorsOf(page);
  const title = `E2E görev ${Date.now()}`;
  await open(page, '/admin');
  const panel = page.locator('section').filter({
    has: page.getByRole('heading', { name: td.tasks.title, exact: true }),
  });
  await panel.getByPlaceholder(td.tasks.placeholder).fill(title);
  await panel.getByRole('button', { name: td.tasks.due.tomorrow, exact: true }).click();
  await panel
    .getByRole('combobox', { name: td.tasks.client })
    .selectOption({ label: 'Mert Kaya (demo)' });
  await panel.getByRole('button', { name: td.tasks.add }).click();

  const item = panel.locator('li').filter({ hasText: title });
  await expect(item).toBeVisible();
  await expect(item.getByText(td.tasks.due.tomorrow, { exact: true })).toBeVisible();
  await expect(item.getByRole('link', { name: 'Mert Kaya (demo)' })).toBeVisible();
  // saved: still there after a reload
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(panel.locator('li').filter({ hasText: title })).toBeVisible();

  // tick → it goes to "done in the last 24 hours"
  const markDone = td.tasks.markDone.replace('{title}', title);
  await panel.getByRole('button', { name: markDone }).click();
  await expect(panel.getByRole('button', { name: markDone })).toHaveCount(0, { timeout: 10_000 });
  await panel.getByRole('button', { name: new RegExp(td.tasks.recentlyDone) }).click();
  const reopen = td.tasks.markOpen.replace('{title}', title);
  await expect(panel.getByRole('button', { name: reopen })).toHaveAttribute('aria-pressed', 'true');
  // untick → open again
  await panel.getByRole('button', { name: reopen }).click();
  await expect(panel.getByRole('button', { name: markDone })).toBeVisible({ timeout: 10_000 });

  // the client's overview lists it too
  await open(page, '/admin/clients/6b2010b0-cd81-5359-9d4b-1e6ef7957fb4');
  await expect(page.getByText(title)).toBeVisible();

  // delete (from the client's overview)
  await page
    .locator('li')
    .filter({ hasText: title })
    .getByRole('button', { name: tr.admin.common.delete })
    .click();
  await expect(page.getByText(title)).toHaveCount(0);
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(page.getByText(title)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('client overview: journey, clinical indicators, four weeks, quick actions', async ({
  page,
}) => {
  const errors = errorsOf(page);
  await open(page, `/admin/clients/${DENIZ}`);
  // opens on the overview
  await expect(page.getByRole('tab', { name: tr.admin.clients.tabs.overview })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  for (const title of [ov.journey, ov.clinical, ov.adherence])
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  // demo: 166 cm; BMI of the latest weight, the BMI 18.5–24.9 range for that height
  await expect(page.getByText('51–68,6')).toBeVisible();
  await expect(page.getByText(ov.bmiCategories.normal)).toBeVisible();
  // 28 days of check-ins as a strip
  await expect(page.locator('ol[aria-label]:not([role="tablist"]) > li')).toHaveCount(28);
  // the reminder goes to WhatsApp with the client's number in international form
  const wa = page.getByRole('link', { name: ov.quick.whatsapp }).first();
  expect(await wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/905550000001/);

  // quick actions: measurement sheet; notes tab
  await page.getByRole('button', { name: ov.quick.measure }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: tr.admin.measurements.add }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: ov.quick.note }).click();
  await expect(
    page.getByRole('tab', { name: new RegExp(tr.admin.clients.tabs.notes) }),
  ).toHaveAttribute('aria-selected', 'true');
  expect(page.url()).toContain('tab=notes');
  expect(errors).toEqual([]);
});

test('measurements: compare two days and copy the summary', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, `/admin/clients/${DENIZ}?tab=measurements`);
  const tc = tr.admin.measurements.compare;
  await expect(page.getByRole('heading', { name: tc.title })).toBeVisible();
  // demo: first 71,4 kg, latest 66,6 kg
  const weight = page.locator('tr').filter({
    has: page.getByRole('rowheader', { name: tr.admin.measurements.weight, exact: true }),
  });
  await expect(weight.getByText(/^[−-]4,8$/)).toBeVisible();
  await page.getByRole('button', { name: tc.copy }).click();
  await expect(page.getByText(tc.copied)).toBeVisible();
  // Intl may write the minus as "−" (U+2212) or "-"
  const text = (await page.evaluate(() => navigator.clipboard.readText())).replace(/−/g, '-');
  expect(text).toContain(`${tr.admin.measurements.weight}: 71,4 → 66,6 (-4,8)`);
  // choosing another "before" day changes the difference
  const before = page.getByLabel(tc.from);
  await before.selectOption({ index: 1 });
  await expect(weight.getByText(/^[−-]4,8$/)).toHaveCount(0);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('a bottom dock reaches the daily places; nothing scrolls sideways', async ({ page }) => {
    const errors = errorsOf(page);
    await open(page, '/admin');
    const dock = page.getByRole('navigation', { name: tr.admin.nav.more });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole('link')).toHaveCount(4);
    await expect(dock.getByRole('link', { name: tr.admin.nav.dashboard })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // On a phone a page that is too wide does not scroll sideways — the browser zooms out and
    // the layout viewport grows (innerWidth > 390). Both widths must stay at the device's.
    for (const path of [
      '/admin',
      '/admin/clients',
      '/admin/appointments',
      '/admin/messages',
      `/admin/clients/${DENIZ}`,
      `/admin/clients/${DENIZ}?tab=measurements`,
      `/admin/clients/${DENIZ}?tab=tracking`,
      `/admin/clients/${DENIZ}?tab=general`,
    ]) {
      await open(page, path);
      await page.waitForTimeout(400);
      expect(
        await page.evaluate(() =>
          Math.max(window.innerWidth, document.documentElement.scrollWidth),
        ),
        path,
      ).toBeLessThanOrEqual(390);
    }
    await open(page, '/admin');
    await dock.getByRole('link', { name: tr.admin.nav.clients }).click();
    await expect(page).toHaveURL(/\/admin\/clients$/);
    await expect(dock.getByRole('link', { name: tr.admin.nav.clients })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // the full menu opens from the dock
    await dock.getByRole('button', { name: tr.admin.nav.more }).click();
    await expect(page.getByRole('link', { name: tr.admin.nav.settings })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('agenda cards keep the name readable on a phone', async ({ page }) => {
    await open(page, '/admin');
    // client names only (the WhatsApp "remind" link is a short button on purpose)
    const names = page.locator('#agenda li .font-semibold.truncate');
    const count = await names.count();
    for (let i = 0; i < count; i++) {
      const box = await names.nth(i).boundingBox();
      if (box) expect(box.width).toBeGreaterThan(120);
    }
  });
});

test('agenda: the week strip shows each day of the coming week', async ({ page }) => {
  await open(page, '/admin');
  const strip = page.locator('#agenda [role="tablist"]');
  await expect(strip.getByRole('tab')).toHaveCount(7);
  await expect(strip.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');
  await strip.getByRole('tab').nth(3).click();
  await expect(strip.getByRole('tab').nth(3)).toHaveAttribute('aria-selected', 'true');
  await expect(strip.getByRole('tab').first()).toHaveAttribute('aria-selected', 'false');
});

test('inbox: a client message is answered from the dashboard', async ({ page, browser }) => {
  const stamp = Date.now();
  // the demo client writes from the portal
  // signed in once by the setup project (portal logins are rate-limited)
  const ctx = await browser.newContext({ storageState: 'e2e/.auth/client.json' });
  const client = await ctx.newPage();
  await client.goto('/panel/messages');
  await client.getByLabel('Mesajını yaz…').fill(`E2E soru ${stamp}`);
  await client.getByRole('button', { name: 'Gönder' }).click();
  await expect(
    client.getByRole('list', { name: 'Mesajlar' }).getByText(`E2E soru ${stamp}`),
  ).toBeVisible();

  // the dietitian answers on the dashboard
  await open(page, '/admin');
  const inboxCard = page.locator('#inbox');
  const row = inboxCard.locator('li').filter({ hasText: `E2E soru ${stamp}` });
  // the portal shows a message as soon as it is sent, a moment before it is saved: the dashboard
  // is read again until the saved message is there
  await expect(async () => {
    if (!(await row.count())) await open(page, '/admin');
    await expect(row).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await row.getByRole('button', { name: td.inbox.reply }).click();
  await row.getByRole('textbox').fill(`E2E yanıt ${stamp}`);
  await row.getByRole('button', { name: td.inbox.send }).click();
  await expect(page.getByText(td.inbox.sent)).toBeVisible();
  await expect(inboxCard.locator('li').filter({ hasText: `E2E soru ${stamp}` })).toHaveCount(0);

  // the client reads it in the portal
  await client.reload();
  await expect(
    client.getByRole('list', { name: 'Mesajlar' }).getByText(`E2E yanıt ${stamp}`),
  ).toBeVisible();
  await ctx.close();
});

test('new leads: marking one as contacted takes it off the list', async ({ page }) => {
  await open(page, '/admin');
  const card = page.locator('section').filter({
    has: page.getByRole('heading', { name: new RegExp(td.leads.title) }),
  });
  // the lead the wizard spec (public project) has just sent; any new one when run alone
  const own = card.locator('li').filter({ hasText: 'E2E Sihirbaz' });
  const rows = (await own.count()) > 0 ? own : card.locator('li');
  test.skip((await rows.count()) === 0, 'no new leads to work with');
  const name = (await rows
    .first()
    .locator('span.truncate.font-semibold')
    .first()
    .textContent())!.trim();
  await rows.first().getByRole('button', { name: td.leads.contacted }).click();
  await expect(page.getByText(td.leads.updated)).toBeVisible();
  await expect(card.locator('li').filter({ hasText: name })).toHaveCount(0);
  // it is still on the leads page, as contacted
  await open(page, '/admin/leads');
  await page.getByRole('tab', { name: new RegExp(tr.admin.leads.statuses.contacted) }).click();
  await expect(page.getByText(name).first()).toBeVisible();
});

test('birthdays: the coming week, with wishes in the client’s language', async ({ page }) => {
  await open(page, '/admin');
  const card = page.locator('section').filter({
    has: page.getByRole('heading', { name: td.birthdays.title }),
  });
  await expect(card).toBeVisible();
  // demo data: Emre's birthday is two days after the demo database was built
  const row = card.locator('li').filter({ hasText: 'Emre Yıldız (demo)' });
  test.skip((await row.count()) === 0, 'demo database built more than a week ago');
  const wa = row.getByRole('link', { name: td.birthdays.congratulate });
  const href = (await wa.getAttribute('href'))!;
  expect(href).toMatch(/^https:\/\/wa\.me\/905550000002\?text=/);
  expect(decodeURIComponent(href.split('text=')[1]!)).toContain('Doğum günün kutlu olsun Emre');
});
