import { defineConfig, devices } from '@playwright/test';

/**
 * Sprint 1: proves a PRODUCTION build (vite build + preview) talks to the API.
 * The API itself is mocked in the spec; nothing touches a real database.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'production-api.spec.ts',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-prod-api' }]],
  outputDir: 'test-results-prod-api',
  use: { baseURL: 'http://127.0.0.1:4185', timezoneId: 'Asia/Jakarta', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4185 --strictPort',
    url: 'http://127.0.0.1:4185/',
    timeout: 180_000,
    reuseExistingServer: false,
    env: { VITE_DATA_SOURCE: 'api', VITE_API_BASE_URL: 'http://127.0.0.1:8000' },
  },
});
