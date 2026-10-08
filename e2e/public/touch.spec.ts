import { expect, test, type Page } from '@playwright/test';

/**
 * Touch screens (phones, and tablets in landscape which are as wide as a laptop): no scroll
 * pinning, horizontal strips can be swiped, controls are finger-sized, and the scroll-driven
 * graphics follow the finger both ways.
 */

async function skipLoader(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('dm_loader_seen', '1');
      document.cookie = 'LANG_SUGGEST_DISMISSED=1; path=/';
    } catch {}
  });
}

/** Share of the notebook lines that is drawn in the first process step (0 … 1). */
const drawn = (page: Page, section: string) =>
  page.evaluate((sel) => {
    const paths = [...document.querySelectorAll(`${sel} svg path[stroke-linecap="round"]`)].slice(
      0,
      7,
    ) as SVGPathElement[];
    const lengths = paths.map((p) => {
      const style = getComputedStyle(p);
      return Number(style.opacity) === 0
        ? 0
        : 1 -
            Number.parseFloat(style.strokeDashoffset || '0') /
              (Number.parseFloat(style.strokeDasharray) || 1);
    });
    return lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  }, section);

for (const device of [
  { name: 'phone', viewport: { width: 390, height: 844 } },
  { name: 'tablet landscape', viewport: { width: 1024, height: 768 } },
  { name: 'iPad Pro landscape', viewport: { width: 1366, height: 1024 } },
]) {
  test.describe(`touch · ${device.name}`, () => {
    test.use({ viewport: device.viewport, isMobile: true, hasTouch: true });

    test('home: nothing pinned, the weekly strip swipes, no sideways page scroll', async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await skipLoader(page);
      await page.goto('/');
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      await page.waitForTimeout(500);
      await expect(page.locator('.pin-spacer')).toHaveCount(0);
      const strip = await page.evaluate(() => {
        const el = document.querySelector('.week-rail')!.parentElement!;
        el.scrollLeft = 300;
        return { moved: el.scrollLeft > 0, overflowX: getComputedStyle(el).overflowX };
      });
      expect(strip).toEqual({ moved: true, overflowX: 'auto' });
      expect(
        await page.evaluate(
          // with isMobile a too-wide page zooms out (innerWidth grows) instead of scrolling
          (w) => Math.max(window.innerWidth, document.documentElement.scrollWidth) - w,
          page.viewportSize()!.width,
        ),
      ).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });

    test('day cards: one-line labels, and a card turning over is never cut off', async ({
      page,
    }) => {
      await skipLoader(page);
      await page.goto('/');
      const first = page.locator('.week-rail li').first();
      await first.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      // the flip button and the day total each sit on one line (they used to wrap on phones)
      const lines = await first.evaluate((li) => {
        const count = (node: Node) => {
          const r = document.createRange();
          r.selectNodeContents(node);
          return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
        };
        const btn = li.querySelector('button')!;
        const text = [...btn.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
        return { button: count(text), total: count(li.querySelector('p .label')!) };
      });
      expect(lines).toEqual({ button: 1, total: 1 });

      // while it turns, the card swings out of its box (perspective): sample every frame and
      // compare its projected box with each ancestor that clips
      await first.evaluate((li) => {
        const w = window as unknown as { __cut: number[] };
        w.__cut = [];
        const faces = li.querySelectorAll(':scope > div > div > div');
        const t0 = performance.now();
        const tick = () => {
          const boxes = [...faces].map((f) => f.getBoundingClientRect());
          const top = Math.min(...boxes.map((b) => b.top));
          const bottom = Math.max(...boxes.map((b) => b.bottom));
          let cut = 0;
          for (let el = li.parentElement; el && el !== document.body; el = el.parentElement) {
            if (getComputedStyle(el).overflowY === 'visible') continue;
            const r = el.getBoundingClientRect();
            cut = Math.max(cut, r.top - top, bottom - r.bottom);
          }
          w.__cut.push(cut);
          if (performance.now() - t0 < 1000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await first.getByRole('button').first().click();
      await page.waitForTimeout(1200);
      const cuts = await page.evaluate(() => (window as unknown as { __cut: number[] }).__cut);
      expect(cuts.length).toBeGreaterThan(20);
      expect(Math.max(...cuts)).toBeLessThanOrEqual(0.5);
    });
  });
}

// Upright tablets: a 1024 px wide iPad Pro in portrait is as wide as a laptop but must get the
// stacked tablet hero (headline, then the plate below it) — never the side-by-side desktop one.
for (const tablet of [
  { name: 'iPad mini', viewport: { width: 768, height: 1024 } },
  { name: 'iPad Air', viewport: { width: 820, height: 1180 } },
  { name: 'iPad Pro 13"', viewport: { width: 1024, height: 1366 } },
]) {
  test.describe(`portrait · ${tablet.name}`, () => {
    test.use({ viewport: tablet.viewport, isMobile: true, hasTouch: true });

    test('the hero stacks: plate below the call to action, full width, nothing pinned', async ({
      page,
    }) => {
      await skipLoader(page);
      await page.goto('/');
      await page.waitForTimeout(1200);
      const layout = await page.evaluate(() => {
        const plate = document.querySelector('.plate-stage')!.getBoundingClientRect();
        const cta = document.querySelector('.hero-copy a[href]')!.getBoundingClientRect();
        return {
          plateTop: plate.top,
          ctaBottom: cta.bottom,
          plateWidth: plate.width,
          vw: window.innerWidth,
        };
      });
      expect(layout.plateTop).toBeGreaterThan(layout.ctaBottom);
      expect(layout.plateWidth).toBeGreaterThan(layout.vw * 0.8);
      await expect(page.locator('.pin-spacer')).toHaveCount(0);
      expect(
        await page.evaluate(
          // with isMobile a too-wide page zooms out (innerWidth grows) instead of scrolling
          (w) => Math.max(window.innerWidth, document.documentElement.scrollWidth) - w,
          page.viewportSize()!.width,
        ),
      ).toBeLessThanOrEqual(0);
    });
  });
}

test.describe('touch · phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  // A finger flicks the page too fast for a scrubbed drawing: on touch screens the graphics
  // play once, on their own, when they come on screen — and stay drawn afterwards.
  test('process graphics play by themselves once in view, and stay', async ({ page }) => {
    await skipLoader(page);
    await page.goto('/');
    await page.waitForTimeout(1200);
    const sec = 'section[aria-labelledby="story-title"]';
    const graphicTop = await page.evaluate((s) => {
      const svg = document.querySelector(`${s} svg`)!;
      return svg.getBoundingClientRect().top + window.scrollY;
    }, sec);
    const go = (y: number) => page.evaluate((yy) => window.scrollTo(0, yy), y);
    await go(graphicTop - 900);
    await page.waitForTimeout(400);
    expect(await drawn(page, sec)).toBeLessThan(0.05);
    await go(graphicTop - 300); // on screen; no scrolling from here on
    await expect.poll(() => drawn(page, sec), { timeout: 6000 }).toBeGreaterThan(0.95);
    await go(graphicTop - 900);
    await page.waitForTimeout(600);
    await go(graphicTop - 300);
    await page.waitForTimeout(400);
    expect(await drawn(page, sec)).toBeGreaterThan(0.95);
  });

  test('the hero plate turns into rings by itself once it is on screen', async ({ page }) => {
    await skipLoader(page);
    await page.goto('/');
    await page.waitForTimeout(1500);
    const data = () =>
      page.evaluate(() => Number(getComputedStyle(document.querySelector('.hero-data')!).opacity));
    expect(await data()).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 420));
    await expect.poll(data, { timeout: 6000 }).toBe(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    expect(await data()).toBe(1);
  });

  test('controls are at least 44 px on touch screens', async ({ page }) => {
    await skipLoader(page);
    for (const path of ['/', '/tarifler', '/tarifler/menemen', '/araclar']) {
      await page.goto(path);
      // measured at rest: cards rise in on a spring and are a fraction smaller until it settles
      await page.waitForTimeout(1400);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(
          'a[href], button, [role="button"], [role="radio"], [role="tab"]',
        )) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (
            !r.width ||
            !r.height ||
            cs.visibility === 'hidden' ||
            Number(cs.opacity) < 0.05 ||
            el.closest('[aria-hidden="true"]')
          )
            continue;
          if (el.getAttribute('href') === '#main') continue;
          const parent = el.parentElement;
          const inText =
            el.tagName === 'A' &&
            parent &&
            ['P', 'LI', 'SPAN'].includes(parent.tagName) &&
            (parent.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 20;
          const stretched = getComputedStyle(el, '::after').position === 'absolute';
          if (!inText && !stretched && (r.width < 44 || r.height < 44))
            out.push(
              `${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`,
            );
        }
        return out;
      });
      expect(small, path).toEqual([]);
    }
  });

  test('a tooltip opens with a tap', async ({ page }) => {
    await skipLoader(page);
    await page.goto('/tarifler/menemen');
    const chip = page.locator('main ul li button').first();
    await chip.tap();
    await expect(page.getByRole('tooltip')).toBeVisible();
  });
});

