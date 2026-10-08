import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import tr from '../../messages/tr.json' with { type: 'json' };

test('goal wizard → consented lead is saved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/hedefini-bul');

  // Safety note must be acknowledged first.
  await page.getByRole('button', { name: tr.wizard.safety.ack }).click();

  // goal → activity: tiles are radios and auto-advance.
  await page.getByRole('radio').first().click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.activity.title })).toBeVisible();
  await page.getByRole('radio').nth(1).click();

  // habits: multi-select chips, then continue.
  await expect(page.getByRole('heading', { name: tr.wizard.steps.habits.title })).toBeVisible();
  await page.getByRole('button', { name: tr.wizard.steps.habits.options.skip_breakfast }).click();
  await page.getByRole('button', { name: tr.common.continue }).click();

  // time → stats (optional; skipped here).
  await expect(page.getByRole('heading', { name: tr.wizard.steps.time.title })).toBeVisible();
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: tr.wizard.steps.stats.skip }).click();

  // Result: open the form; submitting without consent must fail.
  await page.getByRole('button', { name: tr.wizard.result.form }).click();
  const name = `E2E Sihirbaz ${Date.now()}`;
  await page.getByLabel(tr.form.name).fill(name);
  await page.getByLabel(tr.form.phone).fill('0555 000 00 42');
  await page.getByRole('button', { name: tr.common.send, exact: true }).click();
  await expect(page.getByText(tr.form.errors.consent)).toBeVisible();

  await page.getByLabel(tr.wizard.result.consentSave).check();
  await page.getByRole('button', { name: tr.common.send, exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: tr.wizard.result.saved })).toBeVisible();

  // Hand the name to the admin project, which checks the inbox.
  mkdirSync('e2e/.auth', { recursive: true });
  writeFileSync('e2e/.auth/lead.json', JSON.stringify({ name }));
  expect(errors).toEqual([]);
});

test('?goal= preset skips the goal question', async ({ page }) => {
  await page.goto('/hedefini-bul?goal=energy');
  await page.getByRole('button', { name: tr.wizard.safety.ack }).click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.activity.title })).toBeVisible();
});

test('going back through the rail keeps the answer in the rail and the chosen tile in its place', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/hedefini-bul');
  await page.getByRole('button', { name: tr.wizard.safety.ack }).click();

  const goalLabel = tr.wizard.steps.goal.options.weight_up;
  await page.getByRole('radio', { name: new RegExp(goalLabel) }).click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.activity.title })).toBeVisible();
  await page.getByRole('radio').nth(1).click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.habits.title })).toBeVisible();

  // back to the first question through the progress rail
  const rail = page.getByRole('list', { name: /\d/ }).getByRole('button');
  await rail.first().click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.goal.title })).toBeVisible();
  await page.waitForTimeout(900); // let every transition settle
  // The rail still shows the answer (it used to be pulled out of the rail into the tile)…
  await expect(rail.first()).toContainText(goalLabel);
  await expect(rail.first().getByText(goalLabel)).toBeVisible();
  // toBeVisible ignores opacity; a shared-layout follower is hidden with opacity 0, so measure it
  const shown = await rail
    .first()
    .getByText(goalLabel)
    .evaluate((el) => {
      let o = 1;
      for (let n: Element | null = el; n && n.tagName !== 'BUTTON'; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden') return 0;
        o *= Number(cs.opacity);
      }
      return o;
    });
  expect(shown).toBeGreaterThan(0.9);
  // …and the chosen tile is selected, in the grid, not stuck mid-flight.
  const tile = page.getByRole('radio', { name: new RegExp(goalLabel) });
  await expect(tile).toHaveAttribute('aria-checked', 'true');
  const box = (await tile.boundingBox())!;
  const grid = (await page.getByRole('radiogroup').boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(grid.y - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(grid.x + grid.width + 1);
  expect(errors).toEqual([]);
});

test('the Back button returns to the previous question with the answer kept', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/hedefini-bul');
  const back = page.getByRole('button', { name: tr.common.back, exact: true });
  await expect(back).toHaveCount(0); // nothing to go back to on the safety note
  await page.getByRole('button', { name: tr.wizard.safety.ack }).click();

  const goalLabel = tr.wizard.steps.goal.options.weight_up;
  await page.getByRole('radio', { name: new RegExp(goalLabel) }).click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.activity.title })).toBeVisible();
  await page.getByRole('radio').nth(1).click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.habits.title })).toBeVisible();
  await expect(page.locator('[data-wizard-iris]')).toHaveCount(0);

  await back.click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.activity.title })).toBeVisible();
  await expect(page.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');
  await back.click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.goal.title })).toBeVisible();
  await expect(page.getByRole('radio', { name: new RegExp(goalLabel) })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // both answers are still in the rail
  await expect(page.locator('[data-rail-pill]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('the choice window stays round from the tile to the rail', async ({ page }) => {
  // every frame: the window (clip-path) of the full-screen layer while it exists
  await page.addInitScript(() => {
    const w = window as unknown as { __iris: string[] };
    w.__iris = [];
    const tick = () => {
      const el = document.querySelector('[data-wizard-iris]');
      if (el) w.__iris.push(getComputedStyle(el).clipPath);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('/hedefini-bul');
  await page.getByRole('button', { name: tr.wizard.safety.ack }).click();
  await page.getByRole('radio').nth(4).click();
  await expect(page.getByRole('heading', { name: tr.wizard.steps.activity.title })).toBeVisible();
  await expect(page.locator('[data-wizard-iris]')).toHaveCount(0);

  const frames = await page.evaluate(() => (window as unknown as { __iris: string[] }).__iris);
  const vw = page.viewportSize()!;
  const windows = frames.map((clip) => {
    // Chromium shortens the value ("inset(0px)", three lengths when left = right, …)
    const m = /^inset\(([^)]*?)(?: round ([\d.]+)px)?\)$/.exec(clip);
    expect(m, clip).not.toBeNull();
    const v = m![1]!.split(' ').map(parseFloat);
    const [top, right = top!, bottom = top!, left = right] = v as [number, ...number[]];
    return { top: top!, right, bottom, left, radius: Number(m![2] ?? 0) };
  });
  expect(windows.length).toBeGreaterThan(20);
  // it really opens to the whole screen…
  expect(windows.some((w) => w.top + w.right + w.bottom + w.left < 1)).toBe(true);
  for (const w of windows) {
    const gap = Math.max(w.top, w.right, w.bottom, w.left);
    // …and whenever it is a window (not flush with the viewport) its corners are round:
    // at least the tile's radius, more while travelling — never a square box
    if (gap >= 18) expect(w.radius, JSON.stringify(w)).toBeGreaterThanOrEqual(17.9);
    else expect(w.radius, JSON.stringify(w)).toBeGreaterThanOrEqual(gap - 0.2);
  }
  // it lands on the answer's pill in the rail
  const last = windows.at(-1)!;
  const pill = (await page.locator('[data-rail-pill="goal"]').boundingBox())!;
  expect(Math.abs(last.left - pill.x)).toBeLessThan(2);
  expect(Math.abs(last.top - pill.y)).toBeLessThan(2);
  expect(Math.abs(vw.width - last.right - (pill.x + pill.width))).toBeLessThan(2);
  expect(last.radius).toBeGreaterThanOrEqual(pill.height / 2);
});
