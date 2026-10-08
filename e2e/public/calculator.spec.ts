import { expect, test, type Page } from '@playwright/test';
import { calculate, type Activity, type EnergyInput, type Goal } from '../../lib/nutrition/energy';

/*
 * The energy & macro calculator in the real page: what is ON SCREEN (numbers, BMI label, the
 * gauge's needle / BMR tick / scale) must equal the unit-tested library for every case below.
 * The maths itself is covered exhaustively in lib/nutrition/calculator.test.ts (25 920 inputs)
 * and, across 120 on-screen combinations, by `node scripts/calc-audit.mjs`.
 */

// reduced motion: springs and tickers jump to their value, so there is nothing to wait for —
// and the page must hydrate cleanly for visitors who have that setting on
test.use({ contextOptions: { reducedMotion: 'reduce' }, viewport: { width: 1440, height: 1100 } });

const GOALS: Goal[] = ['maintain', 'lose', 'gain'];
const CASES: { input: EnergyInput; goal: Goal }[] = [
  {
    input: { sex: 'female', age: 32, heightCm: 165, weightKg: 66, activity: 'light' },
    goal: 'maintain',
  },
  {
    input: { sex: 'female', age: 32, heightCm: 165, weightKg: 66, activity: 'sedentary' },
    goal: 'lose',
  },
  {
    input: { sex: 'male', age: 45, heightCm: 180, weightKg: 92, activity: 'active' },
    goal: 'lose',
  },
  {
    input: { sex: 'male', age: 45, heightCm: 180, weightKg: 92, activity: 'moderate' },
    goal: 'gain',
  },
  {
    input: { sex: 'female', age: 18, heightCm: 120, weightKg: 35, activity: 'sedentary' },
    goal: 'lose',
  },
  {
    input: { sex: 'female', age: 90, heightCm: 150, weightKg: 40, activity: 'light' },
    goal: 'maintain',
  },
  {
    input: { sex: 'male', age: 18, heightCm: 220, weightKg: 200, activity: 'very_active' },
    goal: 'gain',
  }, // 0–8.000 scale
  {
    input: { sex: 'male', age: 30, heightCm: 190, weightKg: 120, activity: 'active' },
    goal: 'maintain',
  }, // 0–6.000 scale
  {
    input: { sex: 'male', age: 60, heightCm: 171, weightKg: 73, activity: 'light' },
    goal: 'maintain',
  }, // BMI shown as 25.0
];

async function setRange(page: Page, index: number, value: number) {
  await page.evaluate(
    ([i, v]) => {
      const el = document.querySelectorAll<HTMLInputElement>('input[type="range"]')[i!]!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        el,
        String(v),
      );
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    [index, value],
  );
}

/** What the visitor sees in the results panel (Turkish number format: 1.884 / 24,2). */
function read(page: Page) {
  return page.evaluate(() => {
    const num = (s: string) =>
      Number(
        s
          .replace(/[^\d,.-]/g, '')
          .replace(/\./g, '')
          .replace(',', '.'),
      );
    const panel = document.querySelector('div[aria-live="polite"]')!;
    const seen = (el: Element) => {
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll('.sr-only').forEach((n) => n.remove()); // tickers carry a screen-reader copy
      return clone.textContent ?? '';
    };
    const dds = [...panel.querySelectorAll('dl dd')].map(seen);
    const range = seen(panel.querySelector('p.text-citrus')!).split('–').map(num);
    const svg = panel.querySelector('svg[viewBox="0 0 320 180"]')!;
    const angle = (el: Element) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return (Math.atan2(m.b, m.a) * 180) / Math.PI;
    };
    const groups = svg.querySelectorAll('g');
    const scale = svg.parentElement!.querySelectorAll('div > span.num');
    const bmi = [...panel.querySelectorAll('p.num-wide')].at(-1)!;
    return {
      bmr: num(dds[0]!),
      tdee: num(dds[1]!),
      min: range[0],
      max: range[1],
      grams: dds.slice(2, 5).map(num),
      bmi: num(bmi.textContent ?? ''),
      category: bmi.nextElementSibling?.textContent?.trim(),
      tickAngle: angle(groups[0]!),
      needleAngle: angle(groups[1]!),
      scaleMax: num(scale[scale.length - 1]!.textContent ?? ''),
    };
  });
}

test('every number, the BMI label and the gauge match the tested library', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto('/araclar');
  await page.waitForTimeout(800);
  const tr = (await import('../../messages/tr.json', { with: { type: 'json' } })).default;
  const categories = tr.tools.calc.bmiCategories as Record<string, string>;

  for (const { input, goal } of CASES) {
    await page
      .getByRole('tablist')
      .first()
      .getByRole('tab')
      .nth(input.sex === 'female' ? 0 : 1)
      .click();
    await setRange(page, 0, input.age);
    await setRange(page, 1, input.heightCm);
    await setRange(page, 2, input.weightKg);
    await page
      .locator(`input[name="activity"][value="${input.activity satisfies Activity}"]`)
      .check({ force: true });
    await page.getByRole('tablist').nth(1).getByRole('tab').nth(GOALS.indexOf(goal)).click();
    await page.waitForTimeout(250);

    const shown = await read(page);
    const c = calculate(input, goal);
    const where = JSON.stringify({ ...input, goal });
    expect(shown.bmr, where).toBe(Math.round(c.bmr));
    expect(shown.tdee, where).toBe(Math.round(c.tdee));
    expect([shown.min, shown.max], where).toEqual([c.range.min, c.range.max]);
    expect(shown.grams, where).toEqual([c.macros.protein, c.macros.carb, c.macros.fat]);
    expect(shown.bmi, where).toBe(c.bmi);
    expect(shown.category, where).toBe(categories[c.bmiCategory]);
    // gauge: 0 at −90°, the end of the scale at +90°
    expect(shown.scaleMax, where).toBe(c.gaugeMax);
    expect(shown.needleAngle, where).toBeCloseTo((c.tdee / c.gaugeMax) * 180 - 90, 0);
    expect(shown.tickAngle, where).toBeCloseTo((c.bmr / c.gaugeMax) * 180 - 90, 0);
    expect(shown.needleAngle, where).toBeLessThan(90); // never pinned at the end of the scale
  }
  expect(errors).toEqual([]);
});

test('the gauge follows the page direction in Arabic: 0 on the right, the scale end on the left', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto('/ar/adawat');
  await page.waitForTimeout(800);
  const g = await page.evaluate(() => {
    const svg = document.querySelector('svg[viewBox="0 0 320 180"]')!;
    const labels = [...svg.parentElement!.querySelectorAll('div > span.num')].map(
      (s) => s.getBoundingClientRect().left,
    );
    return {
      mirrored: getComputedStyle(svg).scale,
      zeroX: labels[0]!,
      endX: labels[labels.length - 1]!,
    };
  });
  expect(g.mirrored).toBe('-1 1');
  expect(g.zeroX).toBeGreaterThan(g.endX);
  expect(errors).toEqual([]);
});
