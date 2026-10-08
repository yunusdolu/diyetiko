import 'server-only';
import { backend } from '@/lib/env';
import type { Driver, Tx } from './types';

export type { Tx, Param, Row } from './types';
export { pgArray, json } from './types';

let driverPromise: Promise<Driver> | undefined;

/** Tests only: route every asUser/asAnon/asService call to an in-memory database. */
export function setDriverForTests(d: Driver): void {
  if (!process.env.VITEST) throw new Error('setDriverForTests is for tests only');
  driverPromise = Promise.resolve(d);
}

function driver(): Promise<Driver> {
  if (!driverPromise) {
    driverPromise =
      backend() === 'supabase'
        ? import('./postgres').then((m) => m.postgresDriver())
        : import('./pglite').then((m) => m.pgliteDriver());
  }
  return driverPromise;
}

/*
 * Every query runs inside a transaction with an explicit Postgres role, so RLS always applies.
 * There is deliberately no "raw" export: code must choose one of these three doors.
 */

/** As the signed-in dietitian. RLS: owner_id = auth.uid(). */
export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await driver()).run('authenticated', userId, fn);
}

/** As an anonymous visitor. RLS: published content + public settings only. */
export async function asAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await driver()).run('anon', null, fn);
}

/**
 * Service role (bypasses RLS). Only for: lead intake, rate limiting, site-owner lookup.
 * Never for reading client data.
 */
export async function asService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await driver()).run('service_role', null, fn);
}
