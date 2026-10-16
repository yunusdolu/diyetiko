/** Where the suite runs: its own server (scripts/e2e-server.mjs), or E2E_BASE_URL. */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3100';
