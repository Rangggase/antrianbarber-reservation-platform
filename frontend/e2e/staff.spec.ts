import { test, expect, type Page } from '@playwright/test';

const API = 'http://127.0.0.1:8000/api/v1';
const TOKEN = 'TEST_STAFF_JWT_TOKEN';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type,Authorization,X-Booking-Token,Accept', 'access-control-allow-methods': 'GET,POST,OPTIONS' };

function todayWib() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (n: string) => parts.find((x) => x.type === n)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const NEXT: Record<string, string[]> = { pending: ['confirmed', 'cancelled'], confirmed: ['in_service', 'cancelled', 'no_show'], in_service: ['completed'] };

type Row = { reference_code: string; customer_name: string; customer_phone: string; barber_id: number; barber_name: string; service_id: number; service_name: string; starts_at: string; ends_at: string; status: string; queue_number: number | null; price_idr: number; allowed_next: string[] };

function seed(): Row[] {
  const day = todayWib();
  const row = (code: string, name: string, phone: string, barberId: number, hour: string): Row => ({
    reference_code: code, customer_name: name, customer_phone: phone, barber_id: barberId, barber_name: barberId === 1 ? 'Raka Pratama' : 'Dimas Putra',
    service_id: 1, service_name: 'Classic Haircut', starts_at: `${day}T${hour}:00+07:00`, ends_at: `${day}T${hour}:45+07:00`,
    status: 'pending', queue_number: null, price_idr: 55000, allowed_next: NEXT.pending,
  });
  return [row('AB-20261110-AAAA000001', 'Budi Demo', '081200000001', 1, '10'), row('AB-20261110-BBBB000002', 'Sari Demo', '081200000002', 2, '11')];
}

type Opts = { queueStatus?: number };

