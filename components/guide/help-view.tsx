'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import PINS from '@/lib/guide/pins.json';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { cn } from '@/lib/utils';
import { GuideFigure, type FigureKind } from './figure';

/*
 * "How to use it" (DESIGN.md v1.34), shared by the client portal (/panel/help) and the dietitian
 * panel (/admin/help): one topic per page of the product, each a picture with numbered pins and
 * the same numbers as steps. The step being read lights its pin; left alone, the steps walk by
 * themselves. A topic has its own address (#diary), so a page's "?" opens the right one.
 */

export interface HelpTopic {
  key: string;
  /** the page this topic is about, when it has one */
  href: string | null;
  figure: FigureKind;
  title: string;
  lead: string;
  steps: string[];
}

export interface HelpLabels {
  topics: string;
  open: string;
  prev: string;
  next: string;
  /** "{n}" is replaced */
  step: string;
  figure: string;
}

const SKIN = {
  portal: {
    vars: {
      '--g-bg': 'var(--color-paper)',
      '--g-soft': 'rgb(15 27 23 / 0.07)',
      '--g-mid': 'rgb(15 27 23 / 0.2)',
      '--g-ink': 'var(--color-ink)',
      '--g-acc': 'var(--color-green-3)',
      '--g-faint': 'rgb(243 238 228 / 0.22)',
      '--g-pin': 'var(--color-ink)',
      '--g-pin-text': 'var(--color-paper)',
      '--g-ring': 'var(--color-paper)',
      '--g-pin-on': 'var(--color-citrus)',
      '--g-pin-on-text': 'var(--color-ink)',
    },
    tab: 'h-10 rounded-pill border-[1.5px] px-4 text-[0.875rem] font-semibold',
    tabOn: 'border-ink bg-ink text-paper',
    tabOff: 'border-ink/20 text-ink hover:border-ink',
    stage: 'rounded-[20px] border-[1.5px] border-ink bg-paper p-3 shadow-print sm:p-5',
    title:
      'font-display text-[clamp(1.8rem,4vw,2.5rem)] leading-[1.05] ar:leading-[1.3] ar:font-bold',
    lead: 'text-[1rem] leading-relaxed text-ink-70',
    step: 'rounded-[14px] border-[1.5px] px-3.5 py-3 text-[0.9375rem] leading-relaxed',
    stepOn: 'border-ink bg-paper',
    stepOff: 'border-transparent bg-paper-2/70 hover:border-ink/25',
    num: 'bg-ink text-paper',
    numOn: 'bg-citrus text-ink',
    open: 'h-11 rounded-pill bg-ink px-5 text-[0.9375rem] font-semibold text-paper hover:bg-green',
    nav: 'h-11 rounded-pill border-[1.5px] border-ink/20 px-4 text-[0.875rem] font-semibold hover:border-ink disabled:opacity-35',
    muted: 'text-ink-60',
  },
  admin: {
    vars: {
      '--g-bg': 'var(--a-surface)',
      '--g-soft': 'color-mix(in srgb, var(--a-text) 7%, transparent)',
      '--g-mid': 'color-mix(in srgb, var(--a-text) 20%, transparent)',
      '--g-ink': 'var(--a-text)',
      '--g-acc': 'var(--a-ok)',
      '--g-faint': 'color-mix(in srgb, var(--a-surface) 30%, transparent)',
      '--g-pin': '#0f1b17',
      '--g-pin-text': '#f3eee4',
      '--g-ring': '#f3eee4',
      '--g-pin-on': 'var(--a-accent)',
      '--g-pin-on-text': 'var(--a-accent-text)',
    },
    tab: 'h-8 rounded-[10px] px-3 text-[0.8125rem] font-semibold',
    tabOn: 'bg-a-accent text-a-accent-text',
    tabOff: 'bg-a-surface-2 text-a-muted hover:text-a-text',
    stage: 'rounded-[16px] border border-a-border bg-a-surface p-3 sm:p-4',
    title: 'text-[1.5rem] leading-tight font-bold tracking-[-0.01em] text-a-text',
    lead: 'text-[0.9375rem] leading-relaxed text-a-muted',
    step: 'rounded-[12px] border px-3 py-2.5 text-[0.875rem] leading-relaxed text-a-text',
    stepOn: 'border-a-text bg-a-surface',
    stepOff: 'border-transparent bg-a-surface-2 hover:border-a-border',
    num: 'bg-a-text text-a-surface',
    numOn: 'bg-a-accent text-a-accent-text',
    open: 'h-9 rounded-[10px] bg-a-accent px-4 text-[0.8125rem] font-semibold text-a-accent-text hover:opacity-90',
    nav: 'h-9 rounded-[10px] border border-a-border px-3 text-[0.8125rem] font-semibold text-a-text hover:bg-a-surface-2 disabled:opacity-35',
    muted: 'text-a-muted',
  },
} as const;

