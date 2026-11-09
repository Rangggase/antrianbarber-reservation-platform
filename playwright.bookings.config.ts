import { defineConfig, devices } from '@playwright/test';

/** v2.3c browser tests mock API; no writes to local PostgreSQL. */
export default defineConfig({
  testDir: './qa-v23c',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open:'never', outputFolder:'playwright-report-v23c' }]],
  outputDir: 'test-results-v23c',
  use: { baseURL:'http://127.0.0.1:4184', timezoneId:'Asia/Jakarta', trace:'retain-on-failure', screenshot:'only-on-failure' },
  projects: [{ name:'chromium', use:{ ...devices['Desktop Chrome'] } }],
  webServer: {
    command:'npm run dev -- --host 127.0.0.1 --port 4184 --strictPort',
    url:'http://127.0.0.1:4184/', timeout:120_000, reuseExistingServer:false,
    env:{ VITE_CATALOG_SOURCE:'api', VITE_BOOKING_AVAILABILITY_SOURCE:'api', VITE_BOOKING_TRANSACTIONS_SOURCE:'api', VITE_API_BASE_URL:'http://127.0.0.1:8000' },
  },
});
