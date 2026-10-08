'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LOADER_PLAY_KEY, LOADER_SEEN_KEY } from './loader-boot';

const KEY = LOADER_SEEN_KEY;
const PLAY_KEY = LOADER_PLAY_KEY;
/** The loader's CSS timeline (globals.css): ring 60→760 ms, then the page opens 760→1180 ms. */
const OPEN_MS = 760;
const LOADER_MS = 1180;

/**
 * Ink-blot loader: plays on the first page of a visit and after every language switch, always
 * from start to finish (never cut half-way). Server-rendered so there is no flash of content; the
 * inline boot script at the top of <body> runs before the first paint and marks
 * <html data-noloader> when it should not play (already seen, or reduced motion), so CSS hides
 * it before anything is drawn. The animation itself is pure CSS, so it does not wait for
 * JavaScript; this component only removes the finished overlay.
 */
export function InkLoader() {
  const t = useTranslations('loader');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.noloader) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDone(true);
      return;
    }
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {}
    // The headline waits (paused) under the loader and rises as the loader opens — whenever
    // the page's content arrives, the two always play one after the other.
    const open = () => (html.dataset.loaderOpen = '1');
    const el = document.querySelector<HTMLElement>('.ink-loader');
    const out = el?.getAnimations().find((a) => (a as CSSAnimation).animationName === 'loader-out');
    const onStart = (e: AnimationEvent) => {
      if (e.animationName === 'loader-out') open();
    };
    el?.addEventListener('animationstart', onStart);
    // hydrated late: the opening may already be under way
    if (!out || out.playState === 'finished' || Number(out.currentTime ?? 0) >= OPEN_MS) open();
    // Ends with its own animation: the overlay goes once the circle has closed (the CSS started
    // at first paint, so this is never earlier than the animation).
    const finish = () => {
      open();
      setDone(true);
      html.dataset.noloader = '1';
    };
    let fallback: number | undefined;
    if (out) out.finished.then(finish, finish);
    else fallback = window.setTimeout(finish, LOADER_MS);
    return () => {
      el?.removeEventListener('animationstart', onStart);
      window.clearTimeout(fallback);
    };
  }, []);

  if (done) return null;

  return (
    <div className="ink-loader" role="status" aria-live="polite">
      <span className="ink-loader-disc" aria-hidden />
      <span className="sr-only">{t('label')}</span>
      <div className="ink-loader-mark" aria-hidden>
        <span className="ink-ring">
          <span className="ink-half ink-half-r">
            <i />
          </span>
          <span className="ink-half ink-half-l">
            <i />
          </span>
        </span>
        <span className="ink-loader-blot">
          <svg viewBox="0 0 200 200" className="size-full">
            <path
              d="M100 58c18-2 40 10 42 30 3 22-12 28-8 46 3 16-18 24-34 20-18-4-38 2-44-16-6-16 8-24 4-40-4-20 20-38 40-40Z"
              fill="var(--color-paprika)"
            />
          </svg>
        </span>
      </div>
      <motion.button
        type="button"
        onClick={() => {
          document.documentElement.dataset.loaderOpen = '1';
          document.documentElement.dataset.noloader = '1';
          setDone(true);
        }}
        className="ink-loader-skip absolute end-8 bottom-8 rounded-pill border border-paper/30 px-4 py-2 text-[0.8125rem] font-semibold text-paper hover:bg-paper hover:text-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.3 } }}
      >
        {t('skip')}
      </motion.button>
    </div>
  );
}

/**
 * Before leaving for another language: ask the next page to play the loader, and cover this
 * one in ink first, so the switch reads as one movement (ink in → ring fills → page opens).
 * Resolves when the cover is in place (at once with reduced motion).
 */
export function coverForLanguageSwitch(): Promise<void> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    if (!reduce) sessionStorage.setItem(PLAY_KEY, '1');
  } catch {}
  if (reduce) return Promise.resolve();
  const cover = document.createElement('div');
  cover.setAttribute('aria-hidden', 'true');
  cover.style.cssText =
    'position:fixed;left:50%;top:50%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;border-radius:50%;z-index:140;background:var(--color-ink);pointer-events:none;transform:scale(0);will-change:transform';
  document.body.appendChild(cover);
  const anim = cover.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], {
    duration: 380,
    easing: 'cubic-bezier(0.76, 0, 0.24, 1)',
    fill: 'forwards',
  });
  // the ink cover is the transition: the browser's cross-document one is skipped on this side
  // too (no snapshot of a page that is already covered), and its promises are caught
  window.addEventListener(
    'pageswap',
    (e) => {
      const v = (e as Event & { viewTransition?: ViewTransition | null }).viewTransition;
      if (!v) return;
      const none = () => undefined;
      v.ready.catch(none);
      v.finished.catch(none);
      v.updateCallbackDone.catch(none);
      v.skipTransition();
    },
    { once: true },
  );
  // a page restored from the back/forward cache must not come back covered
  window.addEventListener('pageshow', (e) => e.persisted && cover.remove(), { once: true });
  return anim.finished.then(
    () => undefined,
    () => undefined,
  );
}
