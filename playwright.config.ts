import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
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
    command: 'npm run serve',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
