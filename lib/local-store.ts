'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tiny localStorage-backed lists (favourites, shopping list). No login, nothing leaves the
 * device. Synced across components and tabs. Every access is guarded (private mode etc.).
 */
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  try {
    value = raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    value = fallback;
  }
  cache.set(key, { raw, value });
  return value;
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(key: string, cb: Listener) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(cb);
  const onStorage = (e: StorageEvent) => e.key === key && cb();
  window.addEventListener('storage', onStorage);
  return () => {
    set!.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

const EMPTY: never[] = [];

export function useStoredIds(key: string) {
  const ids = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => read<string[]>(key, EMPTY),
    () => EMPTY,
  );
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback(
    (id: string) => {
      const cur = read<string[]>(key, EMPTY);
      write(key, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    },
    [key],
  );
  const clear = useCallback(() => write(key, EMPTY), [key]);
  return { ids, has, toggle, clear };
}

export type ShoppingEntry = { id: string; servings: number };

export function useShoppingList() {
  const key = 'dm_shopping_v1';
  const entries = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => read<ShoppingEntry[]>(key, EMPTY),
    () => EMPTY,
  );
  const has = useCallback((id: string) => entries.some((e) => e.id === id), [entries]);
  const toggle = useCallback((id: string, servings: number) => {
    const cur = read<ShoppingEntry[]>(key, EMPTY);
    write(
      key,
      cur.some((e) => e.id === id) ? cur.filter((e) => e.id !== id) : [...cur, { id, servings }],
    );
  }, []);
  const setServings = useCallback((id: string, servings: number) => {
    const cur = read<ShoppingEntry[]>(key, EMPTY);
    write(
      key,
      cur.map((e) => (e.id === id ? { ...e, servings } : e)),
    );
  }, []);
  const clear = useCallback(() => write(key, EMPTY), []);
  return { entries, has, toggle, setServings, clear };
}

export const FAVORITES_KEY = 'dm_favorites_v1';

/** Checked ingredient keys per recipe (detail page checklist). */
export function useChecked(recipeId: string) {
  return useStoredIds(`dm_checked_${recipeId}`);
}
