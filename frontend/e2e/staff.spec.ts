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
  const calls = { logins: 0, statusChanges: [] as string[], queueRequests: [] as string[], reportRequests: [] as string[], scheduleCalls: [] as string[], scheduleBodies: [] as unknown[], timeOffBodies: [] as unknown[] };
  let intervals = [{ weekday: 0, start_time: '09:00:00', end_time: '17:00:00' }];
  let timeOff: { id: number; starts_on: string; ends_on: string; reason: string | null }[] = [];
  let nextTimeOffId = 1;
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
    const scheduleView = () => ({ barber_id: 1, barber_name: 'Raka Pratama', intervals, time_off: timeOff });
    if (path === '/staff/barbers/1/schedule') {
      calls.scheduleCalls.push(request.method());
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as { intervals: { weekday: number; start_time: string; end_time: string }[] };
        calls.scheduleBodies.push(body);
        intervals = body.intervals.map((i) => ({ ...i, start_time: `${i.start_time}:00`, end_time: `${i.end_time}:00` }));
      }
      return reply(200, scheduleView());
    }
    if (path === '/staff/barbers/1/time-off' && request.method() === 'POST') {
      const body = request.postDataJSON() as { starts_on: string; ends_on: string; reason: string | null };
      calls.timeOffBodies.push(body);
      if (body.starts_on === '2099-12-24') return reply(409, { detail: 'Masih ada 2 reservasi aktif pada rentang itu. Batalkan atau selesaikan dulu.', code: 'time_off_conflict' });
      const created = { id: nextTimeOffId++, starts_on: body.starts_on, ends_on: body.ends_on, reason: body.reason };
      timeOff = [...timeOff, created];
      return reply(201, created);
    }
    const removal = path.match(/^\/staff\/time-off\/(\d+)$/);
    if (removal && request.method() === 'DELETE') {
      timeOff = timeOff.filter((t) => t.id !== Number(removal[1]));
      return route.fulfill({ status: 204, headers: cors });
    }
    if (path === '/staff/reports') {
      calls.reportRequests.push(url.search);
      const peak = Array(24).fill(0); peak[9] = 4; peak[14] = 2;
      return reply(200, {
        start: url.searchParams.get('start'), end: url.searchParams.get('end'),
        counts: { pending: 1, confirmed: 0, in_service: 0, completed: 5, cancelled: 1, no_show: 1 }, completed: 5, revenue_idr: 375000, no_show_rate: 0.1667,
        by_service: [{ id: 1, name: 'Classic Haircut', total: 7, completed: 5, no_show: 1, revenue_idr: 375000 }],
        by_barber: [{ id: 1, name: 'Raka Pratama', total: 4, completed: 3, no_show: 0, revenue_idr: 225000 }, { id: 2, name: 'Dimas Putra', total: 3, completed: 2, no_show: 1, revenue_idr: 150000 }],
        peak_hours: peak,
      });
    }
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

test('admin opens the report page and sees totals, per-barber rows and busy hours', async ({ page }) => {
  const calls = await mockStaffApi(page);
  await signIn(page);
  await page.getByRole('link', { name: 'Laporan' }).click();
  await expect(page.getByRole('heading', { name: 'Laporan' })).toBeVisible();
  const kpis = page.getByRole('list', { name: 'Ringkasan' });
  await expect(kpis).toContainText('375.000');
  await expect(kpis).toContainText('16.7%');
  await expect(page.getByRole('region', { name: 'Per barber' }).getByRole('row', { name: /Dimas Putra/ })).toContainText('150.000');
  const peaks = page.getByRole('region', { name: 'Jam tersibuk' });
  await expect(peaks).toContainText('09:00');
  await expect(peaks).toContainText('14:00');
  await expect(peaks).not.toContainText('10:00');
  // changing the range asks the server again with the new dates
  await page.getByLabel('Dari').fill('2026-10-01');
  await expect.poll(() => calls.reportRequests.some((q) => q.includes('start=2026-10-01'))).toBe(true);
});

