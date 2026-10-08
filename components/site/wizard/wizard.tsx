'use client';

import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n/config';
import {
  calculate,
  isValidInput,
  type Activity,
  type Goal as CalcGoal,
} from '@/lib/nutrition/energy';
import { useDir, useMotionLevel } from '@/lib/motion/hooks';
import { useQueryParam } from '@/lib/use-query-param';
import { dur, ease, spring } from '@/lib/motion';
import { cn, whatsappHref } from '@/lib/utils';
import type { WizardAnswers } from '@/lib/validators/lead';
import { Ingredient } from '@/components/site/ingredients';
import { MacroRings } from '@/components/site/macro-rings';
import { GOAL_OPTIONS } from '@/components/site/home/wizard-teaser';
import { ChatIcon } from '@/components/site/whatsapp-fab';
import { ArrowIcon, MotionButton } from '@/components/ui/motion-button';
import { ExternalButton } from '@/components/ui/motion-link';
import { Chip } from '@/components/ui/chip';
import { Tabs } from '@/components/ui/tabs';
import { Ticker } from '@/components/ui/ticker';
import { WizardLeadForm } from './lead-form';

type Step = 'safety' | 'goal' | 'activity' | 'habits' | 'time' | 'stats' | 'result';
const FLOW: Step[] = ['safety', 'goal', 'activity', 'habits', 'time', 'stats', 'result'];
const QUESTION_STEPS: Step[] = ['goal', 'activity', 'habits', 'time', 'stats'];

type GoalKey = WizardAnswers['goal'];
type TimeKey = WizardAnswers['time'];
type Habit = WizardAnswers['habits'][number];

const ACTIVITIES: { key: Activity; art: string }[] = [
  { key: 'sedentary', art: 'bread' },
  { key: 'light', art: 'apple' },
  { key: 'moderate', art: 'cucumber' },
  { key: 'active', art: 'egg' },
  { key: 'very_active', art: 'lemon' },
];
const TIMES: { key: TimeKey; art: string }[] = [
  { key: 't15', art: 'egg' },
  { key: 't30', art: 'tomato' },
  { key: 't60', art: 'lentil' },
  { key: 't60plus', art: 'fish' },
];
const HABITS: Habit[] = [
  'skip_breakfast',
  'late_eating',
  'snacking',
  'eat_out',
  'low_veg',
  'sweet_drinks',
  'low_water',
  'irregular',
];

type State = {
  goal?: GoalKey;
  activity?: Activity;
  habits: Habit[];
  time?: TimeKey;
  stats: { sex: 'female' | 'male'; age: number; heightCm: number; weightKg: number } | null;
};

