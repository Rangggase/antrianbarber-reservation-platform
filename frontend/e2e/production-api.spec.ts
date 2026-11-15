import { test, expect, type Page } from '@playwright/test';

// Names that exist ONLY in the mocked API (not in the bundled demo data):
// seeing them proves the production bundle fetched them from the API.
const services = [{ id: 1, code: 'classic', name: 'API Sentinel Cut', description: 'From API', duration_minutes: 45, price_idr: 55000 }];
const barbers = [{ id: 1, code: 'raka', full_name: 'API Sentinel Barber', specialty: 'Fade', bio: null }];
const accessToken = 'SAMPLE_PRIVATE_TOKEN_1234567890';
const code = 'AB-20261110-ABCDEF1234';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type,X-Booking-Token,Accept', 'access-control-allow-methods': 'GET,POST,OPTIONS' };

function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const part = (n: string) => parts.find(x => x.type === n)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function mockApi(page: Page) {
  const day = tomorrow();
  const calls = { services: 0, barbers: 0, availability: 0, created: 0 };
  await page.route('http://127.0.0.1:8000/api/v1/**', route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const reply = (status: number, json: unknown) => route.fulfill({ status, json, headers: cors });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '', headers: cors });
    if (path.endsWith('/services')) { calls.services++; return reply(200, services); }
    if (path.endsWith('/barbers')) { calls.barbers++; return reply(200, barbers); }
    if (path.endsWith('/availability')) {
      calls.availability++;
      return reply(200, { date: url.searchParams.get('date'), barber_id: 1, service_id: 1, timezone: 'Asia/Jakarta', slots: [`${day}T10:00:00+07:00`] });
    }
    if (path.endsWith('/bookings') && request.method() === 'POST') {
      calls.created++;
      return reply(201, { reference_code: code, barber_id: 1, service_id: 1, starts_at: `${day}T10:00:00+07:00`, ends_at: `${day}T10:45:00+07:00`, status: 'pending', price_idr: 55000, access_token: accessToken });
    }
    return reply(404, { detail: 'Not Found' });
  });
  return calls;
}

test('production build loads the service catalog from the API', async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto('/layanan');
  await expect(page.getByText('API Sentinel Cut').first()).toBeVisible();
  expect(calls.services).toBeGreaterThan(0);
});

test('production build shows an error state with retry when the API is down', async ({ page }) => {
  await page.route('http://127.0.0.1:8000/api/v1/**', route => route.abort());
  await page.goto('/layanan');
  const alert = page.getByRole('alert').filter({ hasText: 'Data layanan belum dapat dimuat' });
  await expect(alert).toBeVisible();
  // a failed fetch is explained in plain words: never the browser's raw "Failed to fetch"
  await expect(alert).toContainText('Tidak dapat terhubung ke server');
  await expect(alert).not.toContainText('Failed to fetch');
  await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
});

test('production build creates a booking through the API', async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto('/reservasi');
  await page.getByRole('group', { name: 'Pilih layanan' }).getByRole('button', { name: /API Sentinel Cut/ }).click();
  await page.getByRole('button', { name: 'Lanjutkan' }).click();
  await page.getByRole('group', { name: 'Pilih barber' }).getByRole('button', { name: /API Sentinel Barber/ }).click();
  await page.locator('#wizard-date').fill(tomorrow());
  const slot = page.getByRole('group', { name: 'Jam preferensi' }).getByRole('button', { name: '10:00' });
  await expect(slot).toBeVisible(); await slot.click();
  await page.getByRole('button', { name: 'Lanjutkan' }).click();
  await page.locator('#wizard-name').fill('Pelanggan Demo');
  await page.locator('#wizard-phone').fill('081299991234');
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Lanjutkan' }).click();
  await page.getByRole('button', { name: 'Buat Tiket' }).click();
  await expect(page.getByRole('dialog')).toContainText(code);
  expect(calls.created).toBe(1);
});
