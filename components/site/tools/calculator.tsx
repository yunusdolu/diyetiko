'use client';

import { motion, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { Link } from '@/lib/i18n/navigation';
import {
  ACTIVITY_FACTORS,
  LIMITS,
  calculate,
  isValidInput,
  type Activity,
  type Goal,
  type Sex,
} from '@/lib/nutrition/energy';
import { useDir, usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { MacroRings } from '@/components/site/macro-rings';
import { NutritionLabel } from '@/components/site/nutrition-label';
import { ArrowIcon } from '@/components/ui/motion-button';
import { Tabs } from '@/components/ui/tabs';
import { Ticker } from '@/components/ui/ticker';

const ACTIVITIES = Object.keys(ACTIVITY_FACTORS) as Activity[];

/** Slider + live number. Native range input → keyboard/AT support; direction follows the page. */
function Measure({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-ui font-semibold">
          {label}
        </label>
        <p className="num-wide text-[1.75rem] leading-none" aria-hidden>
          {value}
          <span className="ms-1 text-[0.875rem] text-ink-60">{unit}</span>
        </p>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${value} ${unit}`}
        className="range mt-3 w-full"
        style={{ ['--pct' as string]: `${pct}%` }}
      />
    </div>
  );
}

function polar(cx: number, cy: number, r: number, t: number) {
  // t in [0,1] along a half circle from 180° (left) to 0° (right)
  const a = Math.PI * (1 - t);
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
}

function arc(cx: number, cy: number, r: number, t0: number, t1: number) {
  const [x0, y0] = polar(cx, cy, r, t0);
  const [x1, y1] = polar(cx, cy, r, t1);
  const f = (n: number) => Math.round(n * 100) / 100;
  // A span on a half circle is at most 180°, so the large-arc flag is always 0.
  return `M${f(x0)} ${f(y0)} A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)}`;
}

/** Critically damped: the needle glides to the value and settles — no wobble while dragging. */
const GAUGE_SPRING = { stiffness: 170, damping: 26, mass: 1 };

/** A spring-smoothed number that jumps instead of animating for reduced motion. */
function useGaugeValue(target: number, reduced: boolean): MotionValue<number> {
  const v = useSpring(target, GAUGE_SPRING);
  useEffect(() => {
    if (reduced) v.jump(target);
    else v.set(target);
  }, [target, reduced, v]);
  return v;
}

/** Half-ring gauge: BMR tick, TDEE needle, target band. Mirrors in RTL (it is a fill). */
function Gauge({
  bmrV,
  tdeeV,
  range,
  max,
}: {
  bmrV: number;
  tdeeV: number;
  range: { min: number; max: number };
  /** end of the scale (kcal) */
  max: number;
}) {
  const dir = useDir();
  const reduced = usePrefersReducedMotion();
  const t = (v: number) => Math.min(1, Math.max(0, v / max));
  const needle = useGaugeValue(t(tdeeV) * 180 - 90, reduced);
  const bmrAngle = useGaugeValue(t(bmrV) * 180 - 90, reduced);
  const bandFrom = useGaugeValue(t(range.min), reduced);
  const bandTo = useGaugeValue(t(range.max), reduced);
  // The band is computed from two numbers every frame — never by interpolating path strings.
  const band = useTransform(() =>
    arc(160, 165, 140, bandFrom.get(), Math.max(bandFrom.get() + 0.005, bandTo.get())),
  );
  // Rotate around the gauge centre in viewBox units. Motion's SVG default (transform-box:
  // fill-box) measures the origin from each line's own bounding box, and it ignores a plain
  // transformOrigin — the origin must go through originX/originY.
  const pivot = { transformBox: 'view-box', originX: '160px', originY: '165px' } as const;
  return (
    <svg viewBox="0 0 320 180" className={cn('w-full', dir === -1 && '-scale-x-100')} aria-hidden>
      <path
        d={arc(160, 165, 140, 0, 1)}
        fill="none"
        stroke="currentColor"
        strokeOpacity=".14"
        strokeWidth="18"
        strokeLinecap="round"
      />
      {Array.from({ length: 9 }).map((_, i) => {
        const [x0, y0] = polar(160, 165, 118, i / 8);
        const [x1, y1] = polar(160, 165, 108, i / 8);
        return (
          <line
            key={i}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            stroke="currentColor"
            strokeOpacity=".35"
            strokeWidth="1.5"
          />
        );
      })}
      <motion.path
        d={band}
        fill="none"
        stroke="var(--color-citrus)"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <motion.g style={{ ...pivot, rotate: bmrAngle }}>
        <line
          x1="160"
          y1="35"
          x2="160"
          y2="12"
          stroke="var(--color-paprika)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </motion.g>
      <motion.g data-needle style={{ ...pivot, rotate: needle }}>
        <line
          x1="160"
          y1="165"
          x2="160"
          y2="46"
          stroke="var(--color-paper)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </motion.g>
      <circle cx="160" cy="165" r="10" fill="var(--color-paper)" />
    </svg>
  );
}

export function Calculator() {
  const t = useTranslations('tools.calc');
  const tm = useTranslations('macros');
  const tu = useTranslations('units');
  const locale = useLocale() as Locale;
  const [sex, setSex] = useState<Sex>('female');
  const [age, setAge] = useState(32);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(66);
  const [activity, setActivity] = useState<Activity>('light');
  const [goal, setGoal] = useState<Goal>('maintain');
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 });

  const input = { sex, age, heightCm: height, weightKg: weight, activity };
  const valid = isValidInput(input);
  const res = useMemo(() => {
    if (!valid) return null;
    // all the maths lives in lib/nutrition/energy.ts (unit-tested against the published formulas)
    const c = calculate(input, goal);
    return {
      b: c.bmr,
      d: c.tdee,
      r: c.range,
      m: c.macros,
      i: c.bmi,
      cat: c.bmiCategory,
      gaugeMax: c.gaugeMax,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, sex, age, height, weight, activity, goal]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12">
      {/* Inputs */}
      <div className="min-w-0 space-y-9 py-10 lg:col-span-5 lg:pe-10">
        <fieldset>
          <legend className="text-ui font-semibold">{t('sex')}</legend>
          <div className="mt-3">
            <Tabs
              label={t('sex')}
              value={sex}
              onChange={setSex}
              items={[
                { value: 'female', label: t('female') },
                { value: 'male', label: t('male') },
              ]}
            />
          </div>
          <p className="mt-2 text-[0.8125rem] text-ink-60">{t('sexNote')}</p>
        </fieldset>
        <Measure
          label={t('age')}
          value={age}
          onChange={setAge}
          min={LIMITS.age.min}
          max={90}
          unit={t('years')}
        />
        <Measure
          label={t('height')}
          value={height}
          onChange={setHeight}
          min={LIMITS.heightCm.min}
          max={220}
          unit={tu('cm')}
        />
        <Measure
          label={t('weight')}
          value={weight}
          onChange={setWeight}
          min={LIMITS.weightKg.min}
          max={200}
          unit={tu('kg')}
        />
        <fieldset>
          <legend className="text-ui font-semibold">{t('activity')}</legend>
          <div className="mt-3 grid gap-2">
            {ACTIVITIES.map((a) => (
              <label
                key={a}
                className={cn(
                  'group/act relative flex cursor-pointer items-center justify-between gap-4 rounded-[12px] border-[1.5px] px-4 py-3 transition-colors',
                  activity === a
                    ? 'border-ink bg-ink text-paper'
                    : 'border-ink/20 hover:border-ink',
                )}
              >
                <input
                  type="radio"
                  name="activity"
                  value={a}
                  checked={activity === a}
                  onChange={() => setActivity(a)}
                  className="peer sr-only"
                />
                <span>
                  <span className="block text-ui font-semibold">{t(`activities.${a}.label`)}</span>
                  <span
                    className={cn(
                      'block text-[0.8125rem]',
                      activity === a ? 'text-sage' : 'text-ink-60',
                    )}
                  >
                    {t(`activities.${a}.hint`)}
                  </span>
                </span>
                <span className="num text-[0.75rem] opacity-70">×{ACTIVITY_FACTORS[a]}</span>
                <span className="pointer-events-none absolute inset-0 rounded-[12px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-ui font-semibold">{t('goal')}</legend>
          <div className="mt-3">
            <Tabs
              label={t('goal')}
              value={goal}
              onChange={setGoal}
              items={(['maintain', 'lose', 'gain'] as const).map((g) => ({
                value: g,
                label: t(`goals.${g}`),
              }))}
            />
          </div>
        </fieldset>
      </div>

      {/* Results */}
      <div
        className="on-dark relative min-w-0 bg-ink grain-light px-5 py-10 text-paper sm:px-8 lg:col-span-7 lg:px-12"
        aria-live="polite"
      >
        <div className="lg:sticky lg:top-24">
          <h2 className="label text-sage">{t('results')}</h2>
          {!res ? (
            <p className="mt-6 text-lead text-paprika">{t('invalid')}</p>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 items-end gap-8 sm:grid-cols-[1.2fr_1fr]">
                <div>
                  <Gauge bmrV={res.b} tdeeV={res.d} range={res.r} max={res.gaugeMax} />
                  {/* follows the page direction like the gauge itself (0 sits at the inline start) */}
                  <div className="mt-2 flex justify-between text-[0.75rem] text-sage">
                    <span className="num">0</span>
                    <span className="num">{nf.format(res.gaugeMax / 2)}</span>
                    <span className="num">
                      {nf.format(res.gaugeMax)} <span className="font-sans">{tu('kcal')}</span>
                    </span>
                  </div>
                </div>
                <dl className="space-y-5">
                  <div>
                    <dt className="flex items-center gap-2 text-[0.8125rem] font-semibold text-sage">
                      <span className="rounded inline-block h-3 w-1 bg-paprika" aria-hidden />
                      {t('bmr')}
                    </dt>
                    <dd className="mt-1 num-wide text-[2.25rem] leading-none">
                      <Ticker value={res.b} immediate duration={0.5} />
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 text-[0.8125rem] font-semibold text-sage">
                      <span className="rounded inline-block h-3 w-1 bg-paper" aria-hidden />
                      {t('tdee')}
                    </dt>
                    <dd className="mt-1 num-wide text-[2.25rem] leading-none">
                      <Ticker value={res.d} immediate duration={0.5} />
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-8 border-t-2 border-paper pt-5">
                <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-sage">
                  <span className="inline-block h-3 w-3 rounded-full bg-citrus" aria-hidden />
                  {t('target')}
                </p>
                <p className="mt-2 num-wide text-[clamp(2.5rem,6vw,4.5rem)] leading-none text-citrus">
                  <Ticker value={res.r.min} immediate duration={0.5} />
                  <span className="mx-2 text-sage">–</span>
                  <Ticker value={res.r.max} immediate duration={0.5} />
                </p>
                <p className="mt-1 text-[0.8125rem] text-sage">{t('perDay')}</p>
                <p className="mt-3 max-w-md text-[0.8125rem] text-sage">
                  {res.r.flooredAtBmr ? t('floorNote') : t('targetHint')}
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 items-center gap-8 sm:grid-cols-[auto_1fr]">
                <MacroRings
                  protein={res.m.protein}
                  carb={res.m.carb}
                  fat={res.m.fat}
                  surface="dark"
                  size={180}
                  stroke={12}
                  gap={6}
                  play
                >
                  <span className="num text-[1.05rem] leading-none font-semibold">
                    {nf.format(res.m.kcal)}
                  </span>
                  <span className="mt-1 label text-[0.625rem] text-sage">{tu('kcal')}</span>
                </MacroRings>
                <NutritionLabel
                  tone="dark"
                  title={t('macros')}
                  rows={[
                    {
                      label: tm('protein'),
                      value: (
                        <>
                          <Ticker value={res.m.protein} immediate duration={0.4} /> {tu('g')}
                        </>
                      ),
                    },
                    {
                      label: tm('carb'),
                      value: (
                        <>
                          <Ticker value={res.m.carb} immediate duration={0.4} /> {tu('g')}
                        </>
                      ),
                    },
                    {
                      label: tm('fat'),
                      value: (
                        <>
                          <Ticker value={res.m.fat} immediate duration={0.4} /> {tu('g')}
                        </>
                      ),
                    },
                  ]}
                  footer={t('macrosHint')}
                />
              </div>

              <div className="mt-10 grid grid-cols-1 gap-4 border-t border-paper/25 pt-6 sm:grid-cols-[auto_1fr] sm:gap-8">
                <div>
                  <p className="text-[0.8125rem] font-semibold text-sage">{t('bmi')}</p>
                  <p className="mt-1 num-wide text-[2.25rem] leading-none">{nf1.format(res.i)}</p>
                  <p className="mt-1 text-[0.8125rem]">{t(`bmiCategories.${res.cat}`)}</p>
                </div>
                <p className="text-[0.8125rem] leading-relaxed text-sage">{t('bmiLimits')}</p>
              </div>
            </>
          )}
          <p className="mt-10 border-t border-paper/25 pt-5 text-[0.8125rem] leading-relaxed text-sage">
            {t('disclaimer')}
          </p>
          <p className="mt-2 text-[0.8125rem] text-sage">{t('adultsOnly')}</p>
          <Link
            href="/contact"
            className="group/cta mt-8 inline-flex items-center gap-2 text-ui font-semibold text-citrus coarse:min-h-11"
          >
            <span className="underline-offset-4 group-hover/cta:underline">{t('cta')}</span>
            <ArrowIcon size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
