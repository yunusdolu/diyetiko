import 'server-only';
import { asService } from '@/lib/db';
import { backend, env } from '@/lib/env';

/**
 * Client portal accounts: create, reset password, delete. The ONLY place that uses the Supabase
 * service-role key (Admin API) — nothing else in the app needs it. In local mode the stand-in
 * auth table is written directly (service role).
 */

export type AccountError = 'exists' | 'weak' | 'failed';

/** Whether client logins can be created here (Supabase needs SUPABASE_SERVICE_ROLE_KEY). */
export function accountsConfigured(): boolean {
  return backend() === 'local' || Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

async function admin() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required to create client portal accounts (see KURULUM.md).',
    );
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function createClientAccount(
  email: string,
  password: string,
  fullName: string,
): Promise<{ id: string } | { error: AccountError }> {
  if (backend() === 'local') {
    const { hashPassword } = await import('@/lib/db/pglite');
    const [exists] = await asService((tx) =>
      tx.query(`select 1 from auth.users where lower(email) = lower($1)`, [email]),
    );
    if (exists) return { error: 'exists' };
    const [row] = await asService((tx) =>
      tx.query<{ id: string }>(
        `insert into auth.users (email, encrypted_password, raw_user_meta_data, raw_app_meta_data)
         values ($1, $2, jsonb_build_object('full_name', $3::text), '{"role":"client"}'::jsonb) returning id`,
        [email, hashPassword(password), fullName],
      ),
    );
    return { id: row!.id };
  }
  const supabase = await admin();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // the invite link itself proves the address belongs to the client
    user_metadata: { full_name: fullName },
    app_metadata: { role: 'client' },
  });
  if (error || !data.user) {
    const msg = error?.message ?? '';
    if (/already|registered|exists/i.test(msg)) return { error: 'exists' };
    if (/password/i.test(msg)) return { error: 'weak' };
    return { error: 'failed' };
  }
  return { id: data.user.id };
}

export async function setAccountPassword(userId: string, password: string): Promise<boolean> {
  if (backend() === 'local') {
    const { hashPassword } = await import('@/lib/db/pglite');
    const rows = await asService((tx) =>
      tx.query(`update auth.users set encrypted_password = $2 where id = $1 returning id`, [
        userId,
        hashPassword(password),
      ]),
    );
    return rows.length === 1;
  }
  const supabase = await admin();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  return !error;
}

/**
 * Deletes a CLIENT portal account — refuses anything that is not a client (never the dietitian).
 * The client record is unlinked (FK on delete set null); diary data stays with the practice.
 */
export async function deleteAccount(userId: string): Promise<boolean> {
  if (backend() === 'local') {
    const [p] = await asService((tx) =>
      tx.query<{ role: string }>(`select role::text as role from public.profiles where id = $1`, [
        userId,
      ]),
    );
    if (p && p.role !== 'client') return false;
    await asService((tx) => tx.query(`delete from auth.users where id = $1`, [userId]));
    return true;
  }
  const supabase = await admin();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (profile && profile.role !== 'client') return false;
  const { error } = await supabase.auth.admin.deleteUser(userId);
  return !error;
}
