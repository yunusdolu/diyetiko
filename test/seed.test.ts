import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLocalDatabase, pgliteDriver } from '@/lib/db/pglite';

let db: PGlite;
beforeAll(async () => {
  db = await createLocalDatabase(undefined, { seed: true, demo: true });
});
afterAll(async () => db?.close());

describe('seed + demo data load into the real schema', () => {
  it('loads public content visible to anon', async () => {
    const d = pgliteDriver(() => Promise.resolve(db));
    const recipes = await d.run('anon', null, (tx) =>
      tx.query<{ key: string; kcal: number; diet_flags: string[] }>(
        `select t.slug as key, r.kcal, r.diet_flags from recipes r join recipe_translations t on t.recipe_id = r.id and t.locale = 'tr' order by r.kcal`,
      ),
    );
    expect(recipes.length).toBe(13);
    for (const r of recipes) expect(r.kcal).toBeGreaterThan(100);
    const articles = await d.run('anon', null, (tx) => tx.query(`select * from articles`));
    expect(articles.length).toBe(6);
    console.table(
      recipes.map((r) => ({
        slug: r.key,
        kcal: Math.round(r.kcal),
        flags: r.diet_flags.join(' '),
      })),
    );
  });
  it('demo share token resolves', async () => {
    const d = pgliteDriver(() => Promise.resolve(db));
    const [row] = await d.run('anon', null, (tx) =>
      tx.query<{ dto: { days: unknown[]; clientFirstName: string } }>(
        `select get_shared_program('demo-share-token-7f3a9c2e41b8d6f05a1e3c9b7d2f4a6e8c0b1d3f5a7', false) as dto`,
      ),
    );
    expect(row!.dto.days).toHaveLength(7);
    expect(row!.dto.clientFirstName).toBe('Deniz');
  });
});