// A mouse-driven window keeps the scroll-driven graphics (both directions), also when it is too
// narrow for the pinned desktop version.
test.describe('mouse · narrow window', () => {
  test.use({ viewport: { width: 900, height: 900 } });

  test('process graphics draw while scrolling down and un-draw while scrolling back up', async ({
    page,
  }) => {
    await skipLoader(page);
    await page.goto('/');
    await page.waitForTimeout(1200);
    const sec = 'section[aria-labelledby="story-title"]';
    const graphicTop = await page.evaluate((s) => {
      const svg = document.querySelector(`${s} svg`)!;
      return svg.getBoundingClientRect().top + window.scrollY;
    }, sec);
    const at = async (y: number) => {
      await page.evaluate((yy) => {
        const lenis = (
          window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }
        ).__lenis;
        if (lenis) lenis.scrollTo(yy, { immediate: true, force: true });
        else window.scrollTo(0, yy);
      }, y);
      await page.waitForTimeout(700);
      return drawn(page, sec);
    };
    const before = await at(graphicTop - 1000);
    const mid = await at(graphicTop - 560);
    await page.waitForTimeout(2500); // waiting does not advance it — only scrolling does
    const stillMid = await drawn(page, sec);
    const after = await at(graphicTop - 150);
    const back = await at(graphicTop - 1000);
    expect(before).toBeLessThan(0.05);
    expect(mid).toBeGreaterThan(0.05);
    expect(mid).toBeLessThan(0.95);
    expect(stillMid).toBeCloseTo(mid, 1);
    expect(after).toBeGreaterThan(0.95);
    expect(back).toBeLessThan(0.05);
  });
});
