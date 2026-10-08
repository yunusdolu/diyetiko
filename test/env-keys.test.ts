import { afterEach, describe, expect, it, vi } from 'vitest';

/** lib/env reads process.env at import time → reset modules per case. */
async function load(vars: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  return import('@/lib/env');
}

const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.y`;
const BASE = {
  DATABASE_URL: 'postgres://u:p@h:6543/db',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
};

afterEach(() => vi.unstubAllEnvs());

describe('Supabase keys', () => {
  it('accepts the new publishable / secret key names', async () => {
    const { env, backend } = await load({
      ...BASE,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc',
      SUPABASE_SECRET_KEY: 'sb_secret_xyz',
    });
    expect(env.supabaseAnonKey).toBe('sb_publishable_abc');
    expect(env.supabaseServiceRoleKey).toBe('sb_secret_xyz');
    expect(backend()).toBe('supabase');
  });

  it('accepts the legacy anon / service_role names', async () => {
    const { env } = await load({
      ...BASE,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'),
      SUPABASE_SERVICE_ROLE_KEY: jwt('service_role'),
    });
    expect(env.supabaseAnonKey).toBe(jwt('anon'));
    expect(env.supabaseServiceRoleKey).toBe(jwt('service_role'));
  });

  it('refuses a secret key in a browser-exposed variable', async () => {
    const a = await load({ ...BASE, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_oops' });
    expect(() => a.backend()).toThrow(/SECRET/);
    vi.unstubAllEnvs();
    const b = await load({ ...BASE, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') });
    expect(() => b.backend()).toThrow(/SECRET/);
  });
});
