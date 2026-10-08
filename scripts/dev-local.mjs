/**
 * `pnpm dev:local` — the dev server on the LOCAL demo backend (PGlite), even when .env.local holds
 * Supabase credentials. Next only reads a variable from .env files when the process environment
 * does not define it, so defining the Supabase ones as empty strings switches them off for this
 * run without touching .env.local. Used by the e2e suite so tests never write to the real project.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const off = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const env = { ...process.env, ...Object.fromEntries(off.map((k) => [k, ''])) };
// run Next's own CLI with this Node binary: no shell, works the same on Windows and Unix
const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
const child = spawn(process.execPath, [next, 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
