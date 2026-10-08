import 'server-only';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { env } from '@/lib/env';

/** LOCAL MODE ONLY: an HMAC-signed session cookie standing in for Supabase Auth. */
export const LOCAL_SESSION_COOKIE = 'dm_local_session';
const TTL_SECONDS = 60 * 60 * 12;

let cachedSecret: Buffer | undefined;
function secret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.LOCAL_AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 32) return (cachedSecret = Buffer.from(fromEnv));
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), env.localDataDir);
  const file = path.join(dir, 'session-secret');
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, randomBytes(48).toString('base64url'), { mode: 0o600 });
  }
  return (cachedSecret = Buffer.from(readFileSync(file, 'utf8')));
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createLocalSession(
  userId: string,
  email: string,
): { value: string; maxAge: number } {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, email, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }),
  ).toString('base64url');
  return { value: `${payload}.${sign(payload)}`, maxAge: TTL_SECONDS };
}

export function readLocalSession(value: string | undefined): { id: string; email: string } | null {
  if (!value) return null;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      email?: string;
      exp?: number;
    };
    if (!data.sub || !data.exp || data.exp < Date.now() / 1000) return null;
    return { id: data.sub, email: data.email ?? '' };
  } catch {
    return null;
  }
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
