'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { Tooltip as T } from 'radix-ui';
import { useFormatter, useTranslations } from 'next-intl';
import type { ComponentType, ReactNode } from 'react';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import type { DayScorePart } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import { DiaryIcon, MessageIcon, ProgramIcon, ProgressIcon } from '../icons';
import { ThemeButton } from '../theme';

/*
 * The top of the client's day, in the dietitian panel's shape (DESIGN.md v1.35): an ink card with
 * the greeting rising word by word, one row of small controls — what is waiting (with a count),
 * then shortcuts (icon only), each naming itself under the control on hover or focus — and, at the
 * end, the day's ring with the parts it is made of.
 */

type IconType = ComponentType<{ size?: number; className?: string }>;

export function TodayHero({
  eyebrow,
  greeting,
  streak,
  unread,
  openTasks,
  score,
  parts,
}: {
  eyebrow: string;
  greeting: string;
  streak: number;
  unread: number;
  /** null: the dietitian has shared no task */
  openTasks: number | null;
  /** 0…1 */
  score: number;
  parts: DayScorePart[];
}) {
  const t = useTranslations('portal.hub');
  const tn = useTranslations('portal.nav');
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const R = 30;
  const C = 2 * Math.PI * R;

  const chips: { key: string; href: string; label: string; count: number; Icon: IconType }[] = [
    {
      key: 'streak',
      href: '/panel/progress',
      label: t('streak', { count: streak }),
      count: streak,
      Icon: FlameIcon,
    },
    {
      key: 'unread',
      href: '/panel/messages',
      label: t('unread', { count: unread }),
      count: unread,
      Icon: MessageIcon,
    },
    ...(openTasks != null
      ? [
          {
            key: 'tasks',
            href: '#tasks',
            label: t('tasks.open', { count: openTasks }),
            count: openTasks,
            Icon: TickIcon,
          },
        ]
      : []),
  ];
  const doors: { href: string; label: string; Icon: IconType }[] = [
    { href: '/panel/diary', label: t('doors.diary'), Icon: DiaryIcon },
    { href: '/panel/program', label: t('doors.program'), Icon: ProgramIcon },
    { href: '/panel/progress', label: t('doors.progress'), Icon: ProgressIcon },
    { href: '/panel/help', label: tn('help'), Icon: HelpGlyph },
  ];
  const rise = (i: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: ease.out, delay: reduced ? 0 : 0.15 + i * 0.06 },
  });

  return (
    <section className="on-dark relative isolate mt-5 overflow-clip rounded-[22px] bg-ink px-5 py-5 text-paper sm:px-7 sm:py-6 lg:mt-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-32 -z-10 size-[28rem] rounded-full bg-[radial-gradient(circle,rgb(216_242_74/0.22),transparent_62%)] motion-safe:animate-[admin-drift_16s_ease-in-out_infinite_alternate]"
      />
      <svg
        aria-hidden
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -end-28 -bottom-40 -z-10 size-[26rem] text-paper/[0.07]"
      >
        {[190, 150, 110, 70].map((r) => (
          <circle
            key={r}
            cx="200"
            cy="200"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="label text-sage">{eyebrow}</p>
          <h1 className="mt-2 font-display text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.05] tracking-[-0.02em] ar:leading-[1.3] ar:font-bold">
            <span className="sr-only">{greeting}</span>
            <span aria-hidden className="flex flex-wrap gap-x-[0.25em]">
              {greeting.split(/\s+/).map((w, i) => (
                <span key={i} className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em]">
                  <motion.span
                    className="inline-block"
                    initial={{ y: reduced ? 0 : '105%', opacity: reduced ? 0 : 1 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      duration: reduced ? 0.15 : 0.75,
                      ease: ease.out,
                      delay: reduced ? 0 : 0.08 + i * 0.07,
                    }}
                  >
                    {w}
                  </motion.span>
                </span>
              ))}
            </span>
          </h1>

          <T.Provider delayDuration={120} skipDelayDuration={400} disableHoverableContent>
            <nav aria-label={t('doorsLabel')} className="mt-4 flex flex-wrap items-center gap-1.5">
              {chips.map((c, i) => (
                <motion.span key={c.key} {...rise(i)}>
                  <Tip label={c.label}>
                    <Link
                      href={c.href}
                      aria-label={c.label}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-pill px-2.5 text-[0.8125rem] font-semibold transition-[background-color,scale] active:scale-95',
                        c.count > 0
                          ? c.key === 'unread'
                            ? 'bg-paprika text-ink hover:bg-paprika/90'
                            : 'bg-citrus text-ink hover:bg-citrus/90'
                          : 'bg-paper/10 text-paper/80 hover:bg-paper/15',
                      )}
                    >
                      <c.Icon size={14} />
                      <span className="num">{c.count}</span>
                    </Link>
                  </Tip>
                </motion.span>
              ))}
              <span aria-hidden className="mx-1.5 h-5 w-px bg-paper/20" />
              {doors.map((d, i) => (
                <motion.span key={d.href} {...rise(chips.length + i)}>
                  <Tip label={d.label}>
                    <Link
                      href={d.href}
                      aria-label={d.label}
                      className="grid size-8 place-items-center rounded-full border border-paper/20 text-paper transition-[background-color,border-color,scale] hover:border-paper/40 hover:bg-paper/10 active:scale-95"
                    >
                      <d.Icon size={15} />
                    </Link>
                  </Tip>
                </motion.span>
              ))}
              <motion.span {...rise(chips.length + doors.length)}>
                <ThemeButton tone="dark" size={32} />
              </motion.span>
            </nav>
          </T.Provider>
        </div>

        {/* the day's ring and what it is made of */}
        <a
          href="#checkin"
          className="flex items-center gap-4 rounded-[16px] border border-paper/12 bg-paper/[0.06] p-3.5 transition-colors hover:bg-paper/10 lg:w-[21rem]"
        >
          <span className="relative size-[76px] shrink-0">
            <svg viewBox="0 0 76 76" className="size-full -rotate-90" aria-hidden>
              <circle
                cx="38"
                cy="38"
                r={R}
                fill="none"
                stroke="rgb(243 238 228 / 0.14)"
                strokeWidth="7"
              />
              <motion.circle
                cx="38"
                cy="38"
                r={R}
                fill="none"
                stroke="var(--color-citrus)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={C}
                initial={{ strokeDashoffset: reduced ? C * (1 - score) : C }}
                animate={{ strokeDashoffset: C * (1 - score) }}
                transition={{
                  duration: reduced ? 0 : 1.1,
                  ease: ease.out,
                  delay: reduced ? 0 : 0.25,
                }}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center num text-[1.125rem] font-semibold">
              {format.number(score, { style: 'percent', maximumFractionDigits: 0 })}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block label text-[0.625rem] text-sage">{t('ring')}</span>
            <span className="mt-2 flex flex-wrap gap-1" role="list" aria-label={t('ringParts')}>
              {parts.map((p) => (
                <span
                  key={p.key}
                  role="listitem"
                  className={cn(
                    'inline-flex h-6 items-center gap-1 rounded-pill px-2 text-[0.6875rem] font-semibold',
                    p.value >= 1
                      ? 'bg-citrus text-ink'
                      : p.value > 0
                        ? 'bg-paper/20 text-paper'
                        : 'bg-paper/[0.08] text-paper/60',
                  )}
                >
                  {p.value >= 1 && <TickIcon size={10} />}
                  {t(`parts.${p.key}`)}
                  {p.value > 0 && p.value < 1 && (
                    <span className="num opacity-80">
                      {format.number(p.value, { style: 'percent', maximumFractionDigits: 0 })}
                    </span>
                  )}
                  <span className="sr-only">{p.value >= 1 ? t('done') : ''}</span>
                </span>
              ))}
            </span>
          </span>
        </a>
      </div>
    </section>
  );
}

/** A name under its control on hover or keyboard focus (the dietitian panel's cream label). */
function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side="bottom"
          sideOffset={4}
          collisionPadding={8}
          className="z-[95] rounded-[8px] bg-paper px-2 py-1 text-[0.6875rem] leading-none font-semibold whitespace-nowrap text-ink shadow-[0_6px_16px_-6px_rgb(0_0_0/0.5)] ring-1 ring-ink/10 data-[state=closed]:hidden data-[state=delayed-open]:animate-[admin-pop_140ms_cubic-bezier(0.16,1,0.3,1)]"
        >
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

function FlameIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 1.5-4.5C10 10 11 8 12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TickIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HelpGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9M12 16.6v.1" />
    </svg>
  );
}
