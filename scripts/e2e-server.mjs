/**
 * The server `pnpm test:e2e` starts: the app on the local demo backend at http://localhost:3100,
 * beside — never instead of — the everyday `pnpm dev` (Supabase) on :3000.
 *
 * - Its own database in `e2e/.sandbox`, deleted and rebuilt from the seed on every run, so the
 *   suite starts from the same, current data (the seed's dates are relative to the day it is
 *   built: the birthday in the coming week, the meeting ahead).
 * - Its own build folder (`.next/e2e`): Next allows one `next dev` per build folder.
 * - Its own site address, so links the app writes (shares, e-mails) point back at this server.
 * The real Supabase project is switched off for this process (scripts/dev-local.mjs).
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_PORT = 3100;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sandbox = 'e2e/.sandbox';

rmSync(path.join(root, sandbox), { recursive: true, force: true });

const child = spawn(
  process.execPath,
  [path.join(root, 'scripts', 'dev-local.mjs'), '--port', String(E2E_PORT)],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      LOCAL_DATA_DIR: sandbox,
      NEXT_DIST_DIR: '.next/e2e',
      NEXT_PUBLIC_SITE_URL: `http://localhost:${E2E_PORT}`,
    },
  },
);
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
