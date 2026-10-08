import 'server-only';
import { asService } from '@/lib/db';
import { clientFingerprint } from '@/lib/request';

/**
 * Fixed-window rate limit backed by Postgres (works across serverless instances).
 * Returns true when the action is allowed.
 */
export async function rateLimit(
  bucket: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  const fp = await clientFingerprint();
  const [row] = await asService((tx) =>
    tx.query<{ ok: boolean }>(`select public.rate_limit_hit($1, $2, $3) as ok`, [
      `${bucket}:${fp}`,
      windowSeconds,
      max,
    ]),
  );
  return row?.ok ?? false;
}
