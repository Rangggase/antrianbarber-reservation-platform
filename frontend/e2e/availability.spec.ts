import { test, expect, type Page } from '@playwright/test';

const services = [{ id:1, code:'classic', name:'Classic Haircut', description:'Demo service', duration_minutes:45, price_idr:55000 },
                  { id:2, code:'fade', name:'Fade & Taper', description:'Demo fade', duration_minutes:60, price_idr:75000 }];
const barbers = [{ id:1, code:'raka', full_name:'Raka Pratama', specialty:'Fade', bio:'Demo barber' },
                 { id:2, code:'naufal', full_name:'Naufal Ardi', specialty:'Classic', bio:'Demo barber' }];

async function mockApi(page: Page) {
  await page.route('http://127.0.0.1:8000/api/v1/services', route => route.fulfill({ json: services, headers: { 'access-control-allow-origin':'*' } }));
  await page.route('http://127.0.0.1:8000/api/v1/barbers', route => route.fulfill({ json: barbers, headers: { 'access-control-allow-origin':'*' } }));
  await page.route('http://127.0.0.1:8000/api/v1/availability?**', route => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date') ?? '2026-11-10';
    const barber_id = Number(url.searchParams.get('barber_id'));
    const service_id = Number(url.searchParams.get('service_id'));
    return route.fulfill({
      json: { date, barber_id, service_id, timezone:'Asia/Jakarta',
        slots: barber_id === 1 ? [`${date}T10:00:00+07:00`,`${date}T10:30:00+07:00`] : [] },
      headers: { 'access-control-allow-origin':'*' },
    });
  });
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Jakarta', year:'numeric', month:'2-digit', day:'2-digit' });
  const parts = fmt.formatToParts(d);
  const part = (type: string) => parts.find(x => x.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

test('memuat slot API WIB sesuai barber dan layanan; pergantian barber membersihkan waktu', async ({ page }) => {
  await mockApi(page);
  await page.goto('/reservasi');
  await page.getByRole('group', { name:'Pilih layanan' }).getByRole('button', { name:/Classic Haircut/ }).click();
  await page.getByRole('button', { name:'Lanjutkan' }).click();
  await page.getByRole('group', { name:'Pilih barber' }).getByRole('button', { name:/Raka Pratama/ }).click();
  await page.locator('#wizard-date').fill(tomorrow());
  const slots = page.getByRole('group', { name:'Jam preferensi' });
  await expect(slots.getByRole('button',{ name:'10:00' })).toBeVisible();
  await slots.getByRole('button', { name:'10:00' }).click();
  await page.getByRole('group', { name:'Pilih barber' }).getByRole('button', { name:/Naufal Ardi/ }).click();
  await expect(page.getByText('Tidak ada slot API untuk pilihan ini.')).toBeVisible();
  await page.getByRole('button', { name:'Lanjutkan' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Pilih jam yang tersedia dari API.' })).toBeVisible();
});

test('saat API availability gagal, slot tidak diambil dari data statis', async ({ page }) => {
  await mockApi(page);
  await page.route('http://127.0.0.1:8000/api/v1/availability?**', route => route.fulfill({ status:503, json:{ detail:'Unavailable' }, headers: { 'access-control-allow-origin':'*' } }));
  await page.goto('/reservasi');
  await page.getByRole('group', { name:'Pilih layanan' }).getByRole('button', { name:/Classic Haircut/ }).click();
  await page.getByRole('button', { name:'Lanjutkan' }).click();
  await page.getByRole('group', { name:'Pilih barber' }).getByRole('button', { name:/Raka Pratama/ }).click();
  await page.locator('#wizard-date').fill(tomorrow());
  await expect(page.getByRole('alert').filter({ hasText:'Slot API gagal dimuat' })).toBeVisible();
  await expect(page.getByRole('group', { name:'Jam preferensi' })).toHaveCount(0);
  await page.getByRole('button', { name:'Lanjutkan' }).click();
  await expect(page.getByRole('heading', { name:'Pilih barber & jadwal.' })).toBeVisible();
});
