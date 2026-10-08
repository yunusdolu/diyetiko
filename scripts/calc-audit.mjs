/**
 * Calculator audit: drives the energy & macro calculator in a real browser through many input
 * combinations and compares EVERYTHING on screen (BMR, daily need, range, example macros, BMI +
 * category, and the gauge's needle, BMR tick and target band) with an independent reference
 * implementation written from the published formulas below — not imported from the app.
 *
 * Usage: MSYS_NO_PATHCONV=1 node scripts/calc-audit.mjs [--base=http://localhost:3000] [--path=/araclar]
 * Read-only: it only moves the calculator's own controls.
 */
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...r] = a.replace(/^--/, '').split('=');
    return [k, r.join('=') || true];
  }),
);
const base = String(args.base ?? 'http://localhost:3000');
const path = String(args.path ?? '/araclar');

// ---- reference ---------------------------------------------------------------------------
const FACTOR = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
/** Mifflin-St Jeor (1990) */
const refBmr = (b) => 10 * b.weight + 6.25 * b.height - 5 * b.age + (b.sex === 'male' ? 5 : -161);
const r10 = (v) => Math.round(v / 10) * 10;
function reference(b, activity, goal) {
  const bmr = refBmr(b);
  const tdee = bmr * FACTOR[activity];
  const [lo, hi] = goal === 'lose' ? [0.85, 0.9] : goal === 'gain' ? [1.05, 1.1] : [0.95, 1.05];
  const min = r10(Math.max(bmr, tdee * lo));
  const max = r10(Math.max(bmr, tdee * lo, tdee * hi));
  const kcal = goal === 'maintain' ? tdee : r10((min + max) / 2);
  const proteinKcal = Math.min(1.2 * b.weight * 4, kcal * 0.3);
  const fatKcal = kcal * 0.3;
  const bmi = b.weight / (b.height / 100) ** 2;
  const shown = Math.round(bmi * 10) / 10;
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    min,
    max,
    kcal: Math.round(kcal),
    protein: Math.round(proteinKcal / 4),
    fat: Math.round(fatKcal / 9),
    carb: Math.round((kcal - proteinKcal - fatKcal) / 4),
    bmi: shown,
    cat: shown < 18.5 ? 'under' : shown < 25 ? 'normal' : shown < 30 ? 'over' : 'obese',
    rawTdee: tdee,
    rawBmr: bmr,
  };
}

