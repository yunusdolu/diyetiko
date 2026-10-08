import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

const countOf = (text: string) => Number(text.match(/\d+/)?.[0] ?? 0);

test('recipe filters narrow the grid and clear restores it', async ({ page }) => {
  await page.goto('/tarifler');
  const counter = page.locator('main [aria-live="polite"]').first();
  await expect(counter).toContainText(/\d+/);
  const total = countOf(await counter.innerText());
  expect(total).toBeGreaterThan(1);

  const filters = page.getByRole('complementary', { name: tr.recipes.filters.title });
  const chip = filters.getByRole('button', { name: tr.diet.vegetarian, exact: false });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => countOf(await counter.innerText())).toBeLessThan(total);

  const narrowed = countOf(await counter.innerText());
  // The grid shows exactly as many cards as the live counter announces.
  await expect(counter.locator('xpath=..').locator('article')).toHaveCount(narrowed);

  await filters.getByRole('button', { name: tr.recipes.filters.clear }).click();
  await expect.poll(async () => countOf(await counter.innerText())).toBe(total);
});

test('recipe cards are in the server HTML (no client-only bailout)', async ({ request }) => {
  const html = await (await request.get('/tarifler')).text();
  expect((html.match(/<article/g) ?? []).length).toBeGreaterThan(5);
});

test('?mode= deep link opens that mode, and switching back clears it', async ({ page }) => {
  await page.goto('/tarifler?mode=fridge');
  await expect(page.getByRole('tab', { name: tr.recipes.modes.fridge })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: tr.recipes.modes.all }).click();
  await expect(page).not.toHaveURL(/mode=/);
});

test('the "Pişirelim" cursor label shows over the recipe image only; the title turns red on hover', async ({
  page,
}) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('dm_loader_seen', '1');
      document.cookie = 'LANG_SUGGEST_DISMISSED=1; path=/';
    } catch {}
  });
  await page.goto('/tarifler');
  await page.waitForTimeout(1200);
  const card = page.locator('article').first();
  // the cursor layer is the fixed overlay above everything; its label is the only <span> in it
  const label = () =>
    page.evaluate(() => {
      const layer = [...document.querySelectorAll('div[aria-hidden="true"]')].find((d) =>
        d.className.includes('z-[100]'),
      );
      return layer?.querySelector('span')?.textContent ?? null;
    });
  // bring the whole card (image + title) on screen: the title sits below the fold at load
  await page.evaluate(() => {
    const article = document.querySelector('article')!;
    const h3 = article.querySelector('h3')!;
    const y = h3.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 80;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } })
      .__lenis;
    if (lenis) lenis.scrollTo(Math.max(0, y), { immediate: true, force: true });
    else window.scrollTo(0, Math.max(0, y));
  });
  await page.waitForTimeout(700);
  const hover = async (selector: string, fx: number, fy: number) => {
    const box = (await card.locator(selector).first().boundingBox())!;
    const point = { x: box.x + box.width * fx, y: box.y + box.height * fy };
    expect(point.y, `${selector} is on screen`).toBeLessThan(page.viewportSize()!.height);
    expect(point.y, `${selector} is on screen`).toBeGreaterThan(0);
    await page.mouse.move(point.x, point.y, { steps: 6 });
    await page.waitForTimeout(600);
  };

  await hover('[data-cursor]', 0.3, 0.3);
  expect(await label()).toBe(tr.cursor.recipe);

  await hover('h3', 0.2, 0.5);
  expect(await label()).toBeNull();
  await expect(card.locator('h3')).toHaveCSS('color', 'rgb(178, 49, 20)');

  // the favourite button sits on the image but is its own control: no label there either
  await hover('button', 0.5, 0.5);
  expect(await label()).toBeNull();
});

// Small laptop window: the filter column is taller than the screen. It must scroll on its own
// (so every filter is reachable while the recipes stay put), then hand the wheel back to the page.
test.describe('small laptop window', () => {
  test.use({ viewport: { width: 1280, height: 650 } });

  test('the filter column scrolls to its last filter, then the page carries on', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('dm_loader_seen', '1');
        document.cookie = 'LANG_SUGGEST_DISMISSED=1; path=/';
      } catch {}
    });
    await page.goto('/tarifler');
    await page.waitForTimeout(1200);
    const aside = page.locator('aside').first();
    const top = await aside.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await page.evaluate((y) => {
      const lenis = (
        window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }
      ).__lenis;
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    }, top + 300);
    await page.waitForTimeout(800);
    const state = () =>
      aside.evaluate((el) => {
        const panel = el.firstElementChild!;
        const buttons = panel.querySelectorAll('button');
        return {
          panel: Math.round(panel.scrollTop),
          page: Math.round(window.scrollY),
          lastFilterBottom: buttons[buttons.length - 1]!.getBoundingClientRect().bottom,
        };
      });
    const wheel = async (dy: number, times: number) => {
      for (let i = 0; i < times; i++) {
        await page.mouse.wheel(0, dy);
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(1100);
    };
    const start = await state();
    expect(start.lastFilterBottom).toBeGreaterThan(650); // below the fold at first

    const box = (await aside.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, 300);
    await wheel(120, 4);
    const atEnd = await state();
    expect(atEnd.panel).toBeGreaterThan(0);
    expect(atEnd.lastFilterBottom).toBeLessThanOrEqual(650);

    await wheel(120, 5); // the column is at its end: the page takes over
    const after = await state();
    expect(after.page).toBeGreaterThan(atEnd.page + 200);
  });
});
