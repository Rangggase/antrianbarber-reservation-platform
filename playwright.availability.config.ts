import { defineConfig, devices } from '@playwright/test';

/** Dedicated API-mode UI tests using mocked, deterministic FastAPI responses. */
export default defineConfig({
  testDir: './qa-v23b',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-v23b' }]],
  outputDir: 'test-results-v23b',
  use: {
    baseURL: 'http://127.0.0.1:4183',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4183 --strictPort',
    url: 'http://127.0.0.1:4183/',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      VITE_CATALOG_SOURCE: 'api',
      VITE_BOOKING_AVAILABILITY_SOURCE: 'api',
      VITE_BOOKING_TRANSACTIONS_SOURCE: 'demo',
      VITE_API_BASE_URL: 'http://127.0.0.1:8000',
    },
  },
});
