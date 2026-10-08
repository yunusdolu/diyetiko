'use client';

import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useLayoutEffect, useRef, useState } from 'react';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { Link } from '@/lib/i18n/navigation';
import { loadGsap } from '@/lib/motion/gsap';
import { useDir, useMotionLevel } from '@/lib/motion/hooks';
import { ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { SectionTag } from '@/components/site/section';
import type { WeekDay } from '@/types/content';

/**
 * Horizontal "example week". Desktop + full motion: pinned and scrubbed sideways; in RTL it
 * travels the other way (day 1 sits at the inline-start = right). Cards flip (rotateY, mirrored
 * in RTL) to reveal meals and per-meal energy bars. Phones and touch tablets: native swipe with scroll-snap, tap to flip.
 * Reduced motion: static grid, flip becomes a cross-fade.
 */
/** Same condition as the `pin:` CSS variant (globals.css). */
const PIN_QUERY =
  '(min-width: 1024px) and (hover: hover) and (pointer: fine) and (min-height: 600px)';

export function Week({ days }: { days: WeekDay[] }) {
  const t = useTranslations('home.week');
  const level = useMotionLevel();
  const dir = useDir();
  const root = useRef<HTMLElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  // Pinning: ScrollTrigger uses our own wrapper as its pin-spacer (pinSpacer below). Left to
  // itself it would wrap the section in a new <div> after load — MOVING it in the DOM, which
  // restarts every CSS animation inside (the headline played twice). The section carries w-full:
  // GSAP copies its display (flex) onto the wrapper before measuring, and a flex item without a
  // width would shrink to its content. Layout effect still, so the pin is reverted before React
  // removes the section on navigation.
  useLayoutEffect(() => {
    if (level !== 'full') return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    loadGsap().then(({ gsap }) => {
      if (cancelled || !root.current || !track.current) return;
      const ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        mm.add(PIN_QUERY, () => {
          const el = track.current!;
          const distance = () => Math.max(0, el.scrollWidth - el.clientWidth);
          gsap.to(el.querySelector('.week-rail'), {
            x: () => -distance() * dir,
            ease: 'none',
            scrollTrigger: {
              trigger: root.current,
              start: 'top top',
              end: () => `+=${distance()}`,
              pin: true,
              pinSpacer: spacer.current,
              scrub: 0.6,
              invalidateOnRefresh: true,
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
  }, [level, dir]);

  const max = Math.max(...days.flatMap((d) => d.meals.map((m) => m.kcal)), 1);

  return (
    <div ref={spacer}>
      <section
        ref={root}
        aria-labelledby="week-title"
        // clip sideways only: a card turning over swings out of its box above and below
        className="relative w-full overflow-x-clip bg-paper py-24 pin:flex pin:h-[100svh] pin:flex-col pin:justify-center pin:py-[clamp(1.5rem,5svh,4rem)]"
      >
        <div className="container-x grid grid-cols-1 gap-6 lg:grid-cols-12 pin:shrink-0">
          <div className="lg:col-span-2 lg:pt-2">
            <SectionTag tone="orange">{t('eyebrow')}</SectionTag>
          </div>
          <div className="lg:col-span-6">
            <h2
              id="week-title"
              className="font-display text-display-lg tracking-[-0.025em] ar:leading-[1.25] ar:font-bold ar:tracking-normal pin:text-[length:min(5rem,5.5vw,8.5svh)]"
            >
              {t('title')}
            </h2>
          </div>
          <p className="max-w-md text-body text-ink-70 lg:col-span-4 lg:pt-3">{t('lead')}</p>
        </div>

        <div
          ref={track}
          className={cn(
            // scroll-padding: snapped cards keep the page gutter instead of touching the edge.
            // A scrolling strip also clips vertically: py-12 (cancelled below by -mb-12) is the room
            // a card needs while it turns over — in perspective its near edge grows ~8 % taller.
            // pinned: fills the height left under the heading (19–30 rem); a mouse-driven strip that
            // is not pinned keeps its scrollbar, touch hides it
            '-mb-12 scroll-px-[var(--gutter)] overflow-x-auto overscroll-x-contain py-12 coarse:scrollbar-none pin:mt-[clamp(1.25rem,4svh,3rem)] pin:mb-0 pin:max-h-[30rem] pin:min-h-[19rem] pin:flex-1 pin:overflow-visible pin:py-0',
            level === 'reduced' ? '' : 'snap-x snap-mandatory pin:snap-none',
          )}
        >
          <ol
            className={cn(
              'week-rail flex w-max gap-4 px-[var(--gutter)] lg:gap-6 pin:h-full',
              level === 'reduced' && 'w-auto flex-wrap',
            )}
          >
            {days.map((day, i) => (
              <li key={i} className="snap-start pin:h-full">
                <DayCard
                  day={day}
                  index={i}
                  max={max}
                  name={(t.raw('days') as string[])[i] ?? String(i + 1)}
                />
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function DayCard({
  day,
  index,
  max,
  name,
}: {
  day: WeekDay;
  index: number;
  max: number;
  name: string;
}) {
  const t = useTranslations('home.week');
  const tm = useTranslations('meals');
  const locale = useLocale() as Locale;
  const dir = useDir();
  const level = useMotionLevel();
  const [flipped, setFlipped] = useState(false);
  const fmt = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const reduced = level === 'reduced';
  const hero = day.meals.find((m) => m.slot === 'lunch') ?? day.meals[0]!;

  return (
    <div className="group/card relative h-[27rem] w-[min(78vw,20rem)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] [container:week-card/size] [perspective:1200px] hover:-translate-y-1.5 lg:h-[30rem] lg:w-[22rem] pin:h-full">
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={reduced ? undefined : { rotateY: flipped ? 180 * dir : 0 }}
        transition={{ duration: 0.8, ease: ease.inOut }}
      >
        {/* Front: the day as a plate — its energy split in the hero's three rings, the total in
            the middle, the main meal underneath. */}
        <motion.div
          className={cn(
            'absolute inset-0 flex flex-col border-[1.5px] border-ink bg-paper-2 p-6 [backface-visibility:hidden] card-short:p-5',
            index % 2 === 1 && 'bg-[#efe3cf]',
          )}
          animate={reduced ? { opacity: flipped ? 0 : 1 } : undefined}
          aria-hidden={flipped}
        >
          <div className="flex items-start justify-between gap-3">
            {/* Semibold: at regular weight Bodoni's hairline 4 vanishes and "04" reads as "01". */}
            <p className="num-display text-[4.25rem] leading-[0.8] font-semibold text-paprika-deep card-short:text-[3.5rem] card-tiny:text-[3rem]">
              {String(index + 1).padStart(2, '0')}
            </p>
            <div className="flex flex-col items-end gap-2">
              <p className="label text-ink-60">{name}</p>
              {/* the day's meals, in order; the one shown below is filled */}
              <ol className="flex gap-1" aria-label={t('total')}>
                {day.meals.map((m, i) => (
                  <li
                    key={i}
                    title={tm(m.slot)}
                    className={cn(
                      'size-2 rounded-full border-[1.5px] border-ink',
                      m === hero && 'border-paprika-deep bg-paprika-deep',
                    )}
                  />
                ))}
              </ol>
            </div>
          </div>

          <DayRing day={day} total={fmt.format(day.total.kcal)} delay={index * 0.08} />

          <div className="mt-auto">
            <p className="label text-ink-60">{tm(hero.slot)}</p>
            <p className="mt-1.5 line-clamp-2 font-display text-[1.5rem] leading-[1.08] ar:leading-[1.35] ar:font-bold card-short:text-[1.3rem]">
              {hero.title}
            </p>
            {/* side by side when both fit; a narrow card (or a long translation) puts the button
                under the split — neither ever breaks over two lines */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-ink/15 pt-4 card-short:mt-3 card-short:pt-3 card-narrow:flex-col card-narrow:items-start">
              <MacroSplit day={day} />
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="group/flip inline-flex h-10 shrink-0 items-center gap-2 rounded-pill bg-ink px-4 text-[0.8125rem] font-semibold whitespace-nowrap text-paper transition-transform active:scale-95"
                aria-expanded={flipped}
                tabIndex={flipped ? -1 : 0}
              >
                {t('flip')}
                <span className="inline-flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/flip:rotate-180">
                  <FlipIcon />
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Back */}
        <motion.div
          className="on-dark absolute inset-0 flex [transform:rotateY(180deg)] flex-col bg-ink p-6 text-paper [backface-visibility:hidden] card-short:p-5"
          style={reduced ? { transform: 'none' } : undefined}
          animate={reduced ? { opacity: flipped ? 1 : 0 } : undefined}
          aria-hidden={!flipped}
        >
          <p className="flex justify-between label text-sage">
            <span>{name}</span>
            <span className="num">{fmt.format(day.total.kcal)} kcal</span>
          </p>
          <ul className="mt-5 flex-1 space-y-4 card-short:mt-3 card-short:space-y-2.5 card-tiny:space-y-1.5">
            {day.meals.map((m, i) => (
              <li key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.75rem] font-semibold text-sage">{tm(m.slot)}</p>
                  <p className="num text-[0.75rem] text-sage">{fmt.format(m.kcal)}</p>
                </div>
                {m.slug ? (
                  <Link
                    href={{ pathname: '/recipes/[slug]', params: { slug: m.slug } }}
                    tabIndex={flipped ? 0 : -1}
                    className="mt-0.5 block text-[0.9375rem] leading-snug font-semibold underline-offset-4 hover:underline card-tiny:text-[0.875rem]"
                  >
                    {m.title}
                  </Link>
                ) : (
                  <p className="mt-0.5 text-[0.9375rem] leading-snug font-semibold card-tiny:text-[0.875rem]">
                    {m.title}
                  </p>
                )}
                {m.extras.length > 0 && (
                  <p className="text-[0.75rem] text-sage card-tiny:hidden">
                    + {m.extras.join(', ')}
                  </p>
                )}
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-paper/10 card-short:mt-1 card-tiny:hidden">
                  <motion.div
                    className="h-full origin-left rounded-pill bg-citrus rtl:origin-right"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: flipped ? m.kcal / max : 0 }}
                    transition={{
                      duration: 0.9,
                      ease: ease.out,
                      delay: flipped ? 0.35 + i * 0.08 : 0,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setFlipped(false)}
            className="mt-4 inline-flex h-10 items-center gap-2 self-start rounded-pill bg-citrus px-4 text-[0.8125rem] font-semibold whitespace-nowrap text-ink transition-transform active:scale-95 card-short:mt-3"
            tabIndex={flipped ? 0 : -1}
          >
            {t('flipBack')}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden className="mirror-rtl">
      <path
        d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 3v4h-4M6 21v-4h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Energy from protein / carbohydrate / fat (4 / 4 / 9 kcal per gram), as shares of the day. */
function energySplit(t: WeekDay['total']) {
  const p = t.protein * 4;
  const c = t.carb * 4;
  const f = t.fat * 9;
  const sum = p + c + f || 1;
  return { protein: p / sum, carb: c / sum, fat: f / sum };
}

/** The day's split as the hero plate's three rings, drawn in when the card comes into view. */
function DayRing({ day, total, delay }: { day: WeekDay; total: string; delay: number }) {
  const level = useMotionLevel();
  const reduced = level === 'reduced';
  const split = energySplit(day.total);
  const rings = [
    { key: 'protein', r: 88, color: 'var(--color-protein-on-light)', share: split.protein },
    { key: 'carb', r: 74, color: 'var(--color-carb-on-light)', share: split.carb },
    { key: 'fat', r: 60, color: 'var(--color-fat-on-light)', share: split.fat },
  ] as const;
  return (
    <div className="relative mx-auto my-auto grid aspect-square w-[min(12rem,64%)] place-items-center py-2 card-short:w-[min(8.5rem,46%)] card-tiny:hidden">
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        {rings.map((ring, i) => (
          <g key={ring.key}>
            <circle
              cx="100"
              cy="100"
              r={ring.r}
              fill="none"
              stroke="currentColor"
              strokeOpacity=".1"
              strokeWidth="9"
            />
            <motion.circle
              cx="100"
              cy="100"
              r={ring.r}
              fill="none"
              stroke={ring.color}
              strokeWidth="9"
              strokeLinecap="round"
              initial={{ pathLength: reduced ? ring.share : 0 }}
              whileInView={{ pathLength: ring.share }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{
                duration: 1.1,
                ease: ease.out,
                delay: reduced ? 0 : 0.15 + delay + i * 0.12,
              }}
            />
          </g>
        ))}
      </svg>
      <p className="relative text-center leading-none">
        <span className="block num text-[1.25rem] font-semibold tracking-tight card-short:text-[1rem]">
          {total}
        </span>
        <span className="mt-1 block label text-[0.5625rem] text-ink-60">kcal</span>
      </p>
    </div>
  );
}

/** One line under the meal: the day's energy split, in the rings' colours. */
function MacroSplit({ day }: { day: WeekDay }) {
  const tm = useTranslations('macros');
  const locale = useLocale() as Locale;
  const split = energySplit(day.total);
  const pct = new Intl.NumberFormat(intlLocale(locale), { style: 'percent' });
  const items = [
    ['protein', split.protein, 'bg-protein-on-light'],
    ['carb', split.carb, 'bg-carb-on-light'],
    ['fat', split.fat, 'bg-fat-on-light'],
  ] as const;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem]">
      {items.map(([k, v, swatch]) => (
        <span key={k} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={cn('inline-block size-2 rounded-full', swatch)} aria-hidden />
          <span className="text-ink-60">{tm(`short.${k}`)}</span>
          <span className="num font-semibold">{pct.format(v)}</span>
        </span>
      ))}
    </p>
  );
}
