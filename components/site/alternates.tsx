'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { Locale } from '@/lib/i18n/config';

/**
 * Detail pages (recipes, guides) have a different slug per language. The page registers the
 * mapping here; the language switcher (rendered by the layout, outside the page tree) reads it
 * so switching language lands on the right page instead of a 404.
 */
export type Alternates = {
  route: '/recipes/[slug]' | '/guides/[slug]';
  slugs: Partial<Record<Locale, string>>;
} | null;

let current: Alternates = null;
const listeners = new Set<() => void>();

function set(value: Alternates) {
  current = value;
  listeners.forEach((l) => l());
}

export function RegisterAlternates({ value }: { value: NonNullable<Alternates> }) {
  const key = JSON.stringify(value);
  useEffect(() => {
    set(JSON.parse(key) as Alternates);
    return () => set(null);
  }, [key]);
  return null;
}

export function useAlternates(): Alternates {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}
