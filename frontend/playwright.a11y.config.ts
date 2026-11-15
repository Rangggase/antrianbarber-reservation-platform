import { defineConfig, devices } from '@playwright/test';

/** Automated accessibility scan (axe). Demo data, dev server on 4173 as in the default config. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'a11y.spec.ts',
  timeout: 60_000,
  reporter: [['list']],
  outputDir: 'test-results-a11y',
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'id-ID', timezoneId: 'Asia/Jakarta' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1365, height: 768 } } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: { VITE_CATALOG_SOURCE: 'demo', VITE_BOOKING_AVAILABILITY_SOURCE: 'demo', VITE_BOOKING_TRANSACTIONS_SOURCE: 'demo' },
  },
});
