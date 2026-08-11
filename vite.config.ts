import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ holds Playwright specs -- run only via `npx playwright test`,
    // never picked up by Vitest even though they also match *.spec.ts.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Defined here (not as CLI --reporter flags in ci.yml) because CLI
    // reporter flags fully replace this array rather than merge with it --
    // confirmed by testing, not assumed. github-actions defaults to ALSO
    // writing its own markdown summary to $GITHUB_STEP_SUMMARY
    // (jobSummary.enabled: true), disabled since ci.yml's own "Write test
    // summary" step already covers that in the exact format wanted;
    // displayAnnotations (inline PR line annotations on failures) stays on.
    reporters: process.env.CI
      ? [
          'default',
          ['github-actions', { jobSummary: { enabled: false } }],
          ['json', { outputFile: 'vitest-report.json' }],
        ]
      : ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/main.tsx',
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
  plugins: [react()],
});