export function Wizard({ whatsapp }: { whatsapp: string }) {
  const t = useTranslations('wizard');
  const tc = useTranslations('common');
  const tact = useTranslations('tools.calc.activities');
  const level = useMotionLevel();
  const reduced = level === 'reduced';
  const dir = useDir();
  // ?goal= preset from the home teaser; read without useSearchParams so the wizard prerenders.
  const preset = useQueryParam('goal') as GoalKey | null;
  const validPreset = GOAL_OPTIONS.some((g) => g.key === preset) ? preset : null;

  const [step, setStep] = useState<Step>('safety');
  const [answers, setAnswers] = useState<State>({ habits: [], stats: null });
  /*
   * The choice "iris": one full-screen ink layer whose visible window (clip-path, rounded the
   * whole way) opens from the chosen tile to the whole screen, then closes onto the answer's
   * pill in the rail. Nothing is scaled, so corners never go square and text is never squashed
   * (a shared-layout morph between a card, a screen and a pill did both).
   */
  const [flash, setFlash] = useState<Flash | null>(null);
  // While the window opens and holds, the answer is not recorded yet: nothing else may navigate.
  // Once it closes (the step has already changed underneath) the wizard is usable again.
  const busy = flash !== null && !flash.committed;
  const flashId = useRef(0);
  const [back, setBack] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const go = useCallback((next: Step, isBack = false) => {
    setBack(isBack);
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);
  const nextOf = (s: Step): Step => FLOW[Math.min(FLOW.length - 1, FLOW.indexOf(s) + 1)]!;
  const prevOf = (s: Step): Step => FLOW[Math.max(0, FLOW.indexOf(s) - 1)]!;

  /** Single-choice answer: the tile expands to fill the screen, then collapses into the rail. */
  const choose = <K extends 'goal' | 'activity' | 'time'>(
    key: K,
    value: NonNullable<State[K]>,
    label: string,
    art: string,
    tile: HTMLElement,
  ) => {
    if (busy) return; // one choice at a time (keys 1–6 still reach the tiles under the layer)
    // a window that is still closing onto its pill gives way to the new choice
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (reduced) {
      setAnswers((a) => ({ ...a, [key]: value }));
      go(nextOf(step));
      return;
    }
    const next = nextOf(step);
    setFlash({
      id: ++flashId.current,
      key,
      value: String(value),
      label,
      art,
      from: windowOf(tile, 18),
      to: null,
      committed: false,
    });
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    // 1) the window opens (IRIS.open) and holds for a beat
    later((IRIS.open + IRIS.hold) * 1000, () => {
      // 2) under the full layer: record the answer (its pill appears in the rail) and change step
      setAnswers((a) => ({ ...a, [key]: value }));
      setFlash((f) => (f ? { ...f, committed: true } : f));
      go(next);
      // 3) once the rail has laid out, close the window onto the pill
      later(60, () => {
        const pill = document.querySelector<HTMLElement>(`[data-rail-pill="${key}"]`);
        const to = pill ? windowOf(pill, pill.getBoundingClientRect().height / 2) : 'fade';
        setFlash((f) => (f ? { ...f, to } : f));
        later(IRIS.close * 1000 + 40, () => setFlash(null));
      });
    });
  };

  // Keyboard: 1–6 choose, Enter continue, Esc back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      if (busy) return;
      if (e.key === 'Escape' && step !== 'safety') {
        e.preventDefault();
        go(prevOf(step), true);
        return;
      }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      const buttons = document.querySelectorAll<HTMLButtonElement>('[data-wizard-option]');
      buttons[n - 1]?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, flash]);

  const qIndex = QUESTION_STEPS.indexOf(step);
  const variants = {
    enter: reduced ? { opacity: 0 } : { opacity: 0, x: (back ? -60 : 60) * dir },
    center: { opacity: 1, x: 0, transition: { duration: reduced ? 0.15 : dur.md, ease: ease.out } },
    exit: reduced
      ? { opacity: 0, transition: { duration: 0.1 } }
      : { opacity: 0, x: (back ? 40 : -40) * dir, transition: { duration: 0.16, ease: ease.in } },
  };

  const railLabel = (
    s: Step,
  ): { label: string; art?: string; pill?: string; check?: boolean } | null => {
    if (s === 'goal' && answers.goal)
      return {
        label: t(`steps.goal.options.${answers.goal}`),
        art: GOAL_OPTIONS.find((g) => g.key === answers.goal)?.art,
        pill: 'goal',
      };
    if (s === 'activity' && answers.activity)
      return {
        label: tact(`${answers.activity}.label`),
        art: ACTIVITIES.find((a) => a.key === answers.activity)?.art,
        pill: 'activity',
      };
    if (s === 'habits' && answers.habits.length)
      return { label: String(answers.habits.length), check: true };
    if (s === 'time' && answers.time)
      return {
        label: t(`steps.time.options.${answers.time}`),
        art: TIMES.find((x) => x.key === answers.time)?.art,
        pill: 'time',
      };
    if (s === 'stats' && answers.stats) return { label: '', check: true };
    return null;
  };

  return (
    <LayoutGroup>
      <div
        className={cn(
          'relative min-h-[100svh] pt-24 pb-24 transition-colors duration-700',
          step === 'result' ? 'on-dark bg-green grain-light text-paper' : 'bg-paper text-ink',
        )}
      >
        {/* Progress rail */}
        {step !== 'safety' && (
          <div className="container-x">
            <ol
              className="-my-1.5 scrollbar-none flex gap-2 overflow-x-auto py-1.5"
              aria-label={t('progress', {
                current: Math.max(1, qIndex + 1),
                total: QUESTION_STEPS.length,
              })}
            >
              {QUESTION_STEPS.map((s, i) => {
                const done = railLabel(s);
                const active = s === step;
                return (
                  <li key={s} className="min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={!done && !active}
                      onClick={() => done && !busy && go(s, FLOW.indexOf(s) < FLOW.indexOf(step))}
                      className="group/rail block w-full text-start disabled:cursor-default"
                      aria-current={active ? 'step' : undefined}
                    >
                      <span
                        className={cn(
                          'block h-1 rounded-pill transition-colors duration-500',
                          active
                            ? step === 'result'
                              ? 'bg-citrus'
                              : 'bg-paprika'
                            : done
                              ? 'bg-current'
                              : 'bg-current/15',
                        )}
                      />
                      <span className="mt-2 flex h-9 items-center gap-2">
                        {done?.pill ? (
                          // the iris closes onto this pill (found by its data attribute)
                          <span
                            data-rail-pill={done.pill}
                            className="flex min-w-0 items-center gap-2 rounded-pill bg-current/10 py-1 ps-1 pe-3 transition-colors group-hover/rail:bg-current/20"
                          >
                            {done.art && <Ingredient name={done.art} className="size-6 shrink-0" />}
                            <span className="truncate text-[0.75rem] font-semibold">
                              {done.label}
                            </span>
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'flex items-center gap-1.5 truncate text-[0.75rem] font-semibold',
                              !done && 'opacity-50',
                            )}
                          >
                            {done?.check && (
                              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                                <path
                                  d="M4.5 12.5l5 5L19.5 7"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                            {done ? done.label : String(i + 1).padStart(2, '0')}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {step !== 'safety' && (
          <div className="container-x mt-5">
            <button
              type="button"
              onClick={() => !busy && go(prevOf(step), true)}
              className="group/back -ms-3 inline-flex h-11 items-center gap-2 rounded-pill px-3 text-ui font-semibold transition-colors hover:bg-current/10"
            >
              <ArrowIcon
                size={16}
                className="rotate-180 transition-transform duration-300 group-hover/back:-translate-x-0.5 rtl:rotate-0 rtl:group-hover/back:translate-x-0.5"
              />
              {tc('back')}
            </button>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className={cn('container-x', step === 'safety' ? 'mt-10 lg:mt-16' : 'mt-6 lg:mt-10')}
          >
            {step === 'safety' && (
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
                <div className="lg:col-span-7">
                  <p className="label text-ink-60">{t('title')}</p>
                  <h1 className="mt-5 font-display text-display-xl tracking-[-0.03em] ar:leading-[1.2] ar:font-bold ar:tracking-normal">
                    {t('title')}
                  </h1>
                  <p className="mt-6 max-w-xl text-lead text-ink-70">{t('lead')}</p>
                </div>
                <div className="lg:col-span-5">
                  <div className="border-[3px] border-ink p-6">
                    <h2 className="font-sans text-[1.5rem] leading-tight font-black ar:font-bold">
                      {t('safety.title')}
                    </h2>
                    <div className="mt-3 border-t-[8px] border-ink" />
                    <p className="mt-4 text-body">{t('safety.body')}</p>
                    <div className="mt-6">
                      <MotionButton
                        size="lg"
                        effect="magnetic"
                        icon={<ArrowIcon />}
                        onClick={() => {
                          if (validPreset)
                            setAnswers((a) => ({ ...a, goal: a.goal ?? validPreset }));
                          go(validPreset ? 'activity' : 'goal');
                        }}
                        autoFocus
                      >
                        {t('safety.ack')}
                      </MotionButton>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 'goal' && (
              <Question title={t('steps.goal.title')} hint={t('keyboardHint')}>
                <Options>
                  {GOAL_OPTIONS.map((o, i) => (
                    <Tile
                      key={o.key}
                      n={i + 1}
                      art={o.art}
                      selected={
                        answers.goal === o.key || (flash?.key === 'goal' && flash.value === o.key)
                      }
                      label={t(`steps.goal.options.${o.key}`)}
                      onPick={(el) =>
                        choose('goal', o.key, t(`steps.goal.options.${o.key}`), o.art, el)
                      }
                    />
                  ))}
                </Options>
              </Question>
            )}

            {step === 'activity' && (
              <Question title={t('steps.activity.title')} hint={t('keyboardHint')}>
                <Options>
                  {ACTIVITIES.map((o, i) => (
                    <Tile
                      key={o.key}
                      n={i + 1}
                      art={o.art}
                      selected={
                        answers.activity === o.key ||
                        (flash?.key === 'activity' && flash.value === o.key)
                      }
                      label={tact(`${o.key}.label`)}
                      sub={tact(`${o.key}.hint`)}
                      onPick={(el) => choose('activity', o.key, tact(`${o.key}.label`), o.art, el)}
                    />
                  ))}
                </Options>
              </Question>
            )}

            {step === 'habits' && (
              <Question title={t('steps.habits.title')} hint={t('steps.habits.hint')}>
                <div className="flex flex-wrap gap-3">
                  {HABITS.map((h) => (
                    <Chip
                      key={h}
                      selected={answers.habits.includes(h)}
                      onToggle={() =>
                        setAnswers((a) => ({
                          ...a,
                          habits: a.habits.includes(h)
                            ? a.habits.filter((x) => x !== h)
                            : [...a.habits, h],
                        }))
                      }
                      className="h-12 px-5 text-[1rem]"
                    >
                      {t(`steps.habits.options.${h}`)}
                    </Chip>
                  ))}
                </div>
                <div className="mt-10">
                  <MotionButton size="lg" icon={<ArrowIcon />} onClick={() => go('time')}>
                    {tc('continue')}
                  </MotionButton>
                </div>
              </Question>
            )}

            {step === 'time' && (
              <Question title={t('steps.time.title')} hint={t('keyboardHint')}>
                <Options cols={4}>
                  {TIMES.map((o, i) => (
                    <Tile
                      key={o.key}
                      n={i + 1}
                      art={o.art}
                      selected={
                        answers.time === o.key || (flash?.key === 'time' && flash.value === o.key)
                      }
                      label={t(`steps.time.options.${o.key}`)}
                      onPick={(el) =>
                        choose('time', o.key, t(`steps.time.options.${o.key}`), o.art, el)
                      }
                    />
                  ))}
                </Options>
              </Question>
            )}

            {step === 'stats' && (
              <StatsStep
                initial={answers.stats}
                onDone={(stats) => {
                  setAnswers((a) => ({ ...a, stats }));
                  go('result');
                }}
              />
            )}

            {step === 'result' && (
              <Result
                answers={answers}
                whatsapp={whatsapp}
                onRestart={() => {
                  setAnswers({ habits: [], stats: null });
                  go('goal', true);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {flash && <Iris key={flash.id} flash={flash} />}
      </div>
    </LayoutGroup>
  );
}

/** Seconds. Open → hold → (step changes underneath) → close onto the rail pill. */
const IRIS = { open: 0.5, hold: 0.22, close: 0.55 } as const;

/** A window on the full-screen layer: clip-path inset values (px) + corner radius. */
type IrisWindow = { top: number; right: number; bottom: number; left: number; radius: number };
type Flash = {
  /** one per choice: a new choice gets a fresh layer */
  id: number;
  key: 'goal' | 'activity' | 'time';
  value: string;
  label: string;
  art: string;
  from: IrisWindow;
  /** null while opening; then the pill to close onto, or 'fade' when there is none */
  to: IrisWindow | 'fade' | null;
  /** the answer is recorded and the step has changed underneath */
  committed: boolean;
};

function windowOf(el: HTMLElement, radius: number): IrisWindow {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    right: document.documentElement.clientWidth - r.right,
    bottom: window.innerHeight - r.bottom,
    radius,
  };
}
/** Corner radius of the window while it travels (px). The browser clamps a radius to half the
 *  window's height, so the same value lands as a perfect pill on the rail. */
const IRIS_RADIUS = 44;
/** The whole viewport. Flush with the screen its corners are square (see irisAt); the radius here
 *  is what they take the moment the window pulls away from the edges. */
const FULL: IrisWindow = { top: 0, right: 0, bottom: 0, left: 0, radius: IRIS_RADIUS };

/**
 * The window at progress `p` (0 → 1) between two rectangles, as a clip-path.
 * Its corners are round the whole way: the radius grows with the window and only gives way in
 * the last pixels before the window meets the viewport (where a round corner would let the page
 * show through) — so it never reads as a square box that rounds off at the end.
 */
function irisAt(from: IrisWindow, to: IrisWindow, p: number): string {
  const mix = (a: number, b: number) => a + (b - a) * p;
  const top = mix(from.top, to.top);
  const right = mix(from.right, to.right);
  const bottom = mix(from.bottom, to.bottom);
  const left = mix(from.left, to.left);
  const travel = from.radius + (IRIS_RADIUS - from.radius) * Math.min(1, p * 4);
  const radius = Math.min(travel, Math.max(top, right, bottom, left));
  return `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px round ${radius.toFixed(1)}px)`;
}

function Iris({ flash }: { flash: Flash }) {
  const closing = flash.to !== null;
  const clip = useMotionValue(irisAt(flash.from, FULL, 0));

  useEffect(() => {
    const from = flash.to === null ? flash.from : FULL;
    const to = flash.to === null || flash.to === 'fade' ? FULL : flash.to;
    const controls = animate(0, 1, {
      duration: flash.to === null ? IRIS.open : IRIS.close,
      ease: ease.inOut,
      onUpdate: (p) => clip.set(irisAt(from, to, p)),
    });
    return () => controls.stop();
  }, [clip, flash.from, flash.to]);

  return (
    <motion.div
      aria-hidden
      data-wizard-iris=""
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-ink text-paper"
      style={{ clipPath: clip }}
      initial={{ opacity: 1 }}
      // closing: stay solid while the window shrinks, then melt into the (lighter) pill
      animate={{ opacity: closing ? [1, 1, 0] : 1 }}
      transition={
        closing
          ? { duration: IRIS.close, times: [0, 0.72, 1], ease: 'linear' }
          : { duration: IRIS.open }
      }
    >
      <motion.div
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={closing ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
        transition={
          closing
            ? { duration: 0.16, ease: ease.in }
            : { duration: 0.3, ease: ease.out, delay: 0.22 }
        }
      >
        <Ingredient name={flash.art} className="size-40" />
        <p className="max-w-[18ch] text-center font-display text-display-md ar:font-bold">
          {flash.label}
        </p>
      </motion.div>
    </motion.div>
  );
}

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="max-w-4xl font-display text-display-lg tracking-[-0.025em] ar:leading-[1.3] ar:font-bold ar:tracking-normal">
        {title}
      </h1>
      <p className="mt-3 hidden text-[0.8125rem] text-ink-60 md:block">{hint}</p>
      <div className="mt-10">{children}</div>
    </div>
  );
}

function Options({ children, cols = 3 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2',
        cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  );
}

function Tile({
  n,
  art,
  label,
  sub,
  selected,
  onPick,
}: {
  n: number;
  art: string;
  label: string;
  sub?: string;
  selected: boolean;
  /** receives the tile element: the iris opens from its box */
  onPick: (tile: HTMLElement) => void;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      data-wizard-option
      onClick={(e) => onPick(e.currentTarget)}
      whileTap={{ scale: 0.97 }}
      transition={spring.soft}
      className={cn(
        'group/tile relative flex min-h-36 items-end justify-between gap-4 overflow-hidden rounded-[18px] border-[1.5px] p-5 text-start transition-colors duration-300 sm:min-h-44',
        selected ? 'border-ink bg-ink text-paper' : 'border-ink/20 bg-paper-2 hover:border-ink',
      )}
    >
      <span className="relative z-10 max-w-[70%]">
        <span className="block num text-[0.75rem] opacity-60">{n}</span>
        <span className="mt-2 block font-display text-[clamp(1.35rem,2.2vw,1.9rem)] leading-[1.08] ar:leading-[1.4] ar:font-bold">
          {label}
        </span>
        {sub && <span className="mt-1.5 block text-[0.8125rem] opacity-70">{sub}</span>}
      </span>
      <Ingredient
        name={art}
        className="absolute end-3 top-3 size-20 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/tile:scale-110 group-hover/tile:-rotate-12 sm:size-24"
      />
    </motion.button>
  );
}

function StatsStep({
  initial,
  onDone,
}: {
  initial: State['stats'];
  onDone: (s: State['stats']) => void;
}) {
  const t = useTranslations('wizard.steps.stats');
  const tc = useTranslations('tools.calc');
  const tcm = useTranslations('common');
  const [sex, setSex] = useState<'female' | 'male'>(initial?.sex ?? 'female');
  const [age, setAge] = useState(initial?.age ?? 32);
  const [heightCm, setHeight] = useState(initial?.heightCm ?? 165);
  const [weightKg, setWeight] = useState(initial?.weightKg ?? 66);
  const field = (
    label: string,
    value: number,
    set: (n: number) => void,
    min: number,
    max: number,
    unit: string,
  ) => (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-ui font-semibold">{label}</span>
        <span className="num-wide text-[1.75rem] leading-none">
          {value}
          <span className="ms-1 text-[0.875rem] text-ink-60">{unit}</span>
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="range mt-3 w-full"
        style={{ ['--pct' as string]: `${((value - min) / (max - min)) * 100}%` }}
        aria-valuetext={`${value} ${unit}`}
      />
    </label>
  );
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-5">
        <h1 className="font-display text-display-lg ar:leading-[1.3] ar:font-bold">{t('title')}</h1>
        <p className="mt-4 max-w-md text-lead text-ink-70">{t('hint')}</p>
      </div>
      <div className="space-y-8 lg:col-span-6 lg:col-start-7">
        <Tabs
          label={tc('sex')}
          value={sex}
          onChange={setSex}
          items={[
            { value: 'female', label: tc('female') },
            { value: 'male', label: tc('male') },
          ]}
        />
        {field(tc('age'), age, setAge, 18, 90, tc('years'))}
        {field(tc('height'), heightCm, setHeight, 140, 210, 'cm')}
        {field(tc('weight'), weightKg, setWeight, 40, 180, 'kg')}
        <div className="flex flex-wrap items-center gap-5">
          <MotionButton
            size="lg"
            icon={<ArrowIcon />}
            onClick={() => onDone({ sex, age, heightCm, weightKg })}
          >
            {tcm('continue')}
          </MotionButton>
          <button
            type="button"
            onClick={() => onDone(null)}
            className="text-ui font-semibold underline underline-offset-4"
          >
            {t('skip')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Result({
  answers,
  whatsapp,
  onRestart,
}: {
  answers: State;
  whatsapp: string;
  onRestart: () => void;
}) {
  const t = useTranslations('wizard.result');
  const tw = useTranslations('wizard');
  const tm = useTranslations('macros');
  const tact = useTranslations('tools.calc.activities');
  const tc = useTranslations('tools.calc');
  const locale = useLocale() as Locale;
  const [showForm, setShowForm] = useState(false);

  const calcGoal: CalcGoal =
    answers.goal === 'weight_down' ? 'lose' : answers.goal === 'weight_up' ? 'gain' : 'maintain';
  const energy = useMemo(() => {
    if (!answers.stats || !answers.activity) return null;
    const input = { ...answers.stats, activity: answers.activity };
    if (!isValidInput(input)) return null;
    // the same function as the calculator page, so both show identical numbers
    const c = calculate(input, calcGoal);
    return { range: c.range, tdee: c.tdee, macros: c.macros };
  }, [answers.stats, answers.activity, calcGoal]);
  const macros = energy?.macros ?? { protein: 25, carb: 45, fat: 13, kcal: 0 };

  const suggestions = [
    ...answers.habits.map((h) => t(`suggestions.${h}`)),
    t('suggestions.default_1'),
    t('suggestions.default_2'),
    t('suggestions.default_3'),
  ].slice(0, 3);
  const message = t('whatsappMessage', {
    goal: answers.goal ? tw(`steps.goal.options.${answers.goal}`) : '—',
    activity: answers.activity ? tact(`${answers.activity}.label`) : '—',
    time: answers.time ? tw(`steps.time.options.${answers.time}`) : '—',
  });

  return (
    <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-5">
        <p className="label text-sage">{t('eyebrow')}</p>
        <h1 className="mt-4 font-display text-display-xl tracking-[-0.03em] ar:leading-[1.2] ar:font-bold ar:tracking-normal">
          {t('title')}
        </h1>
        <div className="mt-10 flex flex-wrap items-center gap-8">
          <MacroRings
            protein={macros.protein}
            carb={macros.carb}
            fat={macros.fat}
            surface="dark"
            size={200}
            stroke={14}
            gap={7}
            play
          >
            {energy ? (
              <>
                <span className="num-wide text-[1.4rem] leading-none">
                  <Ticker value={energy.range.min} immediate />–
                  <Ticker value={energy.range.max} immediate />
                </span>
                <span className="mt-1 label text-[0.625rem] text-sage">{tc('perDay')}</span>
              </>
            ) : (
              <span className="max-w-[8rem] label text-[0.625rem] text-sage">
                {t('energyGeneric')}
              </span>
            )}
          </MacroRings>
          <ul className="space-y-2 text-[0.875rem]">
            {(['protein', 'carb', 'fat'] as const).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span
                  className={cn(
                    'size-2.5 rounded-full',
                    { protein: 'bg-protein', carb: 'bg-carb', fat: 'bg-fat' }[k],
                  )}
                  aria-hidden
                />
                {tm(k)}
              </li>
            ))}
          </ul>
        </div>
        {energy && (
          <p className="mt-6 max-w-sm text-[0.8125rem] text-sage">
            {t('energy')} · {tc('disclaimer')}
          </p>
        )}
      </div>

      <div className="lg:col-span-6 lg:col-start-7">
        <h2 className="label text-sage">{t('steps')}</h2>
        <ol className="mt-4 border-t-2 border-paper">
          {suggestions.map((s, i) => (
            <motion.li
              key={i}
              className="grid grid-cols-[3rem_1fr] gap-4 border-b border-paper/20 py-5"
              initial={{ opacity: 0, y: 14 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { delay: 0.3 + i * 0.12, duration: dur.lg, ease: ease.out },
              }}
            >
              <span className="num-display text-[2.25rem] leading-none text-citrus">{i + 1}</span>
              <p className="text-lead">{s}</p>
            </motion.li>
          ))}
        </ol>

        <h2 className="mt-12 label text-sage">{t('next')}</h2>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <ExternalButton
            href={whatsappHref(whatsapp, message)}
            newTab
            tone="citrus"
            size="lg"
            icon={<ChatIcon size={20} />}
          >
            {t('whatsapp')}
          </ExternalButton>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            aria-expanded={showForm}
            className="text-ui font-semibold underline underline-offset-4"
          >
            {t('form')}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8"
            >
              <WizardLeadForm
                answers={{
                  goal: answers.goal ?? 'regular',
                  activity: answers.activity ?? 'light',
                  habits: answers.habits,
                  time: answers.time ?? 't30',
                  stats: answers.stats,
                }}
                locale={locale}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={onRestart}
          className="mt-12 text-[0.8125rem] font-semibold text-sage underline underline-offset-4"
        >
          {t('restart')}
        </button>
      </div>
    </div>
  );
}
