import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { env } from '@/lib/env';

/** Salted hash of the client IP — used as a rate-limit key. Raw IPs are never stored or logged. */
export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown';
  return createHash('sha256').update(`${env.ipHashSalt}:${ip}`).digest('base64url').slice(0, 32);
}
