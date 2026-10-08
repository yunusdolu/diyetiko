import type { Messages } from './messages';

/** Only send the namespaces a client tree needs (keeps admin strings out of the public bundle). */
export function pick<K extends keyof Messages>(
  messages: Messages,
  keys: readonly K[],
): Pick<Messages, K> {
  const out = {} as Pick<Messages, K>;
  for (const k of keys) out[k] = messages[k];
  return out;
}

export const PUBLIC_CLIENT_NAMESPACES = [
  'meta',
  'nav',
  'common',
  'macros',
  'units',
  'meals',
  'diet',
  'lang',
  'loader',
  'home',
  'faq',
  'contact',
  'form',
  'recipes',
  'recipe',
  'guides',
  'tools',
  'wizard',
  'apply',
  'applyPrompt',
  'cookies',
  'about',
  'pros',
  'footer',
  'cursor',
  'errors',
] as const satisfies readonly (keyof Messages)[];
