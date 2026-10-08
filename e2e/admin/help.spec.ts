import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

/*
 * "How to use it" (DESIGN.md v1.34): a guide in both panels that stays in the menu — a topic per
 * page, a picture with numbered pins, the same numbers as steps. Read-only.
 */

const ah = tr.admin.help;
const ph = tr.portal.help;

test.use({ viewport: { width: 1440, height: 900 } });

test('the dietitian panel: the guide is in the menu and walks through every section', async ({
  page,
}) => {
  await page.goto('/admin');
  await page.getByRole('link', { name: tr.admin.nav.help, exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin\/help$/);
  await expect(page.getByRole('heading', { level: 1, name: ah.title })).toBeVisible();
  const topics = page.getByRole('tablist', { name: ah.ui.topics });
  await expect(topics.getByRole('tab')).toHaveCount(Object.keys(ah.topics).length);
  // every topic has a picture and its steps
  for (const topic of Object.values(ah.topics)) {
    await topics.getByRole('tab', { name: topic.title, exact: true }).click();
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByRole('heading', { level: 2, name: topic.title })).toBeVisible();
    await expect(panel.getByRole('img')).toBeVisible();
    await expect(panel.locator('ol > li')).toHaveCount(topic.steps.length);
  }
  // a topic has its own address
  await page.goto('/admin/help#programs');
  await expect(
    topics.getByRole('tab', { name: ah.topics.programs.title, exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
});

test('the client portal: the guide stays in the menu and each page links to its topic', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: 'e2e/.auth/client.json',
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto('/panel');
  await page
    .locator('[data-portal-rail]')
    .getByRole('link', { name: tr.portal.nav.help, exact: true })
    .click();
  await expect(page).toHaveURL(/\/panel\/help$/);
  await expect(page.getByRole('tab')).toHaveCount(Object.keys(ph.topics).length);
  await page.getByRole('button', { name: ph.ui.next }).click();
  await expect(
    page.getByRole('tab', { name: ph.topics.program.title, exact: true }),
  ).toHaveAttribute('aria-selected', 'true');

  // from a page: "how do I use this page?" opens that page's topic
  await page.goto('/panel/diary');
  await page.getByRole('link', { name: ph.ui.pageHelp }).click();
  await expect(page).toHaveURL(/\/panel\/help#diary$/);
  await expect(page.getByRole('tab', { name: ph.topics.diary.title, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tabpanel').locator('ol > li')).toHaveCount(
    ph.topics.diary.steps.length,
  );

  // phones: the question mark in the top bar
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/panel');
  await page.locator('header').getByRole('link', { name: tr.portal.nav.help }).click();
  await expect(page).toHaveURL(/\/panel\/help$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await ctx.close();
});