const bodies = [
  { sex: 'female', age: 32, height: 165, weight: 66 },
  { sex: 'male', age: 45, height: 180, weight: 92 },
  { sex: 'female', age: 18, height: 120, weight: 35 }, // smallest inputs
  { sex: 'male', age: 18, height: 220, weight: 200 }, // largest energy
  { sex: 'female', age: 90, height: 150, weight: 40 }, // lowest energy
  { sex: 'male', age: 60, height: 171, weight: 73 }, // BMI 24.96 → shown as 25.0
  { sex: 'female', age: 25, height: 170, weight: 53 }, // BMI 18.34 → underweight
  { sex: 'male', age: 35, height: 175, weight: 95 }, // BMI 31.0 → obese
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: 'reduce',
});
await context.addInitScript(() => {
  try {
    sessionStorage.setItem('dm_loader_seen', '1');
    document.cookie = 'LANG_SUGGEST_DISMISSED=1; path=/';
  } catch {}
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const setRange = (index, value) =>
  page.evaluate(
    ([i, v]) => {
      const el = document.querySelectorAll('input[type="range"]')[i];
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [index, value],
  );

const read = () =>
  page.evaluate(() => {
    const num = (s) =>
      Number(
        String(s)
          .replace(/[^\d,.-]/g, '')
          .replace(/\./g, '')
          .replace(',', '.'),
      );
    const panel = document.querySelector('[aria-live="polite"]');
    // Tickers render each number twice (animated + screen-reader copy): read what is VISIBLE
    const seen = (el) => {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.sr-only').forEach((n) => n.remove());
      return clone.textContent;
    };
    const dds = [...panel.querySelectorAll('dl dd')].map(seen);
    const range = seen(panel.querySelector('p.text-citrus')).split('–').map(num);
    const svg = panel.querySelector('svg[viewBox="0 0 320 180"]');
    const angle = (el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return Math.round((Math.atan2(m.b, m.a) * 1800) / Math.PI) / 10;
    };
    const groups = svg.querySelectorAll('g');
    // dd 0–1: BMR and daily need; dd 2–4: the macro rows of the nutrition label ("68 g")
    const grams = dds.slice(2, 5).map(num);
    const ring = [...panel.querySelectorAll('span.num')].find(
      (s) => s.nextElementSibling?.textContent?.trim().toLowerCase() === 'kcal',
    );
    const bmi = [...panel.querySelectorAll('p.num-wide')].at(-1);
    // the scale labels under the gauge: 0 · middle · end ("4.000 kcal")
    const scale = svg.parentElement.querySelectorAll('div > span.num');
    return {
      bmr: num(dds[0]),
      tdee: num(dds[1]),
      min: range[0],
      max: range[1],
      kcal: num(ring.textContent),
      grams,
      bmi: num(bmi.textContent),
      cat: bmi.nextElementSibling.textContent.trim(),
      bmrAngle: angle(groups[0]),
      needleAngle: angle(groups[1]),
      band: svg.querySelectorAll('path')[1].getAttribute('d'),
      gaugeMax: num(scale[scale.length - 1].textContent),
    };
  });

let checked = 0;
const problems = [];
const cats = {};
const GOALS = ['maintain', 'lose', 'gain'];
for (const b of bodies) {
  const sexTabs = page.getByRole('tablist').first().getByRole('tab');
  await sexTabs.nth(b.sex === 'female' ? 0 : 1).click();
  await setRange(0, b.age);
  await setRange(1, b.height);
  await setRange(2, b.weight);
  for (const activity of Object.keys(FACTOR)) {
    await page.locator(`input[name="activity"][value="${activity}"]`).check({ force: true });
    for (const goal of GOALS) {
      await page.getByRole('tablist').nth(1).getByRole('tab').nth(GOALS.indexOf(goal)).click();
      await page.waitForTimeout(250);
      const got = await read();
      const exp = reference(b, activity, goal);
      const tag = `${b.sex} ${b.age}y ${b.height}cm ${b.weight}kg · ${activity} · ${goal}`;
      const eq = (name, a, e) => {
        if (a !== e) problems.push(`${tag}: ${name} shown ${a}, expected ${e}`);
      };
      eq('BMR', got.bmr, exp.bmr);
      eq('daily need', got.tdee, exp.tdee);
      eq('range min', got.min, exp.min);
      eq('range max', got.max, exp.max);
      eq('example kcal', got.kcal, exp.kcal);
      eq('protein g', got.grams[0], exp.protein);
      eq('carb g', got.grams[1], exp.carb);
      eq('fat g', got.grams[2], exp.fat);
      eq('BMI', got.bmi, exp.bmi);
      (cats[exp.cat] ??= new Set()).add(got.cat);

      // gauge: needle = daily need, tick = BMR, band = range, on a 0…gaugeMax half circle
      const t = (v) => Math.min(1, Math.max(0, v / got.gaugeMax));
      const near = (name, a, e) => {
        if (Math.abs(a - e) > 0.6)
          problems.push(
            `${tag}: ${name} at ${a}°, expected ${e.toFixed(1)}° (scale 0–${got.gaugeMax})`,
          );
      };
      near('needle', got.needleAngle, t(exp.rawTdee) * 180 - 90);
      near('BMR tick', got.bmrAngle, t(exp.rawBmr) * 180 - 90);
      if (exp.rawTdee > got.gaugeMax)
        problems.push(
          `${tag}: daily need ${exp.tdee} is beyond the gauge scale (0–${got.gaugeMax}); the needle is pinned at the end`,
        );
      if (exp.max > got.gaugeMax)
        problems.push(`${tag}: range max ${exp.max} is beyond the gauge scale (0–${got.gaugeMax})`);
      const m = /M([\d.]+) ([\d.]+) A140 140 0 0 1 ([\d.]+) ([\d.]+)/.exec(got.band);
      if (!m) problems.push(`${tag}: band path unreadable: ${got.band}`);
      else {
        const pt = (tt) => [
          160 + 140 * Math.cos(Math.PI * (1 - tt)),
          165 - 140 * Math.sin(Math.PI * (1 - tt)),
        ];
        const [x0, y0] = pt(t(exp.min));
        const [x1, y1] = pt(Math.max(t(exp.min) + 0.005, t(exp.max)));
        if (Math.hypot(+m[1] - x0, +m[2] - y0) > 1.5 || Math.hypot(+m[3] - x1, +m[4] - y1) > 1.5)
          problems.push(
            `${tag}: band drawn ${m.slice(1).join(',')} expected ${[x0, y0, x1, y1].map((n) => n.toFixed(1)).join(',')}`,
          );
      }

      // what the visitor reads must be consistent with itself
      const energy = got.grams[0] * 4 + got.grams[1] * 4 + got.grams[2] * 9;
      if (Math.abs(energy - got.kcal) > 12)
        problems.push(`${tag}: grams add up to ${energy} kcal but the ring says ${got.kcal}`);
      if (got.min < got.bmr - 5)
        problems.push(`${tag}: range min ${got.min} is below BMR ${got.bmr}`);
      if (goal === 'lose' && got.max >= got.tdee)
        problems.push(`${tag}: the "lose" range does not sit below the daily need`);
      if (goal === 'gain' && got.min <= got.tdee)
        problems.push(`${tag}: the "gain" range does not sit above the daily need`);
      if (goal === 'maintain' && !(got.min <= got.tdee && got.tdee <= got.max))
        problems.push(`${tag}: the "maintain" range does not contain the daily need`);
      checked++;
    }
  }
}
console.log(`${checked} combinations checked`);
console.log(
  'BMI category labels:',
  Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, [...v]])),
);
const uniq = [...new Set(problems)];
console.log(
  uniq.length ? `${uniq.length} problem(s):\n` + uniq.slice(0, 80).join('\n') : 'no problems',
);
if (errors.length) console.log('page errors', errors);
await browser.close();
process.exit(uniq.length || errors.length ? 1 : 0);
