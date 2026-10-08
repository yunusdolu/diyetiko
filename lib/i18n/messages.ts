import type { Locale } from './config';
import type tr from '@/messages/tr.json';

export type Messages = typeof tr;

type Json = { [key: string]: Json } | Json[] | string;

function merge(base: Json, over: Json | undefined): Json {
  if (over === undefined) return base;
  // Arrays (e.g. hero lines, FAQ items) are replaced whole, never merged index-by-index.
  if (
    typeof base === 'string' ||
    typeof over === 'string' ||
    Array.isArray(base) ||
    Array.isArray(over)
  )
    return over;
  const out: { [key: string]: Json } = { ...base };
  for (const key of Object.keys(over)) {
    const b = base[key];
    const o = over[key];
    out[key] = b === undefined ? (o as Json) : merge(b, o);
  }
  return out;
}

const importers: Record<Locale, () => Promise<{ default: unknown }>> = {
  tr: () => import('@/messages/tr.json'),
  en: () => import('@/messages/en.json'),
  ar: () => import('@/messages/ar.json'),
  fr: () => import('@/messages/fr.json'),
};

/** UI messages with fallback: locale → en → tr (tr is the source of truth). */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const tr = (await importers.tr()).default as Json;
  if (locale === 'tr') return tr as unknown as Messages;
  const en = (await importers.en()).default as Json;
  const withEn = merge(tr, en);
  if (locale === 'en') return withEn as unknown as Messages;
  const own = (await importers[locale]()).default as Json;
  return merge(withEn, own) as unknown as Messages;
}