async function mockStaffApi(page: Page, opts: Opts = {}) {
  const rows = seed();
  const calls = { logins: 0, statusChanges: [] as string[], queueRequests: [] as string[] };
  let nextQueue = 1;
  await page.route(`${API}/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const reply = (status: number, json: unknown) => route.fulfill({ status, json, headers: cors });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '', headers: cors });
    if (path === '/barbers') return reply(200, [{ id: 1, code: 'raka', full_name: 'Raka Pratama', specialty: 'Fade', bio: null }, { id: 2, code: 'dimas', full_name: 'Dimas Putra', specialty: 'Classic', bio: null }]);
    if (path === '/staff/login' && request.method() === 'POST') {
      calls.logins++;
      const body = request.postDataJSON() as { username: string; password: string };
      if (body.password !== 'secret-pass-123') return reply(401, { detail: 'Username atau password salah', code: 'invalid_credentials' });
      const barber = body.username === 'raka';
      return reply(200, { access_token: TOKEN, token_type: 'bearer', expires_in: 3600, user: barber ? { id: 2, username: 'raka', full_name: 'Raka Staff', role: 'barber', barber_id: 1 } : { id: 1, username: 'admin', full_name: 'Admin Demo', role: 'admin', barber_id: null } });
    }
    if (!path.startsWith('/staff/')) return reply(404, { detail: 'Not Found', code: 'not_found' });
    if (request.headers()['authorization'] !== `Bearer ${TOKEN}`) return reply(401, { detail: 'Login diperlukan.', code: 'unauthorized' });
    if (path === '/staff/queue') {
      calls.queueRequests.push(url.search);
      if (opts.queueStatus) return reply(opts.queueStatus, { detail: 'Sesi tidak valid atau sudah berakhir. Silakan login ulang.', code: 'unauthorized' });
      const barberId = url.searchParams.get('barber_id');
      const list = rows.filter((r) => !barberId || r.barber_id === Number(barberId));
      const counts: Record<string, number> = { pending: 0, confirmed: 0, in_service: 0, completed: 0, cancelled: 0, no_show: 0 };
      for (const r of list) counts[r.status]++;
      return reply(200, { date: url.searchParams.get('date'), barber_id: barberId ? Number(barberId) : null, bookings: list, counts });
    }
    const match = path.match(/^\/staff\/bookings\/([^/]+)\/status$/);
    if (match && request.method() === 'POST') {
      const target = rows.find((r) => r.reference_code === match[1]);
      const { status } = request.postDataJSON() as { status: string };
      if (!target) return reply(404, { detail: 'Reservasi tidak ditemukan', code: 'booking_not_found' });
      if (!(NEXT[target.status] || []).includes(status)) return reply(409, { detail: `Status ${target.status} tidak dapat diubah ke ${status}.`, code: 'invalid_transition' });
      calls.statusChanges.push(`${target.reference_code}:${status}`);
      if (status === 'confirmed' && target.queue_number === null) target.queue_number = nextQueue++;
      target.status = status;
      target.allowed_next = NEXT[status] || [];
      return reply(200, target);
    }
    return reply(404, { detail: 'Not Found', code: 'not_found' });
  });
  return calls;
}

async function signIn(page: Page, username = 'admin', password = 'secret-pass-123') {
  await page.goto('/staff/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
}

test('wrong credentials show the server message and keep the user on the login page', async ({ page }) => {
  const calls = await mockStaffApi(page);
  await signIn(page, 'admin', 'wrong-password');
  await expect(page.getByRole('alert')).toContainText('Username atau password salah');
  await expect(page).toHaveURL(/\/staff\/login$/);
  await expect(page.getByLabel('Password')).toHaveValue('');
  expect(calls.logins).toBe(1);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
});

test('visiting the dashboard without a session redirects to login', async ({ page }) => {
  await mockStaffApi(page);
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/staff\/login$/);
  await expect(page.getByRole('heading', { name: 'Masuk staf' })).toBeVisible();
});

test('admin sees every barber, can filter, and walks a booking through the workflow with a queue number', async ({ page }) => {
  const calls = await mockStaffApi(page);
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Antrean harian' })).toBeVisible();
  await expect(page.getByText('Budi Demo')).toBeVisible();
  await expect(page.getByText('Sari Demo')).toBeVisible();
  await expect(page.getByText('081200000001')).toBeVisible();

  await page.getByLabel('Barber').selectOption({ label: 'Dimas Putra' });
  await expect(page.getByText('Budi Demo')).toHaveCount(0);
  await expect(page.getByText('Sari Demo')).toBeVisible();
  await page.getByLabel('Barber').selectOption({ label: 'Semua barber' });
  await expect(page.getByText('Budi Demo')).toBeVisible();

  await page.getByRole('button', { name: /^Konfirmasi — Budi Demo/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'nomor antrean 1' })).toBeVisible();
  await expect(page.getByText('Antrean #1')).toBeVisible();
  await page.getByRole('button', { name: /^Mulai layanan — Budi Demo/ }).click();
  await page.getByRole('button', { name: /^Selesai — Budi Demo/ }).click();
  await expect(page.getByRole('list', { name: 'Ringkasan status' })).toContainText('1 Selesai');
  await expect(page.getByRole('button', { name: /— Budi Demo/ })).toHaveCount(0); // final status: no more actions
  expect(calls.statusChanges).toEqual(['AB-20261110-AAAA000001:confirmed', 'AB-20261110-AAAA000001:in_service', 'AB-20261110-AAAA000001:completed']);
});

test('destructive actions ask for confirmation and can be declined', async ({ page }) => {
  const calls = await mockStaffApi(page);
  await signIn(page);
  page.once('dialog', (dlg) => dlg.dismiss());
  await page.getByRole('button', { name: /^Batalkan — Sari Demo/ }).click();
  await expect(page.getByText('Menunggu').first()).toBeVisible();
  expect(calls.statusChanges).toEqual([]);
  page.once('dialog', (dlg) => dlg.accept());
  await page.getByRole('button', { name: /^Batalkan — Sari Demo/ }).click();
  await expect(page.getByRole('list', { name: 'Ringkasan status' })).toContainText('1 Dibatalkan');
  expect(calls.statusChanges).toEqual(['AB-20261110-BBBB000002:cancelled']);
});

test('a barber account has no barber filter', async ({ page }) => {
  await mockStaffApi(page);
  await signIn(page, 'raka');
  await expect(page.getByRole('heading', { name: 'Antrean harian' })).toBeVisible();
  await expect(page.getByLabel('Barber')).toHaveCount(0);
  await expect(page.getByLabel('Tanggal (WIB)')).toBeVisible();
});

test('an expired or revoked session (401) returns to login with a message', async ({ page }) => {
  await mockStaffApi(page, { queueStatus: 401 });
  await signIn(page);
  await expect(page).toHaveURL(/\/staff\/login$/);
  await expect(page.getByRole('status').filter({ hasText: 'Sesi tidak valid' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
});

test('logging out clears the session', async ({ page }) => {
  await mockStaffApi(page);
  await signIn(page);
  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/staff\/login$/);
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/staff\/login$/);
});

test('customer sees queue number and estimated wait after checking status', async ({ page }) => {
  const code = 'AB-20261110-CCCC000003';
  const day = todayWib();
  await page.addInitScript(([key, ticket]) => sessionStorage.setItem(key, JSON.stringify([ticket])), [
    'antrian-barber-api-tickets-session-v23c',
    { reference_code: code, barber_id: 1, service_id: 1, starts_at: `${day}T15:00:00+07:00`, ends_at: `${day}T15:45:00+07:00`, status: 'pending', price_idr: 55000, access_token: 'SAMPLE_PRIVATE_TOKEN_1234567890' },
  ] as const);
  await page.route(`${API}/**`, (route) => {
    const url = new URL(route.request().url());
    const reply = (json: unknown) => route.fulfill({ status: 200, json, headers: cors });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, body: '', headers: cors });
    if (url.pathname.endsWith('/services')) return reply([{ id: 1, code: 'classic', name: 'Classic Haircut', description: 'x', duration_minutes: 45, price_idr: 55000 }]);
    if (url.pathname.endsWith('/barbers')) return reply([{ id: 1, code: 'raka', full_name: 'Raka Pratama', specialty: 'Fade', bio: null }]);
    if (url.pathname.endsWith(`/bookings/${code}`)) return reply({ reference_code: code, barber_id: 1, service_id: 1, starts_at: `${day}T15:00:00+07:00`, ends_at: `${day}T15:45:00+07:00`, status: 'confirmed', price_idr: 55000, queue_number: 4, ahead_count: 2, estimated_wait_minutes: 90 });
    return route.fulfill({ status: 404, json: { detail: 'Not Found' }, headers: cors });
  });
  await page.goto('/reservasi');
  await page.getByRole('button', { name: 'Periksa status' }).click();
  await expect(page.getByText('Nomor antrean #4')).toBeVisible();
  await expect(page.getByText('2 antrean di depan · estimasi tunggu ±90 menit')).toBeVisible();
});
