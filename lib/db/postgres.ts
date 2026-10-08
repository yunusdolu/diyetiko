import 'server-only';
import postgres from 'postgres';
import { env } from '@/lib/env';
import { OID, identity, parseJson, parseTimestamp, serializeJson, toNumber } from './parsers';
import type { DbRole, Driver, Param, Row, Tx } from './types';

type GlobalWithSql = typeof globalThis & { __sql?: postgres.Sql };
const g = globalThis as GlobalWithSql;

function client(): postgres.Sql {
  if (!g.__sql) {
    if (!env.databaseUrl) throw new Error('DATABASE_URL is not set');
    g.__sql = postgres(env.databaseUrl, {
      // Supabase transaction pooler (port 6543) does not support prepared statements.
      prepare: false,
      // several transactions of one page run side by side (each holds its own connection)
      max: 16,
      idle_timeout: 20,
      connect_timeout: 10,
      connection: { TimeZone: 'UTC', DateStyle: 'ISO, YMD', application_name: 'diyetisyen-web' },
      types: {
        date: { to: OID.date, from: [OID.date], serialize: identity, parse: identity },
        timestamp: {
          to: OID.timestamptz,
          from: [OID.timestamp, OID.timestamptz],
          serialize: identity,
          parse: parseTimestamp,
        },
        numeric: { to: OID.numeric, from: [OID.numeric], serialize: String, parse: toNumber },
        bigint: { to: OID.int8, from: [OID.int8], serialize: String, parse: toNumber },
        // json(): text in, objects out — never double-encoded (see parsers.ts)
        json: {
          to: OID.json,
          from: [OID.json, OID.jsonb],
          serialize: serializeJson,
          parse: parseJson,
        },
      },
    });
  }
  return g.__sql;
}

/** Network failures while opening a connection (DNS hiccup, Wi-Fi switch, pooler restart). */
const TRANSIENT = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
]);

/**
 * A connection for one transaction. If the network fails while it is being OPENED — before any
 * statement has been sent — waiting a moment and trying again is safe and usually succeeds (a
 * transient DNS failure once took a whole page down). Failures after that are never retried.
 */
async function reserveConnection(): Promise<postgres.ReservedSql> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await client().reserve();
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (attempt >= 3 || !TRANSIENT.has(code)) throw e;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES: readonly DbRole[] = ['anon', 'authenticated', 'service_role'];

/**
 * Every call is one transaction as the given role with the user's JWT claims, so RLS applies.
 *
 * Latency matters more than anything here: the database is a network round trip away (~70 ms
 * from Türkiye to the pooler). The old sequence — BEGIN, set_config, SET ROLE, the queries,
 * COMMIT — cost 5 round trips for a single query (~400 ms). Now the opening is ONE simple-protocol
 * message, and it is not awaited on its own: the first queries are pipelined right behind it on
 * the same reserved connection, so a one-query transaction costs 2 round trips. Queries a
 * caller starts together (Promise.all) are pipelined too.
 *
 * The opening message is built from validated values only (a UUID and one of three role names),
 * never from user input; query parameters still go through the extended protocol.
 */
export function postgresDriver(): Driver {
  return {
    async run<T>(role: DbRole, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
      if (!ROLES.includes(role)) throw new Error('invalid database role');
      if (userId !== null && !UUID.test(userId)) throw new Error('invalid user id');
      const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
      const conn = await reserveConnection();
      let open = true;
      try {
        const opening = conn
          .unsafe(
            `begin; select set_config('request.jwt.claims', '${claims}', true); set local role ${role}`,
          )
          .simple()
          .execute();
        // observed below; this only keeps an early failure from being "unhandled"
        const opened = opening.then(
          () => null,
          (e: unknown) => e,
        );
        const tx: Tx = {
          async query<R = Row>(text: string, params: readonly Param[] = []) {
            const rows = await conn.unsafe(text, params as Param[]);
            return rows as unknown as R[];
          },
        };
        const result = await fn(tx);
        const failed = await opened;
        if (failed) throw failed;
        await conn.unsafe('commit');
        open = false;
        return result;
      } catch (e) {
        if (open) await conn.unsafe('rollback').catch(() => {});
        throw e;
      } finally {
        conn.release();
      }
    },
  };
}
