import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * The client's Today page (DESIGN.md v1.32): the day's ring, the dietitian card — an answer typed
 * right there, the week sent as a note, the next meeting into the client's own calendar — and the
 * last seven days. Local demo backend only.
 */

const hub = tr.portal.hub;
test.use({ storageState: 'e2e/.auth/client.json', timezoneId: 'Europe/Istanbul' });

for (const [name, viewport] of [
  ['laptop', { width: 1366, height: 768 }],
  ['tablet', { width: 820, height: 1180 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test(`today on a ${name}: everything in place, nothing wider than the screen`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/client.json',
      viewport,
      timezoneId: 'Europe/Istanbul',
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto('/panel');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(hub.ring, { exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: hub.doorsLabel })).toBeVisible();
    await expect(page.getByText(hub.yourDietitian).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: hub.weekTitle })).toBeVisible();
    // seven days, each a way into its diary
    await expect(page.locator('ol a[href^="/panel/diary?day="]')).toHaveCount(7);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('a note typed on the Today page reaches the thread; the week goes as a summary', async ({
  page,
}) => {
  await page.goto('/panel');
  const note = `E2E bugün notu ${Date.now()}`;
  await page.getByLabel(hub.replyPlaceholder).fill(note);
  await page.getByRole('button', { name: hub.send, exact: true }).click();
  await expect(page.getByText(hub.sent)).toBeVisible();
  await expect(page.getByLabel(hub.replyPlaceholder)).toHaveValue('');

  await page.getByRole('button', { name: hub.sendWeek }).click();
  await expect(page.getByText(hub.weekSent)).toBeVisible();

  await page.goto('/panel/messages');
  await expect(page.getByText(note)).toBeVisible();
  // the summary names the week and counts the recorded days
  await expect(page.getByText(/Haftalık özetim \(/).last()).toBeVisible();
  await expect(page.getByText(/Kayıt tuttuğum gün: \d\/7/).last()).toBeVisible();
});

test('the next meeting downloads as a calendar file', async ({ page }) => {
  await page.goto('/panel');
  const add = page.getByRole('button', { name: hub.addToCalendar });
  test.skip(!(await add.count()), 'the demo client has no meeting ahead right now');
  const [download] = await Promise.all([page.waitForEvent('download'), add.click()]);
  expect(download.suggestedFilename()).toBe('randevu.ics');
  const stream = await download.createReadStream();
  let text = '';
  for await (const chunk of stream) text += chunk.toString();
  expect(text).toContain('BEGIN:VEVENT');
  expect(text).toMatch(/DTSTART:\d{8}T\d{6}Z/);
});
