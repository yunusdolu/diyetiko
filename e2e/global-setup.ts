import { request, type FullConfig } from '@playwright/test';
import { BASE_URL } from './base';

/**
 * The suite creates leads, clients and portal accounts. Refuse to run against anything but the
 * local demo backend, so a server started with real Supabase credentials is never written to.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? BASE_URL;
  const ctx = await request.newContext({ baseURL });
  const html = await (await ctx.get('/admin/login')).text();
  await ctx.dispose();
  if (!html.includes('data-backend="local"')) {
    throw new Error(
      `E2E refused: ${baseURL} is not running the local demo backend. Unset E2E_BASE_URL: \`pnpm test:e2e\` then starts its own local server on :3100.`,
    );
  }
}
