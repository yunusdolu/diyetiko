'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
};

/**
 * Reads one query parameter without `useSearchParams()`.
 *
 * `useSearchParams()` in a statically generated page makes Next render everything up to the
 * nearest Suspense boundary on the client only — the server HTML would be empty (layout shift,
 * nothing for crawlers or no-JS readers). Here the server snapshot is `null`, so the page
 * prerenders its default state, and the real value is picked up right after hydration.
 */
export function useQueryParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}
