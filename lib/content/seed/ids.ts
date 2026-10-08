import { createHash } from 'node:crypto';

/** Deterministic UUID (v5-shaped) from a name — shared by the seed generator and the app. */
export function seedUid(name: string): string {
  const h = createHash('sha1').update(`muzahim:${name}`).digest('hex');
  const v = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${v}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const seedRecipeId = (key: string) => seedUid(`recipe:${key}`);
