import { defineConfig, devices } from '@playwright/test';

/** Sprint 5a: tests the new design system primitives on the dev-only /ui-kit page. No API involved. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'ui-kit.spec.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-ui' }]],
  outputDir: 'test-results-ui',
  use: { baseURL: 'http://127.0.0.1:4187', timezoneId: 'Asia/Jakarta', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187/',
    timeout: 120_000,
    reuseExistingServer: false,
    env: { VITE_DATA_SOURCE: 'demo', VITE_CATALOG_SOURCE: 'demo', VITE_BOOKING_AVAILABILITY_SOURCE: 'demo', VITE_BOOKING_TRANSACTIONS_SOURCE: 'demo' },
  },
});
