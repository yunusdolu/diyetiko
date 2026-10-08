'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Dialog as D } from 'radix-ui';
import { useEffect, useState } from 'react';
import { usePathname } from '@/lib/i18n/navigation';
import { ease } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/motion/hooks';
import { ArrowIcon } from '@/components/ui/motion-button';
import { MotionLink } from '@/components/ui/motion-link';
import { MonthStrip } from './month-strip';
import { afterLoader, usePromptTurn } from './prompts';

/** "Later" keeps it away for two weeks; an application sent from this browser, for good. */
const SNOOZE_KEY = 'dm_apply_prompt';
export const APPLIED_KEY = 'dm_applied';
const SNOOZE_MS = 14 * 864e5;
/** Shown once the visitor has spent a while here or read most of a page. */
const AFTER_MS = 35_000;
const AFTER_SCROLL = 0.6;
/** pages where an invitation would be in the way */
const QUIET = ['/apply', '/goal', '/contact', '/legal'];

function snoozed(): boolean {
  try {
    if (localStorage.getItem(APPLIED_KEY)) return true;
    const at = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return true;
  }
}

/**
 * The programme invitation: a calm modal with the conditions spelled out (at least three months,
 * no one-month programme, online or in person, a three-minute application). Appears at most
 * once per visit, after the visitor has shown interest, never on the application itself.
 */
export function ApplyPrompt() {
  const t = useTranslations('applyPrompt');
  const ta = useTranslations('apply');
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();
  const [wants, setWants] = useState(false);
  const show = usePromptTurn('apply', wants);
  const quiet = QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (quiet || snoozed()) return;
    let alive = true;
    let timer: number | undefined;
    const fire = () => {
      if (!alive || snoozed()) return;
      setWants(true);
      cleanup();
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= AFTER_SCROLL) fire();
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
    afterLoader().then(() => {
      if (!alive) return;
      timer = window.setTimeout(fire, AFTER_MS);
      window.addEventListener('scroll', onScroll, { passive: true });
    });
    return () => {
      alive = false;
      cleanup();
    };
  }, [quiet]);

  const close = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {}
    setWants(false);
  };

  const points = ['minimum', 'format', 'plan', 'quick'] as const;

  return (
    <D.Root open={show} onOpenChange={(o) => !o && close()}>
      <AnimatePresence>
        {show && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[95] bg-ink/55 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                data-lenis-prevent
                className="fixed inset-x-3 bottom-3 z-[96] mx-auto max-h-[calc(100dvh-1.5rem)] max-w-3xl overflow-y-auto rounded-[26px] bg-paper text-ink shadow-sheet sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.97 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.5, ease: ease.out },
                }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: 24,
                        scale: 0.98,
                        transition: { duration: 0.25, ease: ease.in },
                      }
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1.15fr]">
                  <div className="on-dark flex flex-col justify-between gap-8 rounded-t-[26px] bg-ink grain-light p-6 text-paper md:rounded-s-[26px] md:rounded-tr-none md:p-8 rtl:md:rounded-tl-none rtl:md:rounded-tr-[26px]">
                    <div>
                      <p className="label text-citrus">{t('eyebrow')}</p>
                      <p className="mt-6 font-display leading-[0.9] ar:font-bold">
                        <span className="block text-[1.25rem] text-sage">{ta('minimum')}</span>
                        <span className="block text-[clamp(4rem,9vw,6.5rem)] text-citrus">
                          {ta('durations.m3')}
                        </span>
                      </p>
                    </div>
                    <MonthStrip tall={false} />
                  </div>
                  <div className="p-6 md:p-8">
                    <D.Title className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-[1.05] ar:leading-tight ar:font-bold">
                      {t('title')}
                    </D.Title>
                    <D.Description className="mt-3 text-[0.9375rem] leading-relaxed text-ink-70">
                      {t('lead')}
                    </D.Description>
                    <ul className="mt-6 grid gap-3">
                      {points.map((k, i) => (
                        <motion.li
                          key={k}
                          className="flex gap-3 text-[0.9375rem]"
                          initial={{ opacity: 0, x: reduced ? 0 : -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: reduced ? 0 : 0.25 + i * 0.08,
                            duration: 0.4,
                            ease: ease.out,
                          }}
                        >
                          <span
                            aria-hidden
                            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-citrus"
                          >
                            <svg
                              viewBox="0 0 16 16"
                              width="10"
                              height="10"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3.5 8.5l3 3 6-7" />
                            </svg>
                          </span>
                          <span>
                            <span className="font-semibold">{t(`points.${k}.title`)}</span>{' '}
                            <span className="text-ink-70">{t(`points.${k}.body`)}</span>
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <MotionLink href="/apply" size="lg" icon={<ArrowIcon />} onClick={close}>
                        {t('cta')}
                      </MotionLink>
                      <D.Close className="h-14 rounded-pill px-5 text-ui font-semibold text-ink-70 hover:text-ink">
                        {t('later')}
                      </D.Close>
                    </div>
                  </div>
                </div>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
