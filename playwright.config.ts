import { defineConfig, devices } from '@playwright/test';

/** Baseline 19 regression tests remain offline demo-mode, deterministic. */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1365, height: 768 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    // Makes existing QA independent of PostgreSQL. Vite reads env at server start.
    env: {
      VITE_CATALOG_SOURCE: 'demo',
      VITE_BOOKING_AVAILABILITY_SOURCE: 'demo',
      VITE_BOOKING_TRANSACTIONS_SOURCE: 'demo',
    },
  },
});
