'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { Tooltip as T } from 'radix-ui';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import type { AgendaItem } from '@/lib/admin/insights';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { todayISO } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import { NavIcon, type NavKey } from '@/components/admin/nav';

/**
 * The top of the day, in the site's own voice: an ink card with the greeting, three numbers that
 * matter right now (each one a shortcut) and the next appointment with a ring that closes as it
 * gets nearer (full within the last three hours).
 */
export function DashboardHero({
  eyebrow,
  greeting,
  counts,
  items,
  actions,
}: {
  eyebrow: string;
  greeting: string;
  counts: { appointments: number; unread: number; attention: number };
  /** today's and tomorrow's agenda (the next scheduled one today is picked here, live) */
  items: AgendaItem[];
  actions: { href: string; label: string; icon: NavKey }[];
}) {
  const t = useTranslations('admin.dashboard');
  const ta = useTranslations('admin.appointments');
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const now = useNow({ updateInterval: 30_000 });
  const today = todayISO(now);
  const next = items.find(
    (a) =>
      a.status === 'scheduled' &&
      Date.parse(a.starts_at) > now.getTime() &&
      todayISO(new Date(a.starts_at)) === today,
  );
  const minutes = next ? (Date.parse(next.starts_at) - now.getTime()) / 6e4 : null;
  const ring = minutes == null ? 0 : Math.max(0.04, Math.min(1, 1 - minutes / 180));

  const chips = [
    { key: 'appointments', href: '#agenda', count: counts.appointments },
    { key: 'unread', href: '/admin/messages', count: counts.unread },
    { key: 'attention', href: '#attention', count: counts.attention },
  ] as const;

  return (
    <section className="relative isolate overflow-clip rounded-[22px] bg-ink px-5 py-5 text-paper shadow-[var(--a-shadow-card)] sm:px-7 sm:py-6 dark:border dark:border-a-border">
      {/* slow drifting light: the only "ambient" motion in the panel */}
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
        <div>
          <p className="flex flex-wrap items-center gap-x-2 label text-sage">
            {eyebrow}
            <span aria-hidden className="size-1 rounded-full bg-sage/60" />
            <RollingTime now={now} label={t('clock')} />
          </p>
          {/* the greeting rises word by word from behind a mask */}
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
          {/* One row: what is waiting (icon + count), then the shortcuts (icon only). Each says
              what it is on hover or focus — in a layer of its own, so the card cannot clip it —
              and always to assistive tech. */}
          <T.Provider delayDuration={120} skipDelayDuration={400} disableHoverableContent>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {chips.map((c, i) => (
                <motion.span
                  key={c.key}
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: ease.out,
                    delay: reduced ? 0 : 0.15 + i * 0.06,
                  }}
                >
                  <Tip label={t(`summary.${c.key}`, { count: c.count })}>
                    <Link
                      href={c.href}
                      aria-label={t(`summary.${c.key}`, { count: c.count })}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-pill px-2.5 text-[0.8125rem] font-semibold transition-[background-color,scale] active:scale-95',
                        c.count > 0
                          ? c.key === 'attention'
                            ? 'bg-paprika text-ink hover:bg-paprika/90'
                            : 'bg-citrus text-ink hover:bg-citrus/90'
                          : 'bg-paper/10 text-paper/80 hover:bg-paper/15',
                      )}
                    >
                      <ChipIcon kind={c.key} />
                      <span className="num">{c.count}</span>
                    </Link>
                  </Tip>
                </motion.span>
              ))}
              <span aria-hidden className="mx-1.5 h-5 w-px bg-paper/20" />
              {actions.map((a, i) => (
                <motion.span
                  key={a.href}
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: ease.out,
                    delay: reduced ? 0 : 0.33 + i * 0.06,
                  }}
                >
                  <Tip label={a.label}>
                    <Link
                      href={a.href}
                      aria-label={a.label}
                      className="relative grid size-8 place-items-center rounded-full border border-paper/20 text-paper transition-[background-color,border-color,scale] hover:border-paper/40 hover:bg-paper/10 active:scale-95"
                    >
                      <NavIcon name={a.icon} size={15} />
                      <span
                        aria-hidden
                        className="absolute -end-1 -top-1 grid size-3.5 place-items-center rounded-full bg-citrus text-ink"
                      >
                        <svg viewBox="0 0 24 24" width="9" height="9">
                          <path
                            d="M12 5v14M5 12h14"
                            stroke="currentColor"
                            strokeWidth="3.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    </Link>
                  </Tip>
                </motion.span>
              ))}
            </div>
          </T.Provider>
        </div>

        {/* next appointment */}
        <div className="flex items-center gap-4 rounded-[18px] bg-paper/[0.06] p-3.5 backdrop-blur-sm lg:min-w-[18rem]">
          <div className="relative size-[68px] shrink-0">
            <svg viewBox="0 0 88 88" className="size-full -rotate-90 rtl:-scale-x-100" aria-hidden>
              <circle
                cx="44"
                cy="44"
                r="38"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeWidth="7"
              />
              <motion.circle
                cx="44"
                cy="44"
                r="38"
                fill="none"
                stroke="var(--color-citrus)"
                strokeWidth="7"
                strokeLinecap="round"
                initial={{ pathLength: reduced ? ring : 0 }}
                animate={{ pathLength: ring }}
                transition={{
                  duration: reduced ? 0 : 1.2,
                  ease: ease.out,
                  delay: reduced ? 0 : 0.3,
                }}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center num text-[1.0625rem] font-semibold">
              {next
                ? format.dateTime(new Date(next.starts_at), {
                    hour: '2-digit',
                    minute: '2-digit',
                    hourCycle: 'h23',
                  })
                : '—'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="label text-sage">{t('hero.next')}</p>
            {next ? (
              <>
                <p className="mt-1 truncate text-[1rem] font-semibold">
                  {next.client_name ?? next.title}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-paper/70">
                  {ta(`kinds.${next.kind}`)} · {format.relativeTime(new Date(next.starts_at), now)}
                </p>
                {next.client_id && (
                  <Link
                    href={`/admin/clients/${next.client_id}?tab=overview`}
                    className="mt-2 inline-block text-[0.8125rem] font-semibold text-citrus underline-offset-4 hover:underline"
                  >
                    {t('hero.open')}
                  </Link>
                )}
              </>
            ) : (
              <p className="mt-1 text-[0.875rem] text-paper/75">{t('hero.none')}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** "23:45" whose changing digits roll up (minutes tick live; reduced motion: plain swap). */
function RollingTime({ now, label }: { now: Date; label: string }) {
  const format = useFormatter();
  const reduced = usePrefersReducedMotion();
  const text = format.dateTime(now, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return (
    <span className="inline-flex num tracking-normal" role="timer" aria-label={`${label} ${text}`}>
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden className="relative inline-block overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={ch}
              className="inline-block"
              initial={reduced ? { opacity: 0 } : { y: '-100%' }}
              animate={reduced ? { opacity: 1 } : { y: 0 }}
              exit={reduced ? { opacity: 0 } : { y: '100%' }}
              transition={{ duration: 0.35, ease: ease.out }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/**
 * A name under its control on hover or keyboard focus: the cream label on the dark card, as
 * before — drawn in a layer of its own, so the card's rounded edge cannot cut it off.
 */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
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

function ChipIcon({ kind }: { kind: 'appointments' | 'unread' | 'attention' }) {
  const p = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      {kind === 'appointments' && <path {...p} d="M4 7h16v13H4V7ZM4 11h16M9 3v4M15 3v4" />}
      {kind === 'unread' && <path {...p} d="M4 5h16v11H8l-4 4V5Z" />}
      {kind === 'attention' && <path {...p} d="M12 3l9 16H3l9-16ZM12 10v4M12 17h.01" />}
    </svg>
  );
}
