import { expect, test } from '@playwright/test';

const HOMES = [
  { path: '/', lang: 'tr', dir: 'ltr' },
  { path: '/en', lang: 'en', dir: 'ltr' },
  { path: '/ar', lang: 'ar', dir: 'rtl' },
  { path: '/fr', lang: 'fr', dir: 'ltr' },
] as const;

for (const home of HOMES) {
  test(`home renders in ${home.lang}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(home.path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', home.lang);
    await expect(page.locator('html')).toHaveAttribute('dir', home.dir);
    await expect(page.locator('h1').first()).toBeVisible();
    // hreflang alternates for all four locales + x-default
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(5);
    // the floating WhatsApp button points at the real number
    await expect(page.locator('a[href^="https://wa.me/905370506733"]').first()).toBeAttached();
    expect(errors).toEqual([]);
  });
}

test('arabic layout is mirrored and never scrolls sideways', async ({ page }) => {
  await page.goto('/ar');
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  // Brand mark sits at the inline start → right half of the header in RTL.
  const brand = page.locator('header a[href="/ar"]').first();
  const box = await brand.boundingBox();
  const width = page.viewportSize()!.width;
  expect(box).not.toBeNull();
  expect(box!.x + box!.width / 2).toBeGreaterThan(width / 2);

  // Arabic headline is split by word only — never by character (that breaks glyph joining).
  const { units, sentence } = await page.evaluate(() => {
    const h1 = document.querySelector('h1')!;
    return {
      units: Array.from(h1.querySelectorAll('.kin-unit'), (u) => u.textContent ?? ''),
      sentence: h1.querySelector('.sr-only')?.textContent ?? '',
    };
  });
  expect(units.length).toBeGreaterThan(1);
  expect(units.join(' ')).toBe(sentence.trim());
});

test('invalid locale segment is a real 404', async ({ page }) => {
  const res = await page.goto('/xx/tarifler');
  expect(res?.status()).toBe(404);
});

test('leaving the home page after the scroll pins exist does not crash (client navigation)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  // GSAP pins wrap sections in .pin-spacer; unmounting them used to throw "removeChild".
  await expect(page.locator('.pin-spacer').first()).toBeAttached({ timeout: 15_000 });
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(800); // smooth scroll settles
  await page.mouse.wheel(0, -150); // scrolling up reveals the auto-hiding header
  await page.waitForTimeout(800);
  await page.locator('header a[href="/tarifler"]').first().click();
  await expect(page).toHaveURL(/\/tarifler$/);
  await expect(page.locator('h1').first()).toBeVisible();
  // and back again
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const path of [
    '/',
    '/tarifler',
    '/tarifler/menemen',
    '/rehberler',
    '/araclar',
    '/hedefini-bul',
    '/hakkimda',
    '/meslektaslar',
    '/iletisim',
    '/en/tools',
    '/fr/outils',
    '/ar/adawat',
  ]) {
    test(`${path} is not wider than the screen`, async ({ page }) => {
      await page.goto(path);
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
    });
  }
});

// Small laptop windows (1366×768 minus browser chrome, 125 % Windows scaling, browser zoom on a
// 13" MacBook): the pinned sections are exactly one screen tall, so their content must fit it.
for (const size of [
  { width: 1024, height: 665 },
  { width: 1366, height: 657 },
  { width: 1536, height: 730 },
  { width: 1440, height: 900 },
]) {
  test.describe(`laptop ${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test('hero call to action and the weekly cards fit the window', async ({ page }) => {
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('dm_loader_seen', '1');
          document.cookie = 'LANG_SUGGEST_DISMISSED=1; path=/';
        } catch {}
      });
      await page.goto('/');
      await page.waitForTimeout(1500);
      const cta = await page.evaluate(
        () => document.querySelector('.hero-copy a[href]')!.getBoundingClientRect().bottom,
      );
      expect(cta).toBeLessThanOrEqual(size.height);

      // scroll into the pinned weekly strip and flip a card: both faces must fit
      const top = await page.evaluate(
        () =>
          document.querySelector('#week-title')!.closest('section')!.getBoundingClientRect().top +
          window.scrollY,
      );
      await page.evaluate((y) => {
        const lenis = (
          window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }
        ).__lenis;
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo(0, y);
      }, top + 150);
      await page.waitForTimeout(900);
      await page.locator('.week-rail li button').first().click({ force: true });
      await page.waitForTimeout(1100);
      const card = await page.evaluate(() => {
        const el = document.querySelector('.week-rail li > div')!;
        const [front, back] = el.querySelectorAll(':scope > div > div');
        const r = el.getBoundingClientRect();
        return {
          top: r.top,
          bottom: r.bottom,
          frontOver: front!.scrollHeight - front!.clientHeight,
          backOver: back!.scrollHeight - back!.clientHeight,
        };
      });
      expect(card.top).toBeGreaterThanOrEqual(0);
      expect(card.bottom).toBeLessThanOrEqual(size.height);
      expect(card.frontOver).toBeLessThanOrEqual(1);
      expect(card.backOver).toBeLessThanOrEqual(1);
    });
  });
}
