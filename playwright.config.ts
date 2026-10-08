import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Smoke tests. Runs against `pnpm dev` (local PGlite backend) unless E2E_BASE_URL points
 * elsewhere. Admin specs reuse one login (see e2e/auth.setup.ts) because login is rate-limited.
 */
export default defineConfig({
  testDir: './e2e',
  // refuses to run unless the server is on the local demo backend (never the real Supabase)
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'tr-TR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'public',
      testMatch: /public\/.*\.spec\.ts/,
      // a returning visitor: cookie choice made, already applied — no prompt in the way of a
      // test (prompts.spec.ts starts from a clean browser to test the prompts themselves)
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'e2e/visitor-state.json',
      },
    },
    {
      name: 'admin',
      testMatch: /admin\/.*\.spec\.ts/,
      // `public` first: the leads spec checks the lead the wizard spec submitted.
      dependencies: ['setup', 'public'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'e2e/.auth/admin.json',
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev:local',
        url: `${baseURL}/admin/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
