import { expect, test, type Locator, type Page } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * The portal's day / night switch (DESIGN.md v1.39): the new theme opens as a circle from the sun
 * / moon of the control that was pressed — the same spot wherever on the control the press lands,
 * and with the keyboard — and the choice is kept. Local demo backend only.
 */

const th = tr.portal.theme;
test.use({ storageState: 'e2e/.auth/client.json', timezoneId: 'Europe/Istanbul' });

/**
 * Records, inside the page: the middle of the sun / moon of a theme control at the moment it is
 * pressed, and the centre the theme circle is then asked to open from.
 */
async function watchCircle(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener(
      'click',
      (e) => {
        const control = (e.target as Element).closest(
          '[data-theme-switch], [role="radio"], [data-slot="sidebar-item"]',
        );
        const glyph = control?.querySelector('[data-theme-glyph]');
        if (!glyph) return;
        const box = glyph.getBoundingClientRect();
        (window as unknown as { __glyph?: number[] }).__glyph = [
          box.left + box.width / 2,
          box.top + box.height / 2,
        ];
      },
      true,
    );
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const at = JSON.stringify(keyframes).match(/circle\(0px at ([\d.]+)px ([\d.]+)px\)/);
      if (at)
        (window as unknown as { __circle?: number[] }).__circle = [Number(at[1]), Number(at[2])];
      return animate.call(this, keyframes, options);
    };
  });
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  // the first-visit card sits in a corner and must not take the press
  await page.addStyleTag({ content: '[data-first-run]{display:none!important}' });
}

/** press a control off-centre and expect the circle at its glyph, the theme flipped */
async function expectFromGlyph(
  page: Page,
  control: Locator,
  press: () => Promise<void>,
  expected: 'light' | 'dark',
) {
  await expect(control.locator('[data-theme-glyph]')).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __circle?: number[]; __glyph?: number[] };
    delete w.__circle;
    delete w.__glyph;
  });
  await press();
  await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
  const { circle, glyph } = await page.evaluate(() => {
    const w = window as unknown as { __circle?: number[]; __glyph?: number[] };
    return { circle: w.__circle, glyph: w.__glyph };
  });
  expect(circle, 'the circle animation ran').toBeTruthy();
  expect(glyph, 'the pressed control has a sun / moon').toBeTruthy();
  expect(Math.abs(circle![0]! - glyph![0]!)).toBeLessThan(1.5);
  expect(Math.abs(circle![1]! - glyph![1]!)).toBeLessThan(1.5);
  // let the transition finish before the next press
  await page.waitForTimeout(900);
}

test('every theme control opens the circle from its own sun / moon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await watchCircle(page);

  // the sidebar row, pressed at its far end (on the "Gündüz" chip, not on the icon)
  await open(page, '/panel/progress');
  const row = page
    .locator('[data-portal-rail]')
    .getByRole('button', { name: new RegExp(th.title) });
  const rowBox = (await row.boundingBox())!;
  await expectFromGlyph(
    page,
    row,
    () => row.click({ position: { x: rowBox.width - 12, y: 6 } }),
    'dark',
  );

  // the button in the page header, pressed at its edge (a round button has no corners)
  const head = page.locator('header [data-theme-switch]:visible').first();
  await expectFromGlyph(page, head, () => head.click({ position: { x: 5, y: 20 } }), 'light');

  // the button in the greeting card — and the card's contents stay where they are: the card cuts
  // off its oversized decoration, and a box that merely hides overflow can be scrolled by the
  // browser when a control inside it is focused (the greeting and the buttons then sit displaced)
  await open(page, '/panel');
  const hero = page.locator('section [data-theme-switch]').first();
  const headingInCard = () =>
    hero.evaluate((el) => {
      const card = el.closest('section')!;
      const h1 = card.querySelector('h1')!.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      return [
        Math.round(h1.left - box.left),
        Math.round(h1.top - box.top),
        card.scrollTop,
        card.scrollLeft,
      ];
    });
  const placed = await headingInCard();
  await expectFromGlyph(page, hero, () => hero.click({ position: { x: 27, y: 16 } }), 'dark');
  expect(await headingInCard()).toEqual(placed);
  await hero.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  expect(await headingInCard()).toEqual(placed);

  // the two choices on the account page: a corner of the button, then the keyboard
  await open(page, '/panel/account');
  const day = page.getByRole('radio', { name: th.light });
  const night = page.getByRole('radio', { name: th.dark });
  await expect(night).toHaveAttribute('aria-checked', 'true'); // the choice was kept
  await expectFromGlyph(page, day, () => day.click({ position: { x: 5, y: 5 } }), 'light');
  await night.focus();
  await expectFromGlyph(page, night, () => page.keyboard.press('Enter'), 'dark');

  // kept across a reload, and rendered by the server (no flash of the other theme)
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.addStyleTag({ content: '[data-first-run]{display:none!important}' });
  // back to day for the tests that follow
  await expectFromGlyph(
    page,
    page.getByRole('radio', { name: th.light }),
    () => page.getByRole('radio', { name: th.light }).click(),
    'light',
  );
});

test('phones: the theme button in the top bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await watchCircle(page);
  await open(page, '/panel');
  const top = page.locator('[data-portal-top] [data-theme-switch]');
  await expect(top).toBeVisible();
  await expectFromGlyph(page, top, () => top.click({ position: { x: 6, y: 30 } }), 'dark');
  await expectFromGlyph(page, top, () => top.click(), 'light');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

/*
 * The server's HTML and what the browser renders must agree on every portal page, in both themes:
 * a hydration mismatch (or any other error) shows up in the console. The dev server compiles from
 * the files as they are (next.config.ts), so a stale compilation cannot hide here.
 */
test('no portal page logs an error, by day or by night', async ({ browser }) => {
  test.setTimeout(120_000);
  const pages = [
    '/panel',
    '/panel/program',
    '/panel/diary',
    '/panel/progress',
    '/panel/week',
    '/panel/messages',
    '/panel/care',
    '/panel/files',
    '/panel/shopping',
    '/panel/account',
    '/panel/help',
  ];
  for (const theme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/client.json',
      viewport: { width: 1440, height: 900 },
      timezoneId: 'Europe/Istanbul',
    });
    await ctx.addCookies([{ name: 'portal_theme', value: theme, url: 'http://localhost:3000' }]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${page.url()} · ${e.message.slice(0, 160)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()))
        errors.push(`${page.url()} · ${m.text().replace(/\s+/g, ' ').slice(0, 160)}`);
    });
    for (const url of pages) {
      await page.goto(url);
      await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.waitForTimeout(400);
    }
    expect(errors, `console errors in the ${theme} theme`).toEqual([]);
    await ctx.close();
  }
});
