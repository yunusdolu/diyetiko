'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * The site's small prompts take turns instead of piling up at the bottom of the screen:
 * the cookie choice first, then the language suggestion, then the programme invitation. A prompt
 * says it wants the screen; it is shown when no earlier one is waiting. While any prompt is up,
 * <html data-prompt> lets the WhatsApp button step aside (globals.css). Nothing shows while the
 * ink loader still covers the page.
 */
const ORDER = ['cookie', 'lang', 'apply'] as const;
export type PromptId = (typeof ORDER)[number];

const wanting = new Set<PromptId>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function current(): PromptId | null {
  return ORDER.find((id) => wanting.has(id)) ?? null;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** true when it is this prompt's turn (and it wants one). */
export function usePromptTurn(id: PromptId, wants: boolean): boolean {
  useEffect(() => {
    if (wants) wanting.add(id);
    else wanting.delete(id);
    emit();
    return () => {
      wanting.delete(id);
      emit();
    };
  }, [id, wants]);
  const turn = useSyncExternalStore(subscribe, current, () => null);
  useEffect(() => {
    const html = document.documentElement;
    if (turn) html.dataset.prompt = turn;
    else delete html.dataset.prompt;
  }, [turn]);
  return wants && turn === id;
}

/** Resolves once the ink loader is gone (at once when it never played). */
export function afterLoader(): Promise<void> {
  return new Promise((done) => {
    const html = document.documentElement;
    if (html.dataset.noloader) return done();
    const mo = new MutationObserver(() => {
      if (html.dataset.noloader) {
        mo.disconnect();
        done();
      }
    });
    mo.observe(html, { attributes: true, attributeFilter: ['data-noloader'] });
  });
}

export function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}
