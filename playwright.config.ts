import { defineConfig, devices } from '@playwright/test';

import { AUTH_STATE_PATH } from './e2e/global-setup';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 'github' adds inline PR annotations on failing lines; 'json' feeds the
  // Job Summary step in ci.yml. Both CI-only -- only useful (and 'github'
  // only auto-detected) there.
  reporter: process.env.CI
    ? [['list'], ['github'], ['json', { outputFile: 'playwright-report.json' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    // Rebuilds against local Supabase (see .env.e2e) every fresh run, then
    // serves the static build -- mirrors how ci.yml's Dev job builds once
    // and serves the result, just pointed at the local stack instead of
    // production.
    command: 'npm run build:e2e && npm run serve:e2e',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      // The login page redirects an already-authenticated user away
      // immediately (see LoginPage.tsx), so this spec needs a clean,
      // unauthenticated context -- deliberately NOT given storageState.
      name: 'unauthenticated',
      testMatch: /login\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'authenticated',
      testIgnore: /login\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE_PATH },
    },
  ],
});
