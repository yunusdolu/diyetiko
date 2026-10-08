import { request, type FullConfig } from '@playwright/test';

/**
 * The suite creates leads, clients and portal accounts. Refuse to run against anything but the
 * local demo backend, so a server started with real Supabase credentials is never written to.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000';
  const ctx = await request.newContext({ baseURL });
  const html = await (await ctx.get('/admin/login')).text();
  await ctx.dispose();
  if (!html.includes('data-backend="local"')) {
    throw new Error(
      `E2E refused: ${baseURL} is not running the local demo backend. Stop that server and run \`pnpm test:e2e\` again (it starts \`pnpm dev:local\`), or start \`pnpm dev:local\` yourself.`,
    );
  }
}
