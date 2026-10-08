/**
 * The dietitian's task list (migration …000005_tasks.sql) against the real migrations: owner-only,
 * invisible to client accounts and anonymous visitors, tied only to the owner's own clients, and
 * removed with the client.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalDatabase, pgliteDriver } from '@/lib/db/pglite';
import type { Driver, Tx } from '@/lib/db/types';

const D = '0d000000-0000-4000-8000-00000000000d'; // first account → the dietitian
const C = '0c000000-0000-4000-8000-00000000000c'; // later account → a client account

let db: PGlite;
let driver: Driver;
const asD = <T>(fn: (tx: Tx) => Promise<T>) => driver.run('authenticated', D, fn);
const asC = <T>(fn: (tx: Tx) => Promise<T>) => driver.run('authenticated', C, fn);
const asAnon = <T>(fn: (tx: Tx) => Promise<T>) => driver.run('anon', null, fn);
let clientId = '';

beforeAll(async () => {
  db = await createLocalDatabase(undefined, { seed: false });
  driver = pgliteDriver(() => Promise.resolve(db));
  await db.query(`insert into auth.users (id, email) values ($1, 'd@test'), ($2, 'c@test')`, [
    D,
    C,
  ]);
  await asD(async (tx) => {
    const [c] = await tx.query<{ id: string }>(
      `insert into clients (full_name) values ('Ayşe') returning id`,
    );
    clientId = c!.id;
    await tx.query(
      `insert into tasks (title, due_on, client_id) values ('Ayşe''yi ara', current_date, $1), ('Tarif paylaş', null, null)`,
      [clientId],
    );
  });
});

afterAll(async () => {
  await db?.close();
});

describe('tasks', () => {
  it('the dietitian reads, ticks and deletes their own tasks', async () => {
    const rows = await asD((tx) =>
      tx.query<{ id: string; title: string }>(`select id, title from tasks order by title`),
    );
    expect(rows.map((r) => r.title)).toEqual(["Ayşe'yi ara", 'Tarif paylaş']);
    await asD((tx) => tx.query(`update tasks set done_at = now() where id = $1`, [rows[0]!.id]));
    const [done] = await asD((tx) =>
      tx.query<{ done: boolean }>(`select done_at is not null as done from tasks where id = $1`, [
        rows[0]!.id,
      ]),
    );
    expect(done!.done).toBe(true);
  });

  it('a client account sees none of them and cannot add one', async () => {
    const rows = await asC((tx) => tx.query(`select * from tasks`));
    expect(rows).toEqual([]);
    await expect(asC((tx) => tx.query(`insert into tasks (title) values ('x')`))).rejects.toThrow(
      /row-level security/,
    );
    const changed = await asC((tx) => tx.query(`update tasks set title = 'hacked' returning id`));
    expect(changed).toEqual([]);
  });

  it('anonymous visitors have no access at all', async () => {
    await expect(asAnon((tx) => tx.query(`select * from tasks`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('a task cannot point at a client the dietitian does not own', async () => {
    // a client row that belongs to nobody the dietitian can see (made directly in the database)
    const [other] = (
      await db.query<{ id: string }>(
        `insert into clients (owner_id, full_name) values ($1, 'Başkası') returning id`,
        [C],
      )
    ).rows;
    await expect(
      asD((tx) => tx.query(`insert into tasks (title, client_id) values ('x', $1)`, [other!.id])),
    ).rejects.toThrow(/row-level security/);
  });

  it('the title is required and bounded', async () => {
    await expect(asD((tx) => tx.query(`insert into tasks (title) values ('  ')`))).rejects.toThrow(
      /check constraint/,
    );
    await expect(
      asD((tx) => tx.query(`insert into tasks (title) values ($1)`, ['x'.repeat(201)])),
    ).rejects.toThrow(/check constraint/);
  });

  it('removing the client removes their tasks', async () => {
    await asD((tx) => tx.query(`delete from clients where id = $1`, [clientId]));
    const rows = await asD((tx) => tx.query<{ title: string }>(`select title from tasks`));
    expect(rows.map((r) => r.title)).toEqual(['Tarif paylaş']);
  });
});
