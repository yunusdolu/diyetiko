'use client';

import type { AnchorHTMLAttributes, MouseEvent } from 'react';

/** read by the panels' root layouts: the page that opens next uncovers itself (globals.css) */
export const CUT_COOKIE = 'cut';

/**
 * A link to a page under another root layout (the site ↔ a panel's sign-in). That hop is a full
 * page load, so the knife cut is played by hand, in two halves that read as one blade passing:
 * here an ink sheet with a slanted edge sweeps over the page; the next page arrives covered (a
 * short-lived cookie tells its layout) and the sheet sweeps on, off the far side. It does not
 * depend on the browser's cross-document transitions, and it survives a redirect on the way.
 */
export function PlainLink({
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      props.target === '_blank' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    e.preventDefault();
    const href = props.href;
    const cover = document.createElement('div');
    cover.setAttribute('aria-hidden', 'true');
    cover.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;background:#0f1b17;pointer-events:none;will-change:clip-path' +
      (document.documentElement.dir === 'rtl' ? ';transform:scaleX(-1)' : '');
    document.body.appendChild(cover);
    // the browser's own cross-document transition would run on top of the sheet: skip it
    window.addEventListener(
      'pageswap',
      (ev) => {
        const v = (ev as Event & { viewTransition?: ViewTransition | null }).viewTransition;
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
    window.addEventListener('pageshow', (ev) => ev.persisted && cover.remove(), { once: true });
    const leave = () => {
      document.cookie = `${CUT_COOKIE}=1; path=/; max-age=6; samesite=lax`;
      window.location.assign(href);
    };
    const anim = cover.animate(
      [
        { clipPath: 'polygon(0 0, 0 0, -12% 100%, -12% 100%)' },
        { clipPath: 'polygon(0 0, 112% 0, 100% 100%, -12% 100%)' },
      ],
      { duration: 340, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', fill: 'forwards' },
    );
    anim.finished.then(leave, leave);
  };
  return <a {...props} onClick={go} />;
}
