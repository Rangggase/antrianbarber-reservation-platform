import { defineConfig, devices } from '@playwright/test';

/** Staff back office + queue info: the API is mocked in the spec; nothing touches a database. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'staff.spec.ts',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-staff' }]],
  outputDir: 'test-results-staff',
  use: { baseURL: 'http://127.0.0.1:4186', timezoneId: 'Asia/Jakarta', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4186 --strictPort',
    url: 'http://127.0.0.1:4186/',
    timeout: 120_000,
    reuseExistingServer: false,
    env: { VITE_DATA_SOURCE: 'api', VITE_API_BASE_URL: 'http://127.0.0.1:8000' },
  },
});
