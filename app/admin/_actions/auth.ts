'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { signInWithPassword, signOut } from '@/lib/auth';
import { backend } from '@/lib/env';
import { ADMIN_LOCALE_COOKIE, isLocale } from '@/lib/i18n/config';
import { rateLimit } from '@/lib/rate-limit';

const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) });

export type LoginState = { error?: 'invalid' | 'rateLimited' | 'mfa'; mfa?: boolean } | undefined;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!(await rateLimit('login', 900, 8))) return { error: 'rateLimited' };
  const parsed = credentials.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: 'invalid' };
  const res = await signInWithPassword(parsed.data.email, parsed.data.password);
  if (!res.ok) return { error: 'invalid' };
  if (res.role === 'client') redirect('/panel'); // a client used the wrong door
  if (res.mfa) return { mfa: true };
  redirect('/admin');
}

/** Supabase TOTP second step (aal1 → aal2). */
export async function verifyMfaAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!(await rateLimit('mfa', 900, 10))) return { error: 'rateLimited', mfa: true };
  const code = String(form.get('code') ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code) || backend() !== 'supabase') return { error: 'mfa', mfa: true };
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.find((f) => f.status === 'verified');
  if (!factor) return { error: 'mfa', mfa: true };
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (chErr || !challenge) return { error: 'mfa', mfa: true };
  const { error } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });
  if (error) return { error: 'mfa', mfa: true };
  redirect('/admin');
}

export async function logoutAction() {
  await signOut();
  redirect('/admin/login');
}

export async function setAdminPreference(kind: 'locale' | 'theme', value: string) {
  const jar = await cookies();
  const opts = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' as const, httpOnly: false };
  if (kind === 'locale' && isLocale(value)) jar.set(ADMIN_LOCALE_COOKIE, value, opts);
  if (kind === 'theme' && (value === 'light' || value === 'dark'))
    jar.set('admin_theme', value, opts);
}
