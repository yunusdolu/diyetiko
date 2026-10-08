import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it('transliterates Turkish letters including dotted/dotless i', () => {
    expect(slugify('İğdır şeker çöğüş')).toBe('igdir-seker-cogus');
    expect(slugify('Kırmızı mercimek çorbası')).toBe('kirmizi-mercimek-corbasi');
  });
  it('strips French accents and apostrophes', () => {
    expect(slugify("Haricots verts à l'huile d'olive")).toBe('haricots-verts-a-lhuile-dolive');
  });
  it('drops scripts it cannot transliterate', () => {
    expect(slugify('شوربة')).toBe('');
  });
});

describe('Turkish casing (never String#toUpperCase)', () => {
  it('uppercases with the tr locale', () => {
    expect('İğdır şeker çöğüş'.toLocaleUpperCase('tr')).toBe('İĞDIR ŞEKER ÇÖĞÜŞ');
    expect('ılık'.toLocaleUpperCase('tr')).toBe('ILIK');
    expect('istanbul'.toLocaleUpperCase('tr')).toBe('İSTANBUL');
  });
});
