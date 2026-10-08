import 'server-only';

/**
 * Backend selection.
 *  - "supabase": DATABASE_URL + Supabase URL/keys are set → production path.
 *  - "local":    nothing set → PGlite (real Postgres in WASM) running the same migrations, with a
 *                local cookie session instead of Supabase Auth. Allowed only outside production
 *                unless ALLOW_LOCAL_BACKEND=1 (used by e2e tests against `next start`).
 */
export type Backend = 'supabase' | 'local';

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

export const env = {
  supabaseUrl: read('NEXT_PUBLIC_SUPABASE_URL'),
  // Legacy "anon" key or the newer "publishable" key (sb_publishable_…) — either works.
  supabaseAnonKey:
    read('NEXT_PUBLIC_SUPABASE_ANON_KEY') ?? read('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  /**
   * Server-only. Legacy "service_role" key or the newer "secret" key (sb_secret_…). Used ONLY by
   * lib/auth/accounts.ts to create/reset/delete client portal accounts.
   */
  supabaseServiceRoleKey: read('SUPABASE_SERVICE_ROLE_KEY') ?? read('SUPABASE_SECRET_KEY'),
  databaseUrl: read('DATABASE_URL'),
  siteUrl: read('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000',
  ipHashSalt: read('IP_HASH_SALT') ?? 'dev-only-salt',
  localAdminEmail: read('LOCAL_ADMIN_EMAIL') ?? 'muzahim@local.test',
  localAdminPassword: read('LOCAL_ADMIN_PASSWORD') ?? 'mutfak-demo-2026',
  localClientEmail: read('LOCAL_CLIENT_EMAIL') ?? 'danisan@local.test',
  localClientPassword: read('LOCAL_CLIENT_PASSWORD') ?? 'danisan-demo-2026',
  localDataDir: read('LOCAL_DATA_DIR') ?? '.demo-data',
  previewUnreviewed: read('PREVIEW_UNREVIEWED_TRANSLATIONS') === '1',
  anthropicApiKey: read('ANTHROPIC_API_KEY'),
};

/** The role inside a legacy Supabase JWT key ("anon" / "service_role"), if it is one. */
function jwtRole(key: string): string | undefined {
  try {
    return JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString('utf8')).role;
  } catch {
    return undefined;
  }
}

/** A secret key in a NEXT_PUBLIC_ variable would be shipped to every visitor: refuse to start. */
function assertNoPublicSecret() {
  for (const name of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
    const v = read(name);
    if (v && (v.startsWith('sb_secret_') || jwtRole(v) === 'service_role')) {
      throw new Error(
        `${name} contains a SECRET Supabase key. Put the publishable/anon key there and the secret key in SUPABASE_SERVICE_ROLE_KEY (server-only), then rotate the secret key in Supabase.`,
      );
    }
  }
}

export function backend(): Backend {
  assertNoPublicSecret();
  if (env.databaseUrl && env.supabaseUrl && env.supabaseAnonKey) {
    // Rate-limit keys are salted IP hashes; a public default salt would make them reversible.
    if (process.env.NODE_ENV === 'production' && !read('IP_HASH_SALT')) {
      throw new Error('IP_HASH_SALT is required in production (32+ random characters).');
    }
    return 'supabase';
  }
  if (process.env.NODE_ENV === 'production' && read('ALLOW_LOCAL_BACKEND') !== '1') {
    throw new Error(
      'Supabase is not configured. Set DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).',
    );
  }
  return 'local';
}
