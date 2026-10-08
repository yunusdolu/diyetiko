'use client';

import { useEffect } from 'react';

/**
 * Page transitions use the View Transitions API. Browsers abort a running transition when the
 * viewport changes size mid-way (e.g. a phone's address bar collapsing right after a scroll +
 * tap) or when another navigation starts, and report it as an unhandled promise rejection. The
 * navigation itself still completes; only the cosmetic animation is skipped. Swallow exactly
 * those rejections — nothing else.
 */
const ABORTED = /^Transition was (aborted|skipped)/;

export function ViewTransitionGuard() {
  useEffect(() => {
    // A tab in the background cannot run a view transition: the browser aborts it with
    // 'InvalidStateError … Document hidden', which React reports as an error. A refresh that
    // lands while the tab is hidden (an autosave, a timer) therefore applies its update at once,
    // without asking for a transition at all.
    type Start = typeof document.startViewTransition;
    const original = document.startViewTransition?.bind(document) as Start | undefined;
    if (original && !(document as Document & { __vtGuard?: true }).__vtGuard) {
      (document as Document & { __vtGuard?: true }).__vtGuard = true;
      document.startViewTransition = ((arg?: unknown) => {
        if (document.visibilityState !== 'hidden')
          return (original as (a?: unknown) => ViewTransition)(arg);
        const update =
          typeof arg === 'function'
            ? (arg as () => unknown)
            : (arg as { update?: () => unknown } | undefined)?.update;
        const done = Promise.resolve()
          .then(() => update?.())
          .then(() => undefined);
        return {
          ready: done,
          finished: done,
          updateCallbackDone: done,
          skipTransition() {},
          types: new Set<string>(),
        } as unknown as ViewTransition;
      }) as Start;
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      if (reason instanceof DOMException && ABORTED.test(reason.message)) event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);
  return null;
}