test('a barber has no report link and the page does not call the API', async ({ page }) => {
  const calls = await mockStaffApi(page);
  await signIn(page, 'raka');
  await expect(page.getByRole('heading', { name: 'Antrean harian' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Laporan' })).toHaveCount(0);
  await page.goto('/staff/reports');
  await expect(page.getByRole('alert')).toContainText('hanya untuk admin');
  expect(calls.reportRequests).toEqual([]);
});

test('admin edits the weekly schedule and the save sends the whole new grid', async ({ page }) => {
  const calls = await mockStaffApi(page);
  await signIn(page);
  await page.getByRole('link', { name: 'Jadwal' }).click();
  await expect(page.getByRole('heading', { name: 'Jadwal dan cuti' })).toBeVisible();
  await expect(page.getByLabel('Barber')).toHaveValue('1');
  await expect(page.getByLabel('Senin mulai')).toHaveValue('09:00');
  await expect(page.getByLabel('Selasa mulai')).toHaveCount(0);   // no hours on Tuesday yet: shown as "Libur"

  await page.getByLabel('Senin selesai').fill('15:00');
  await page.getByRole('button', { name: 'Tambah jam Selasa' }).click();
  await page.getByLabel('Selasa mulai').fill('10:00');
  await page.getByRole('button', { name: 'Simpan jadwal' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Jadwal Raka Pratama disimpan' })).toBeVisible();
  expect(calls.scheduleBodies).toEqual([{ intervals: [
    { weekday: 0, start_time: '09:00', end_time: '15:00' },
    { weekday: 1, start_time: '10:00', end_time: '17:00' },
  ] }]);
  await expect(page.getByLabel('Selasa mulai')).toHaveValue('10:00');   // reloaded from the server's answer
});

test('admin adds, is refused for, and removes time off', async ({ page }) => {
  const calls = await mockStaffApi(page);
  await signIn(page);
  await page.getByRole('link', { name: 'Jadwal' }).click();
  await expect(page.getByText('Tidak ada cuti terjadwal.')).toBeVisible();

  await page.getByLabel('Mulai', { exact: true }).fill('2099-11-20');
  await page.getByLabel('Sampai', { exact: true }).fill('2099-11-21');
  await page.getByLabel('Alasan (opsional)').fill('Libur keluarga');
  await page.getByRole('button', { name: 'Tambah cuti' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cuti ditambahkan' })).toBeVisible();
  await expect(page.getByText('2099-11-20 → 2099-11-21')).toBeVisible();
  await expect(page.getByText('Libur keluarga')).toBeVisible();
  expect(calls.timeOffBodies[0]).toEqual({ starts_on: '2099-11-20', ends_on: '2099-11-21', reason: 'Libur keluarga' });

  await page.getByLabel('Mulai', { exact: true }).fill('2099-12-24');
  await page.getByLabel('Sampai', { exact: true }).fill('2099-12-24');
  await page.getByRole('button', { name: 'Tambah cuti' }).click();
  await expect(page.getByRole('alert')).toContainText('Masih ada 2 reservasi aktif');
  await expect(page.getByText('2099-12-24')).toHaveCount(0);       // the refused leave was not listed

  page.once('dialog', (dlg) => dlg.accept());
  await page.getByRole('button', { name: 'Hapus cuti 2099-11-20' }).click();
  await expect(page.getByText('Tidak ada cuti terjadwal.')).toBeVisible();
});

test('a barber has no schedule link and the page makes no schedule request', async ({ page }) => {
  const calls = await mockStaffApi(page);
  await signIn(page, 'raka');
  await expect(page.getByRole('link', { name: 'Jadwal' })).toHaveCount(0);
  await page.goto('/staff/schedule');
  await expect(page.getByRole('alert')).toContainText('hanya untuk admin');
  expect(calls.scheduleCalls).toEqual([]);
});
