import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { asUser } from '@/lib/db';
import { backend } from '@/lib/env';
import {
  LOCAL_SESSION_COOKIE,
  createLocalSession,
  readLocalSession,
  verifyPassword,
} from './local-session';

export type Role = 'dietitian' | 'client';

export interface SessionUser {
  id: string;
  email: string;
  /** From profiles.role — NULL only if the profile row is missing (treated as no access). */
  role: Role | null;
  /** Supabase only: the user has a verified TOTP factor but this session is still aal1 */
  needsMfa: boolean;
  mode: 'supabase' | 'local';
}

/** Portal state of a client account (public.portal_status()). */
export interface PortalStatus {
  clientId: string;
  firstName: string;
  locale: 'tr' | 'en' | 'ar' | 'fr';
  consented: boolean;
  active: boolean;
}

async function roleOf(userId: string): Promise<Role | null> {
  const [row] = await asUser(userId, (tx) =>
    tx.query<{ role: Role }>(`select role::text as role from profiles where id = $1`, [userId]),
  );
  return row?.role ?? null;
}

/**
 * Does this account have a verified second factor? Asked from the Auth server (getUser), never
 * read from the session cookie: the cookie's copy of the user is not signed, and trusting its
 * factor list would let someone who knows the password edit the cookie and skip the TOTP step.
 * The answer is kept in memory for a few minutes per account so a page costs no extra round
 * trip; enrolling a factor clears it at once (forgetFactors). `null`: the session was refused.
 */
const FACTOR_TTL_MS = 5 * 60_000;
const factorCache = new Map<string, { verified: boolean; until: number }>();

export function forgetFactors(userId: string) {
  factorCache.delete(userId);
}

type ServerClient = Awaited<
  ReturnType<typeof import('@/lib/supabase/server').createSupabaseServerClient>
>;

async function hasVerifiedFactor(supabase: ServerClient, userId: string): Promise<boolean | null> {
  const hit = factorCache.get(userId);
  if (hit && hit.until > Date.now()) return hit.verified;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== userId) return null;
  const verified = (data.user.factors ?? []).some((f) => f.status === 'verified');
  factorCache.set(userId, { verified, until: Date.now() + FACTOR_TTL_MS });
  return verified;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (backend() === 'local') {
    const jar = await cookies();
    const s = readLocalSession(jar.get(LOCAL_SESSION_COOKIE)?.value);
    return s ? { ...s, role: await roleOf(s.id), needsMfa: false, mode: 'local' } : null;
  }
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  // getClaims verifies the session JWT's signature locally (asymmetric signing keys, JWKS cached)
  // and only asks the Auth server for legacy symmetric keys — it saves a ~150 ms round trip per
  // page. The role still comes from the database on every request (below), so an account whose
  // profile is gone loses access at once.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const [role, factor] = await Promise.all([
    roleOf(claims.sub),
    hasVerifiedFactor(supabase, claims.sub),
  ]);
  if (factor === null) return null;
  // the assurance level of THIS session comes from the verified JWT
  const needsMfa = factor && claims.aal !== 'aal2';
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : '',
    role,
    needsMfa,
    mode: 'supabase',
  };
});

/**
 * For every admin page, route handler and server action: a fully authenticated DIETITIAN.
 * A signed-in client is sent to their portal; RLS would deny them anyway (staff_uid() is NULL).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (user.role === 'client') redirect('/panel');
  if (user.role !== 'dietitian') redirect('/admin/login');
  if (user.needsMfa) redirect('/admin/login?step=mfa');
  return user;
}

/** For admin route handlers (no redirects): the dietitian, or null → respond 401. */
export async function getStaffUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user && user.role === 'dietitian' && !user.needsMfa ? user : null;
}

export const getPortalStatus = cache(async (userId: string): Promise<PortalStatus | null> => {
  const [row] = await asUser(userId, (tx) =>
    tx.query<{ s: PortalStatus | null }>(`select portal_status() as s`),
  );
  return row?.s ?? null;
});

/**
 * For every portal page and action: a signed-in, linked, active CLIENT that has given consent.
 * `consent: false` is for the consent page itself.
 */
export async function requireClient(
  opts: { consent?: boolean } = {},
): Promise<{ user: SessionUser; status: PortalStatus }> {
  const user = await getSessionUser();
  if (!user) redirect('/panel/login');
  if (user.role === 'dietitian') redirect('/admin');
  if (user.role !== 'client') redirect('/panel/login');
  const status = await getPortalStatus(user.id);
  if (!status || !status.active) redirect('/panel/login?closed=1');
  if (opts.consent !== false && !status.consented) redirect('/panel/consent');
  return { user, status };
}

/** For portal route handlers (no redirects): the consenting client, or null → respond 401. */
export async function getPortalClient(): Promise<{
  user: SessionUser;
  status: PortalStatus;
} | null> {
  const user = await getSessionUser();
  if (!user || user.role !== 'client') return null;
  const status = await getPortalStatus(user.id);
  if (!status || !status.active || !status.consented) return null;
  return { user, status };
}

export type SignInResult =
  { ok: true; mfa: boolean; role: Role | null; userId: string } | { ok: false; error: 'invalid' };

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  if (backend() === 'local') {
    const { localAuthUser } = await import('@/lib/db/pglite');
    const row = await localAuthUser(email);
    // Always run the hash comparison to keep timing uniform for unknown e-mails.
    const valid = verifyPassword(password, row?.encrypted_password ?? 'scrypt$00$00');
    if (!row || !valid) return { ok: false, error: 'invalid' };
    const session = createLocalSession(row.id, row.email);
    const jar = await cookies();
    jar.set(LOCAL_SESSION_COOKIE, session.value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: session.maxAge,
    });
    return { ok: true, mfa: false, role: await roleOf(row.id), userId: row.id };
  }
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: 'invalid' };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    ok: true,
    mfa: aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2',
    role: await roleOf(data.user.id),
    userId: data.user.id,
  };
}

export async function signOut(): Promise<void> {
  if (backend() === 'local') {
    (await cookies()).delete(LOCAL_SESSION_COOKIE);
    return;
  }
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
