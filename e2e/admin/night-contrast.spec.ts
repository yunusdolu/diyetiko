import { expect, test, type Locator } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };
import { BASE_URL } from '../base';

/*
 * The panel's night theme repaints shared parts built for the site's light surfaces. Two of them
 * once kept their day colours: the underlined section tabs on a client's page (ink on night —
 * the chosen tab and its underline vanished) and the red "delete" button (white on the night
 * coral, 2.6:1). Both must stay readable. Local demo backend only; nothing is changed.
 */

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'admin_theme', value: 'dark', url: BASE_URL },
    { name: 'ADMIN_LOCALE', value: 'tr', url: BASE_URL },
  ]);
});

/** WCAG contrast of an element's text against a given colour (both computed in the page). */
function contrast(el: Locator, against: 'self' | 'page') {
  return el.evaluate((node, against) => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = (c: number[]) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
    };
    const fg = rgb(getComputedStyle(node).color);
    const bg = rgb(
      against === 'self'
        ? getComputedStyle(node).backgroundColor
        : getComputedStyle(document.body).backgroundColor,
    );
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a! + 0.05) / (b! + 0.05);
  }, against);
}

test('a client page at night: the chosen section tab and the delete button read clearly', async ({
  page,
}) => {
  await page.goto('/admin/clients');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page
    .getByRole('link', { name: /Deniz Aksoy \(demo\)/ })
    .first()
    .click();
  const sections = page.getByRole('tablist', { name: 'Deniz Aksoy (demo)' });
  const chosen = sections.getByRole('tab', { selected: true });
  await expect(chosen).toBeVisible();
  expect(await contrast(chosen, 'page')).toBeGreaterThanOrEqual(4.5);
  // the underline under it is the accent, not the page's own colour
  const underline = await chosen.evaluate((el) => {
    const mark = [...el.children].find((c) => getComputedStyle(c).position === 'absolute');
    return mark ? getComputedStyle(mark).backgroundColor : null;
  });
  const pageBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(underline).not.toBeNull();
  expect(underline).not.toBe(pageBg);
  expect(underline).not.toBe('rgb(15, 27, 23)');

  await sections.getByRole('tab', { name: tr.admin.clients.tabs.general }).click();
  const remove = page.getByRole('button', { name: tr.admin.clients.hardDelete }).first();
  await expect(remove).toBeVisible();
  expect(await contrast(remove, 'self')).toBeGreaterThanOrEqual(4.5);
});
