const MAP: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  ğ: 'g',
  Ğ: 'g',
  ü: 'u',
  Ü: 'u',
  ş: 's',
  Ş: 's',
  ö: 'o',
  Ö: 'o',
  ç: 'c',
  Ç: 'c',
  œ: 'oe',
  æ: 'ae',
  ß: 'ss',
};

/** URL slug for Latin-script titles (tr/en/fr). Arabic titles need a hand-written Latin slug. */
export function slugify(input: string): string {
  return input
    .replace(/[ıİğĞüÜşŞöÖçÇœæß]/g, (c) => MAP[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}
