'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useLayoutEffect, useRef, useState } from 'react';
import { loadGsap } from '@/lib/motion/gsap';
import { useFinePointer, useMotionLevel } from '@/lib/motion/hooks';
import { spring } from '@/lib/motion';
import { cn, whatsappHref } from '@/lib/utils';
import { intlLocale, type Locale } from '@/lib/i18n/config';
import { KineticHeadline } from '@/components/motion/kinetic-headline';
import { ArrowIcon } from '@/components/ui/motion-button';
import { DrawUnderline, MotionLink } from '@/components/ui/motion-link';
import { ChatIcon } from '@/components/site/whatsapp-fab';
import { SectionTag } from '@/components/site/section';
import { Ticker } from '@/components/ui/ticker';
import { Plate } from './plate';

/** Example plate energy split (clearly labelled as an example on screen). */
const EXAMPLE = { protein: 0.25, carb: 0.45, fat: 0.3 } as const;

export function Hero({
  lines,
  lead,
  whatsapp,
}: {
  lines: string[];
  lead: string;
  whatsapp: string;
}) {
  const t = useTranslations('home.hero');
  const tm = useTranslations('macros');
  const locale = useLocale();
  const level = useMotionLevel();
  const fine = useFinePointer();
  const section = useRef<HTMLElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const [dataOn, setDataOn] = useState(false);
  const pct = (v: number) =>
    new Intl.NumberFormat(intlLocale(locale as Locale), { style: 'percent' }).format(v);

  // Pointer follow (desktop, fine pointer, full motion): the plate slides like a dish on a table.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, spring.follow);
  const sy = useSpring(py, spring.follow);
  const follow = fine && level === 'full';

  const onPointerMove = (e: React.PointerEvent) => {
    if (!follow || !plateRef.current) return;
    const r = plateRef.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const max = 26;
    px.set(Math.max(-max, Math.min(max, dx * 0.05)));
    py.set(Math.max(-max, Math.min(max, dy * 0.05)));
  };

  // Pinning: ScrollTrigger uses our own wrapper as its pin-spacer (pinSpacer below). Left to
  // itself it would wrap the section in a new <div> after load — MOVING it in the DOM, which
  // restarts every CSS animation inside (the headline played twice). The section carries w-full:
  // GSAP copies its display (flex) onto the wrapper before measuring, and a flex item without a
  // width would shrink to its content. Layout effect still, so the pin is reverted before React
  // removes the section on navigation.
  useLayoutEffect(() => {
    const root = section.current;
    if (!root) return;
    const rings = {
      protein: root.querySelector<SVGCircleElement>('.ring-protein'),
      carb: root.querySelector<SVGCircleElement>('.ring-carb'),
      fat: root.querySelector<SVGCircleElement>('.ring-fat'),
    };

    if (level === 'reduced') {
      // Designed static composition: plate stays, rings already drawn, data visible.
      for (const k of ['protein', 'carb', 'fat'] as const) {
        rings[k]?.setAttribute('stroke-dashoffset', String(1 - EXAMPLE[k]));
        rings[k]?.setAttribute('opacity', '1');
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDataOn(true);
      return;
    }

    let revert: (() => void) | undefined;
    let cancelled = false;
    loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        const build = () => {
          const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
          tl.to(
            '.food-veg',
            {
              x: -150,
              y: -30,
              rotate: -24,
              scale: 0.72,
              opacity: 0,
              duration: 1,
              transformOrigin: '50% 50%',
            },
            0,
          )
            .to(
              '.food-protein',
              {
                x: 130,
                y: -120,
                rotate: 28,
                scale: 0.72,
                opacity: 0,
                duration: 1,
                transformOrigin: '50% 50%',
              },
              0.08,
            )
            .to(
              '.food-grain',
              {
                x: 120,
                y: 140,
                rotate: 18,
                scale: 0.72,
                opacity: 0,
                duration: 1,
                transformOrigin: '50% 50%',
              },
              0.16,
            )
            .to(
              '.food-garnish',
              { x: 40, y: 170, rotate: 50, opacity: 0, duration: 0.8, transformOrigin: '50% 50%' },
              0.1,
            )
            .to(
              '.plate-well',
              { scale: 0.55, opacity: 0, svgOrigin: '300 300', duration: 0.8 },
              0.35,
            )
            .to(
              '.plate-rim',
              { scale: 0.86, opacity: 0.12, svgOrigin: '300 300', duration: 0.9 },
              0.45,
            )
            .to('.plate-pill', { opacity: 0, y: 20, duration: 0.4 }, 0.2)
            .to('.ring-track', { strokeOpacity: 0.12, duration: 0.6 }, 0.5)
            // attr: the CSS plugin rounds px values, which kills a normalised (pathLength=1) dash.
            .to(
              '.ring-protein',
              { attr: { 'stroke-dashoffset': 1 - EXAMPLE.protein, opacity: 1 }, duration: 1 },
              0.6,
            )
            .to(
              '.ring-carb',
              { attr: { 'stroke-dashoffset': 1 - EXAMPLE.carb, opacity: 1 }, duration: 1 },
              0.72,
            )
            .to(
              '.ring-fat',
              { attr: { 'stroke-dashoffset': 1 - EXAMPLE.fat, opacity: 1 }, duration: 1 },
              0.84,
            )
            .fromTo(
              '.hero-data',
              { opacity: 0, y: 24 },
              { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
              1.2,
            );
          return tl;
        };

        const mm = gsap.matchMedia();
        // Desktop (mouse, landscape): pinned, the plate slides beside the headline.
        mm.add('(min-width: 1024px) and (orientation: landscape) and (pointer: fine)', () => {
          const tl = build();
          // The plate slides from the edge toward the middle so the finished rings are whole,
          // while the copy steps back.
          tl.to('.hero-copy', { y: -60, opacity: 0.12, duration: 1.6, ease: 'none' }, 0);
          tl.to(
            '.plate-stage',
            {
              xPercent: -34 * (document.documentElement.dir === 'rtl' ? -1 : 1),
              yPercent: 4,
              duration: 1.2,
              ease: 'power2.inOut',
            },
            0.3,
          );
          tl.eventCallback('onUpdate', () => setDataOn(tl.progress() > 0.82));
          gsap
            .timeline({
              scrollTrigger: {
                trigger: root,
                start: 'top top',
                end: '+=110%',
                pin: true,
                pinSpacer: spacer.current,
                scrub: 0.7,
                anticipatePin: 1,
              },
            })
            .add(tl);
        });
        // Phones and tablets: a finger flicks past a scrubbed animation before it can be read, so
        // the plate turns into rings ONCE, by itself, when the whole plate is on screen. Where
        // it is already there at load (landscape tablets) it waits for the first bit of scroll.
        mm.add('(pointer: coarse), (pointer: none)', () => {
          const tl = build().pause();
          tl.eventCallback('onUpdate', () => setDataOn(tl.progress() > 0.82));
          const stage = root.querySelector<HTMLElement>('.plate-stage')!;
          gsap.timeline({
            scrollTrigger: {
              trigger: stage,
              start: () =>
                Math.max(
                  48,
                  stage.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35,
                ),
              once: true,
              onEnter: () => tl.duration(2.4).play(),
            },
          });
        });
        // Mouse, but a narrow or upright window (no pin): still driven by the scroll, both ways.
        mm.add(
          '(pointer: fine) and (max-width: 1023px), (pointer: fine) and (orientation: portrait)',
          () => {
            const tl = build();
            tl.eventCallback('onUpdate', () => setDataOn(tl.progress() > 0.82));
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: '.plate-stage',
                  // starts once the whole plate is on screen (the reader sees the food first);
                  // clamp(): where the plate already sits high at load (landscape tablets), start
                  // at the top of the page instead of half-way through
                  start: 'clamp(top 35%)',
                  end: 'clamp(bottom 45%)',
                  scrub: 0.5,
                },
              })
              .add(tl);
          },
        );
      }, root);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [level]);

  const legend = (['protein', 'carb', 'fat'] as const).map((k) => ({
    key: k,
    label: tm(k),
    value: EXAMPLE[k] * 100,
    swatch: { protein: 'bg-protein-on-light', carb: 'bg-carb-on-light', fat: 'bg-fat-on-light' }[k],
  }));

  return (
    <div ref={spacer}>
      <section
        ref={section}
        onPointerMove={onPointerMove}
        className="relative isolate w-full overflow-hidden pt-24 pb-16 wide:flex wide:min-h-[100svh] wide:flex-col wide:pt-[clamp(5.75rem,13svh,7rem)] wide:pb-[clamp(1rem,4svh,2.5rem)]"
      >
        <div className="container-x grid flex-1 grid-cols-4 gap-x-4 md:grid-cols-8 wide:grid-cols-12 wide:gap-x-6">
          {/* Marginalia rail */}
          {/* The rail reads top to bottom like a margin note: where we are, how to go on (a dot
              running down the line), and what the plate is made of — three bars in the plate's own
              colours that fill in after the headline has risen. */}
          <aside className="hidden flex-col border-e border-ink/10 pe-6 wide:col-span-2 wide:flex">
            <SectionTag>{t('margin')}</SectionTag>

            <div className="relative my-8 flex min-h-24 flex-1 items-center gap-3 short:hidden">
              <span
                className="relative block h-full max-h-56 min-h-24 w-px overflow-hidden bg-ink/12"
                aria-hidden
              >
                <span className="absolute inset-x-0 top-0 h-10 animate-[scroll-hint_2.2s_var(--ease-in-out-quart)_infinite] bg-gradient-to-b from-transparent via-ink to-transparent motion-reduce:animate-none" />
              </span>
              <span className="label text-[0.625rem] text-ink-60 [writing-mode:vertical-rl] rtl:[writing-mode:vertical-lr] ar:text-[0.75rem]">
                {t('scrollHint')}
              </span>
            </div>

            <div className="space-y-4 pb-2">
              <ul className="space-y-2.5" aria-label={t('plateLabel')}>
                {legend.map((l, i) => (
                  <li key={l.key} className="space-y-1">
                    <span className="flex items-baseline justify-between gap-2 text-[0.75rem]">
                      <span className="flex items-center gap-1.5 font-semibold text-ink-70">
                        <span
                          className={cn('inline-block size-2 rounded-full', l.swatch)}
                          aria-hidden
                        />
                        {l.label}
                      </span>
                      <span className="num text-ink">{pct(l.value / 100)}</span>
                    </span>
                    <span
                      className="relative block h-[3px] overflow-hidden rounded-pill bg-ink/10"
                      aria-hidden
                    >
                      <span
                        className={cn('rail-bar absolute inset-y-0 start-0 rounded-pill', l.swatch)}
                        style={{ width: `${l.value}%`, ['--i' as string]: i }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="max-w-[12rem] text-[0.75rem] leading-snug text-ink-60">
                {t('plateCaption')}
              </p>
            </div>
          </aside>

          <div className="relative col-span-4 md:col-span-8 wide:col-span-10">
            <div className="hero-copy relative z-10">
              <SectionTag className="mb-5 md:mb-10 wide:hidden">{t('margin')}</SectionTag>
              <KineticHeadline
                lines={lines}
                locale={locale}
                accent={1}
                className="font-display text-[14.6vw] leading-[0.88] font-medium tracking-[-0.035em] text-ink md:text-[12vw] ar:text-[13.5vw] ar:leading-[1.18] ar:font-bold ar:tracking-normal ar:md:text-[10vw] wide:text-[clamp(3.5rem,min(10.4vw,16.5svh),11.5rem)] ar:wide:text-[clamp(3rem,min(8.6vw,13.5svh),9.25rem)]"
                lineClassName={(i) =>
                  i === 1
                    ? 'text-paprika-deep ps-[0.6em] ar:ps-[0.4em]'
                    : i === 2
                      ? 'ps-[0.15em]'
                      : ''
                }
              />

              <div className="mt-10 max-w-[30rem] wide:mt-[clamp(1.25rem,6svh,3.5rem)]">
                <p className="text-lead text-ink-70">{lead}</p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <MotionLink href="/goal" size="lg" effect="magnetic" icon={<ArrowIcon />}>
                    {t('ctaPrimary')}
                  </MotionLink>
                  <a
                    href={whatsappHref(whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/draw inline-flex items-center gap-2.5 text-[1.0625rem] font-semibold text-ink coarse:min-h-11"
                  >
                    <ChatIcon size={20} />
                    <DrawUnderline>{t('ctaSecondary')}</DrawUnderline>
                  </a>
                </div>
              </div>
            </div>

            {/* Plate stage — overlaps the headline on desktop, bleeds off the inline-end edge. */}
            <div
              className="plate-stage pointer-events-none relative -me-[22vw] mt-10 w-[118vw] max-w-none sm:-me-[10vw] sm:w-[90vw] wide:absolute wide:-end-[7vw] wide:top-[4%] wide:mt-0 wide:w-[min(52vw,800px,92svh)]"
              ref={plateRef}
            >
              <motion.div style={follow ? { x: sx, y: sy } : undefined} className="relative">
                <Plate className="h-auto w-full" />
                <p className="plate-pill absolute start-[30%] bottom-[9%] rotate-[-6deg] rounded-pill bg-ink px-3 py-1.5 label text-[0.625rem] text-paper ar:text-[0.75rem]">
                  {t('plateLabel')}
                </p>
                {level !== 'reduced' && (
                  // After the plate turns into rings, the legend sits in the middle of them.
                  <div
                    className="hero-data absolute top-1/2 left-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 opacity-0"
                    aria-live="off"
                  >
                    <p className="text-center label text-ink-60">{t('plateLabel')}</p>
                    <dl className="mt-3 space-y-2.5">
                      {legend.map((l) => (
                        <div
                          key={l.key}
                          className="flex items-baseline justify-between gap-3 border-t border-ink/25 pt-2.5"
                        >
                          <dt className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                            <span
                              className={cn('inline-block size-2.5 rounded-full', l.swatch)}
                              aria-hidden
                            />
                            {l.label}
                          </dt>
                          <dd className="num-wide text-[clamp(1.4rem,2.3vw,2.25rem)] leading-none">
                            <Ticker
                              value={dataOn ? l.value / 100 : 0}
                              immediate
                              duration={0.9}
                              format="percent"
                            />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </motion.div>
            </div>

            {level === 'reduced' && (
              <dl className="relative z-10 mt-4 grid max-w-md grid-cols-1 gap-4 sm:grid-cols-3">
                {legend.map((l) => (
                  <div key={l.key} className="border-t-2 border-ink pt-3">
                    <dt className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                      <span
                        className={cn('inline-block size-2.5 rounded-full', l.swatch)}
                        aria-hidden
                      />
                      {l.label}
                    </dt>
                    <dd className="mt-1 num-wide text-[2rem] leading-none">{pct(l.value / 100)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mt-4 max-w-sm text-[0.75rem] leading-snug text-ink-60 wide:hidden">
              {t('plateCaption')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
