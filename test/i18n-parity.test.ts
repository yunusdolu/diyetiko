import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every UI string exists in all four languages (same keys, same array lengths, same ICU params). */
const load = (l: string) =>
  JSON.parse(readFileSync(path.join(__dirname, '..', 'messages', `${l}.json`), 'utf8'));

function flatten(
  obj: unknown,
  prefix = '',
  out: Record<string, string> = {},
): Record<string, string> {
  if (Array.isArray(obj)) {
    out[`${prefix}[]`] = String(obj.length);
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else out[prefix] = String(obj);
  return out;
}

// top-level ICU arguments: {name}, {count, plural, …} → name, count
function params(s: string): string[] {
  const found = new Set<string>();
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') {
      if (depth === 0) {
        const m = /^\{\s*([A-Za-z_]\w*)/.exec(s.slice(i));
        if (m) found.add(m[1]!);
      }
      depth++;
    } else if (s[i] === '}') depth--;
  }
  return [...found].sort();
}

const base = flatten(load('tr'));

describe.each(['en', 'ar', 'fr'])('messages/%s.json', (l) => {
  const other = flatten(load(l));
  it('has exactly the Turkish keys', () => {
    expect(Object.keys(other).sort()).toEqual(Object.keys(base).sort());
  });
  it('uses the same placeholders', () => {
    const diff = Object.keys(base)
      .filter(
        (k) => k in other && JSON.stringify(params(base[k]!)) !== JSON.stringify(params(other[k]!)),
      )
      .map((k) => `${k}: ${params(base[k]!)} ≠ ${params(other[k]!)}`);
    expect(diff).toEqual([]);
  });
});
