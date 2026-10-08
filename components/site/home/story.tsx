'use client';

import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadGsap } from '@/lib/motion/gsap';
import { useDir, useMediaQuery, useMotionLevel } from '@/lib/motion/hooks';
import { dur, ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { SectionTag } from '@/components/site/section';
import { storyGraphics } from './story-graphics';

type Step = { title: string; body: string; meta: string };

/** background per step: paper → paper-2 → green → ink (text flips to paper on the dark two) */
/*
 * The step graphics are driven by the scroll position (drawn while scrolling down, un-drawn
 * while scrolling up). Pinned desktop version: fine pointers only — on touch screens (tablets
 * included) a pinned, scrubbed section fights the browser's own scrolling and toolbars, so they
 * get the stacked version, whose graphics follow the scroll too.
 */
const PINNED_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';
/**
 * Phones and tablets: a finger flicks the page far faster than a wheel, so a scrubbed drawing is
 * over before it can be read. There each graphic plays once, by itself, when it comes on screen.
 * Mouse-driven screens keep the scroll-driven version (both directions).
 */
const TOUCH_QUERY = '(pointer: coarse), (pointer: none)';
const AUTOPLAY_SECONDS = 2.4;
const BG = ['bg-paper', 'bg-paper-2', 'bg-green', 'bg-ink'] as const;
const isDark = (i: number) => i >= 2;
/** the same backgrounds as colours: the stepper's open circles are filled with the one behind them */
const SURFACE = [
  'var(--color-paper)',
  'var(--color-paper-2)',
  'var(--color-green)',
  'var(--color-ink)',
] as const;

export function Story() {
  const t = useTranslations('home.story');
  const steps = t.raw('steps') as Step[];
  const level = useMotionLevel();
  // Both variants are rendered and switched with CSS so the server HTML already has the right
  // layout per breakpoint (no post-hydration layout shift).
  return (
    <>
      <div className="lg:fine:hidden">
        <StackedStory
          steps={steps}
          eyebrow={t('eyebrow')}
          title={t('title')}
          still={level === 'reduced'}
          titleId="story-title"
        />
      </div>
      <div className="hidden lg:fine:block">
        {level === 'full' ? (
          <PinnedStory steps={steps} eyebrow={t('eyebrow')} title={t('title')} />
        ) : (
          <StackedStory
            steps={steps}
            eyebrow={t('eyebrow')}
            title={t('title')}
            still={level === 'reduced'}
            titleId="story-title-lg"
          />
        )}
      </div>
    </>
  );
}

function PinnedStory({ steps, eyebrow, title }: { steps: Step[]; eyebrow: string; title: string }) {
  const root = useRef<HTMLElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const progress = useMotionValue(0);
  const dir = useDir();

  // Layout effect on purpose: GSAP pins wrap the section in a .pin-spacer. The cleanup must
  // unwrap it BEFORE React removes the section on navigation; passive (useEffect) cleanups run
  // after removal and crash with "removeChild: not a child of this node".
  useLayoutEffect(() => {
    let revert: (() => void) | undefined;
    let cancelled = false;
    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled || !root.current) return;
      const ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        mm.add(PINNED_QUERY, () => {
          ScrollTrigger.create({
            trigger: root.current,
            start: 'top top',
            end: `+=${steps.length * 90}%`,
            pin: '.story-stage',
            scrub: true,
            onUpdate: (self) => {
              const p = self.progress;
              progress.set(p);
              // the line runs node to node: full once the last step is reached
              const fill = Math.min(1, (p * steps.length) / Math.max(1, steps.length - 1));
              if (line.current) line.current.style.transform = `scaleY(${fill})`;
              setActive(Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999)));
            },
          });
        });
      }, root);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [steps.length, progress]);

  const dark = isDark(active);

  return (
    <section ref={root} aria-labelledby="story-title-lg" className="relative">
      <div
        className={cn(
          'story-stage relative h-[100svh] overflow-hidden',
          dark ? 'on-dark text-paper' : 'text-ink',
        )}
      >
        {/* Colour layers cross-fade (opacity only → compositor-friendly). */}
        {BG.map((bg, i) => (
          <motion.div
            key={bg}
            aria-hidden
            className={cn('absolute inset-0', bg, i >= 2 && 'grain-light')}
            initial={false}
            animate={{ opacity: i <= active ? 1 : 0 }}
            transition={{ duration: dur.lg, ease: ease.inOut }}
          />
        ))}

        <div className="relative container-x grid h-full grid-cols-12 gap-x-6 pt-[clamp(5.5rem,14svh,7rem)] pb-[clamp(1.5rem,7svh,4rem)]">
          {/* Rail: step counter + drawing progress line along the inline-start edge */}
          <div className="col-span-2 flex flex-col">
            <SectionTag tone={dark ? 'cream' : 'green'}>{eyebrow}</SectionTag>
            {/* The stepper runs down the whole rail: a node per step, spread from top to bottom on
                one line. Done steps are filled with a drawn tick, the current one's ring fills as
                its part of the scroll goes by, the rest wait with their number. The lines sit
                OUTSIDE the list (a list's spacing would push them off the node centres). */}
            <div className="relative mt-10 mb-8 min-h-0 flex-1">
              <span
                aria-hidden
                className={cn(
                  'absolute start-[17px] top-[18px] bottom-[18px] w-[2px] rounded-full transition-colors duration-500',
                  dark ? 'bg-paper/15' : 'bg-ink/12',
                )}
              />
              <span
                ref={line}
                aria-hidden
                className={cn(
                  'absolute start-[17px] top-[18px] bottom-[18px] w-[2px] origin-top rounded-full transition-colors duration-500',
                  dark ? 'bg-citrus' : 'bg-ink',
                )}
                style={{ transform: 'scaleY(0)' }}
              />
              <ol className="relative flex h-full flex-col justify-between">
                {steps.map((s, i) => (
                  <StepNode
                    key={s.title}
                    index={i}
                    count={steps.length}
                    title={s.title}
                    state={i < active ? 'done' : i === active ? 'active' : 'next'}
                    dark={dark}
                    surface={SURFACE[active]!}
                    progress={progress}
                  />
                ))}
              </ol>
            </div>
          </div>

          <div className="col-span-5 flex flex-col">
            <h2
              id="story-title-lg"
              className="max-w-[26ch] font-display text-[clamp(1.5rem,2.2vw,2.1rem)] leading-[1.12] tracking-[-0.015em] ar:leading-[1.4] ar:font-bold ar:tracking-normal"
            >
              {title}
            </h2>
            <div className="relative mt-auto">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0, x: 30 * dir }}
                  animate={{ opacity: 1, x: 0, transition: { duration: dur.lg, ease: ease.out } }}
                  exit={{ opacity: 0, x: -20 * dir, transition: { duration: 0.25, ease: ease.in } }}
                >
                  <p
                    aria-hidden
                    className={cn(
                      // also bounded by the window height: the pinned stage is exactly one screen tall
                      'num-display text-[clamp(5rem,min(15vw,24svh),15rem)] leading-[0.8]',
                      dark ? 'text-citrus' : 'text-paprika-deep',
                    )}
                  >
                    {String(active + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-6 font-display text-display-md ar:leading-[1.3] ar:font-bold">
                    {steps[active]!.title}
                  </h3>
                  <p className={cn('mt-4 max-w-md text-lead', dark ? 'text-sage' : 'text-ink-70')}>
                    {steps[active]!.body}
                  </p>
                  <p className={cn('mt-6 label', dark ? 'text-sage' : 'text-ink-60')}>
                    {steps[active]!.meta}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="col-span-5 flex items-center">
            <div
              className={cn(
                // the graphic (5:4) never grows taller than the stage
                'mx-auto w-full max-w-[calc((100svh-13rem)*1.25)] transition-colors duration-500',
                dark ? 'text-paper' : 'text-ink',
              )}
            >
              <PinnedGraphic key={active} index={active} count={steps.length} progress={progress} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The active step's graphic, fed with the part of the pinned scroll that belongs to it: it is
 * complete at 70 % of its segment and holds there until the next step takes over.
 */
function PinnedGraphic({
  index,
  count,
  progress,
}: {
  index: number;
  count: number;
  progress: MotionValue<number>;
}) {
  const local = useTransform(progress, [index / count, (index + 0.7) / count], [0, 1]);
  const Graphic = storyGraphics[index]!;
  return <Graphic progress={local} />;
}

function StackedStory({
  steps,
  eyebrow,
  title,
  still,
  titleId,
}: {
  steps: Step[];
  eyebrow: string;
  title: string;
  still: boolean;
  titleId: string;
}) {
  return (
    <section aria-labelledby={titleId}>
      <div className="container-x pt-24 pb-10">
        <SectionTag>{eyebrow}</SectionTag>
        <h2
          id={titleId}
          className="mt-4 max-w-[22ch] font-display text-display-md leading-[1.08] ar:leading-[1.35] ar:font-bold"
        >
          {title}
        </h2>
      </div>
      {steps.map((s, i) => (
        <StackedStep key={s.title} step={s} index={i} still={still} />
      ))}
    </section>
  );
}

function StackedStep({ step, index, still }: { step: Step; index: number; still: boolean }) {
  const graphic = useRef<HTMLDivElement>(null);
  // mouse: 0 when the graphic's top enters the bottom of the screen → 1 when its centre reaches
  // the middle: it draws as you scroll it into view and un-draws when you scroll back up.
  const { scrollYProgress } = useScroll({ target: graphic, offset: ['start 0.95', 'center 0.5'] });
  const done = useMotionValue(1);
  // touch: 0 → 1 on a timer, started once when about half of the graphic is on screen
  const touch = useMediaQuery(TOUCH_QUERY);
  const inView = useInView(graphic, { once: true, amount: 0.45 });
  const auto = useMotionValue(0);
  useEffect(() => {
    if (!touch || still || !inView) return;
    const controls = animate(auto, 1, { duration: AUTOPLAY_SECONDS, ease: 'linear' });
    return () => controls.stop();
  }, [touch, still, inView, auto]);
  const Graphic = storyGraphics[index]!;
  const dark = isDark(index);
  return (
    <div className={cn('py-16', BG[index], dark ? 'on-dark grain-light text-paper' : 'text-ink')}>
      <div className="container-x grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
        <div>
          <p
            aria-hidden
            className={cn(
              'num-display text-[6.5rem] leading-[0.8]',
              dark ? 'text-citrus' : 'text-paprika-deep',
            )}
          >
            {String(index + 1).padStart(2, '0')}
          </p>
          <h3 className="mt-5 font-display text-display-md ar:leading-[1.3] ar:font-bold">
            {step.title}
          </h3>
          <p className={cn('mt-3 text-lead', dark ? 'text-sage' : 'text-ink-70')}>{step.body}</p>
          <p className={cn('mt-5 label', dark ? 'text-sage' : 'text-ink-60')}>{step.meta}</p>
        </div>
        <div ref={graphic} className="max-w-md">
          <Graphic progress={still ? done : touch ? auto : scrollYProgress} />
        </div>
      </div>
    </div>
  );
}

/** One step of the pinned stepper (see PinnedStory). */
function StepNode({
  index,
  count,
  title,
  state,
  dark,
  surface,
  progress,
}: {
  /** the section's current background (open circles hide the line behind them) */
  surface: string;
  index: number;
  count: number;
  title: string;
  state: 'done' | 'active' | 'next';
  dark: boolean;
  progress: MotionValue<number>;
}) {
  // this step's own share of the pinned scroll, 0 → 1
  const local = useTransform(progress, [index / count, (index + 1) / count], [0, 1]);
  const ink = dark ? 'var(--color-citrus)' : 'var(--color-ink)';
  return (
    <li
      className="relative flex items-start gap-3.5"
      aria-current={state === 'active' ? 'step' : undefined}
    >
      <span className="relative grid size-9 shrink-0 place-items-center">
        {state === 'active' && (
          // a soft pulse around the current step
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ background: ink }}
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 1.7], opacity: [0.22, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <svg viewBox="0 0 36 36" className="relative size-9 -rotate-90" aria-hidden>
          {/* base: filled when done, the section's colour otherwise (hides the line behind) */}
          <motion.circle
            cx="18"
            cy="18"
            r="16.5"
            initial={false}
            animate={{
              fill: state === 'done' ? ink : surface,
              stroke:
                state === 'next' ? (dark ? 'rgba(244,239,229,0.3)' : 'rgba(15,27,23,0.22)') : ink,
            }}
            strokeWidth="1.5"
            transition={{ duration: 0.35 }}
          />
          {state === 'active' && (
            <motion.circle
              cx="18"
              cy="18"
              r="16.5"
              fill="none"
              stroke={ink}
              strokeWidth="3"
              strokeLinecap="round"
              style={{ pathLength: local }}
            />
          )}
        </svg>
        {/* Tick and number live together in the same centred cell for good; only their
            visibility changes (the tick draws in / erases, the number fades). Swapping them in
            and out of the page moved the leaving one and let the other land off-centre. */}
        <span className="absolute inset-0 grid place-items-center">
          <motion.svg
            viewBox="0 0 16 16"
            className={cn('col-start-1 row-start-1 size-4', dark ? 'text-ink' : 'text-paper')}
            aria-hidden
            initial={false}
            animate={{ opacity: state === 'done' ? 1 : 0, scale: state === 'done' ? 1 : 0.7 }}
            transition={{ duration: 0.25, ease: ease.out }}
          >
            <motion.path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: state === 'done' ? 1 : 0 }}
              transition={{ duration: 0.35, ease: ease.out, delay: state === 'done' ? 0.08 : 0 }}
            />
          </motion.svg>
          <motion.span
            className={cn(
              'col-start-1 row-start-1 num text-[0.8125rem] leading-none font-semibold',
              state === 'active'
                ? dark
                  ? 'text-citrus'
                  : 'text-ink'
                : dark
                  ? 'text-paper/50'
                  : 'text-ink/45',
            )}
            aria-hidden={state === 'done' || undefined}
            initial={false}
            animate={{ opacity: state === 'done' ? 0 : 1, scale: state === 'done' ? 0.7 : 1 }}
            transition={{ duration: 0.25, ease: ease.out, delay: state === 'done' ? 0 : 0.1 }}
          >
            {index + 1}
          </motion.span>
        </span>
      </span>
      <span className="relative min-w-0 pt-[7px]">
        <span
          className={cn(
            'block text-[0.9375rem] leading-[22px] font-semibold transition-[color,translate] duration-500',
            state === 'active'
              ? cn('translate-x-0.5 rtl:-translate-x-0.5', dark ? 'text-citrus' : 'text-ink')
              : state === 'done'
                ? dark
                  ? 'text-paper/80'
                  : 'text-ink/75'
                : dark
                  ? 'text-paper/45'
                  : 'text-ink/40',
          )}
        >
          {title}
        </span>
      </span>
    </li>
  );
}