export function HelpView({
  scope,
  topics,
  labels,
  theme = 'light',
}: {
  /** the dietitian panel's theme: its pictures exist in both */
  theme?: 'light' | 'dark';
  scope: keyof typeof SKIN;
  topics: HelpTopic[];
  labels: HelpLabels;
}) {
  const skin = SKIN[scope];
  const reduced = usePrefersReducedMotion();
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  /** the reader took over: the steps stop walking by themselves */
  const [held, setHeld] = useState(false);
  const tabs = useRef<HTMLDivElement>(null);
  const topic = topics[index]!;

  // the address picks the topic (a page's "?" links to its own)
  useEffect(() => {
    const fromHash = () => {
      const i = topics.findIndex((x) => x.key === window.location.hash.slice(1));
      if (i >= 0) {
        setIndex(i);
        setStep(0);
      }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [topics]);

  const go = (i: number) => {
    if (i < 0 || i >= topics.length) return;
    setIndex(i);
    setStep(0);
    setHeld(false);
    window.history.replaceState(null, '', `#${topics[i]!.key}`);
    tabs.current?.querySelector<HTMLElement>(`[data-topic="${topics[i]!.key}"]`)?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  // left alone, walk through the steps
  useEffect(() => {
    if (held || reduced) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % topic.steps.length), 3200);
    return () => window.clearInterval(id);
  }, [held, reduced, topic]);

  const pick = (i: number) => {
    setHeld(true);
    setStep(i);
  };

  return (
    <div style={skin.vars as CSSProperties}>
      <div
        ref={tabs}
        role="tablist"
        aria-label={labels.topics}
        className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pt-1.5 pb-2 sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {topics.map((x, i) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            id={`help-tab-${x.key}`}
            data-topic={x.key}
            aria-selected={i === index}
            aria-controls="help-panel"
            onClick={() => go(i)}
            className={cn(
              'inline-flex shrink-0 items-center whitespace-nowrap transition-colors duration-200',
              skin.tab,
              i === index ? skin.tabOn : skin.tabOff,
            )}
          >
            {x.title}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={topic.key}
          id="help-panel"
          role="tabpanel"
          aria-labelledby={`help-tab-${topic.key}`}
          initial={{ opacity: 0, y: reduced ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -6 }}
          transition={{ duration: reduced ? 0 : 0.28, ease: ease.out }}
          className="mt-4 grid grid-cols-1 items-start gap-5 lg:gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
        >
          <div className={cn('min-w-0 xl:sticky xl:top-6', skin.stage)} dir="ltr">
            <Shot
              key={topic.key}
              src={`/guide/${scope}/${locale}${theme === 'dark' ? '-dark' : ''}/${topic.key}.webp`}
              pins={
                (PINS as unknown as Record<string, ([number, number] | null)[]>)[
                  `${scope}/${locale}/${theme}/${topic.key}`
                ] ?? []
              }
              count={topic.steps.length}
              active={step}
              onPick={pick}
              label={`${labels.figure}: ${topic.title}`}
              reduced={reduced}
              fallback={
                <GuideFigure
                  kind={topic.figure}
                  pins={topic.steps.length}
                  active={step}
                  onPick={pick}
                  label={`${labels.figure}: ${topic.title}`}
                />
              }
            />
          </div>

          <div className="min-w-0">
            <h2 className={skin.title}>{topic.title}</h2>
            <p className={cn('mt-2.5 max-w-xl', skin.lead)}>{topic.lead}</p>
            <ol className="mt-5 space-y-2">
              {topic.steps.map((text, i) => {
                const on = i === step;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      aria-current={on ? 'step' : undefined}
                      onMouseEnter={() => pick(i)}
                      onFocus={() => pick(i)}
                      onClick={() => pick(i)}
                      className={cn(
                        'flex w-full items-start gap-3 text-start transition-colors duration-200',
                        skin.step,
                        on ? skin.stepOn : skin.stepOff,
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[0.75rem] font-bold transition-colors duration-200',
                          on ? skin.numOn : skin.num,
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="sr-only">{labels.step.replace('{n}', String(i + 1))}: </span>
                      <span className="min-w-0 flex-1">{text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {topic.href && (
                <Link
                  href={topic.href}
                  className={cn('inline-flex items-center transition-colors', skin.open)}
                >
                  {labels.open}
                </Link>
              )}
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => go(index - 1)}
                disabled={index === 0}
                className={cn('inline-flex items-center transition-colors', skin.nav)}
              >
                {labels.prev}
              </button>
              <span className={cn('num text-[0.8125rem]', skin.muted)}>
                {index + 1}/{topics.length}
              </span>
              <button
                type="button"
                onClick={() => go(index + 1)}
                disabled={index === topics.length - 1}
                className={cn('inline-flex items-center transition-colors', skin.nav)}
              >
                {labels.next}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * A real picture of the page (scripts/guide-shots.mjs) with a numbered pin on the control each
 * step is about — the positions were measured on the page when the picture was taken. On a narrow
 * screen the picture keeps a readable size and pans; the step being read is brought into view.
 * Without a picture (a new page not captured yet) the schematic stands in.
 */
function Shot({
  src,
  pins,
  count,
  active,
  onPick,
  label,
  reduced,
  fallback,
}: {
  src: string;
  pins: ([number, number] | null)[];
  count: number;
  active: number;
  onPick: (i: number) => void;
  label: string;
  reduced: boolean;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pin = pins[active];
  const px = pin?.[0];
  useEffect(() => {
    const el = box.current;
    if (!el || px == null || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({
      left: px * el.scrollWidth - el.clientWidth / 2,
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [px, reduced]);
  if (failed) return <>{fallback}</>;
  return (
    <div
      ref={box}
      className="[scrollbar-width:thin] overflow-x-auto overscroll-x-contain rounded-[10px]"
    >
      <div className="relative min-w-[36rem] md:min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized local captures; the pins are positioned over this exact box */}
        <img
          src={src}
          alt={label}
          width={1280}
          height={900}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="block h-auto w-full rounded-[10px]"
        />
        {pins.slice(0, count).map((p, i) => {
          if (!p) return null;
          const on = i === active;
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              aria-hidden
              onMouseEnter={() => onPick(i)}
              onClick={() => onPick(i)}
              style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%` }}
              className={cn(
                'absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[0.75rem] font-bold shadow-[0_2px_8px_rgb(0_0_0/0.35)] ring-2 ring-[var(--g-ring)] transition-[scale,background-color,color] duration-200',
                on
                  ? 'z-[2] scale-125 bg-[var(--g-pin-on)] text-[var(--g-pin-on-text)]'
                  : 'z-[1] bg-[var(--g-pin)] text-[var(--g-pin-text)]',
              )}
            >
              {on && !reduced && (
                <span className="absolute inset-0 animate-ping rounded-full bg-[var(--g-pin-on)] opacity-60" />
              )}
              <span className="relative">{i + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
