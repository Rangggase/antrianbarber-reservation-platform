import { expect, test, type Page } from '@playwright/test';

const service = (page: Page, label: RegExp = /Classic Haircut/) =>
  page.getByRole('group', { name: 'Pilih layanan' }).getByRole('button', { name: label });
const next = (page: Page) => page.getByRole('button', { name: /Lanjutkan/ });

async function tomorrowLocal(page: Page) {
  return page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

async function reachCustomerDetails(page: Page, date: string) {
  await service(page).click();
  await next(page).click();
  await expect(page.getByRole('heading', { name: 'Pilih barber & jadwal.' })).toBeVisible();
  await page.locator('#wizard-date').fill(date);
  await page.getByRole('group', { name: 'Jam preferensi' }).getByRole('button', { name: '09:00' }).click();
  await next(page).click();
  await expect(page.getByRole('heading', { name: 'Lengkapi data demo.' })).toBeVisible();
}

async function fillCustomerAndConfirm(page: Page, phone = '081234567890') {
  await page.getByLabel(/Nama lengkap/).fill('Pelanggan QA Otomatis');
  await page.getByLabel(/Nomor HP demo/).fill(phone);
  const consent = page.getByRole('checkbox', { name: /Saya paham ini adalah/i });
  await consent.check();
  // Verify input state before proceeding, but do not weaken the actual assertions.
  await expect(page.getByLabel(/Nama lengkap/)).toHaveValue('Pelanggan QA Otomatis');
  await expect(page.getByLabel(/Nomor HP demo/)).toHaveValue(phone);
  await expect(consent).toBeChecked();
  // Ticket creation must NOT happen until the final confirmation button is clicked.
  await expect(page.locator('.booking-item')).toHaveCount(0);
  await next(page).click();
  await expect(page.locator('.booking-item'), 'Tiket dibuat sebelum konfirmasi akhir').toHaveCount(0);
  const confirmation = page.getByRole('heading', { name: 'Periksa reservasi demo.' });
  try {
    await expect(confirmation).toBeVisible({ timeout: 3500 });
  } catch {
    const diagnostics = await page.evaluate(() => ({
      visibleHeadings: Array.from(document.querySelectorAll('.wizard-step-content h3')).map(el => el.textContent?.trim()),
      alerts: Array.from(document.querySelectorAll('[role="alert"]')).map(el => el.textContent?.trim()),
      currentStep: document.querySelector('.wizard-progress-item.is-current')?.textContent?.trim(),
      name: (document.querySelector('#wizard-name') as HTMLInputElement | null)?.value,
      phone: (document.querySelector('#wizard-phone') as HTMLInputElement | null)?.value,
      consentChecked: (document.querySelector('.wizard-consent input') as HTMLInputElement | null)?.checked,
      activeTicketCount: document.querySelectorAll('.booking-item').length,
      confirmationDialogVisible: Boolean(document.querySelector('[role="dialog"]')),
      url: location.href,
    }));
    throw new Error(`Tidak masuk langkah konfirmasi. Diagnostik booking: ${JSON.stringify(diagnostics, null, 2)}`);
  }
  await page.getByRole('button', { name: /Buat Tiket Demo/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(/AB-\d{3}/);
  await page.getByRole('button', { name: 'Tutup tiket' }).click();
}

test.describe('Booking Wizard: alur kritikal', () => {
  test.beforeEach(async ({ page }) => {
    // Clear QA state ONCE at the start of each test; do not use addInitScript
    // since tests intentionally verify localStorage persistence after reload.
    await page.goto('/reservasi');
    await page.evaluate(() => localStorage.removeItem('antrian-barber-demo-bookings-v2-1'));
    await page.reload();
    await expect(page.locator('.booking-item')).toHaveCount(0);
  });

  test('harus memilih layanan sebelum lanjut', async ({ page }) => {
    await next(page).click();
    await expect(page.getByRole('alert')).toContainText('Silakan pilih layanan terlebih dahulu.');
    await expect(page.getByRole('heading', { name: 'Mulai dari gayamu.' })).toBeVisible();
  });

  test('harus memilih waktu sebelum lanjut ke data pelanggan', async ({ page }) => {
    await service(page).click();
    await next(page).click();
    await next(page).click();
    await expect(page.getByRole('alert')).toContainText('Pilih jam preferensi yang masih berlaku.');
    await expect(page.getByRole('heading', { name: 'Pilih barber & jadwal.' })).toBeVisible();
  });

  test('validasi nama, nomor telepon dan persetujuan', async ({ page }) => {
    const date = await tomorrowLocal(page);
    await reachCustomerDetails(page, date);
    await next(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Nama harus terdiri dari' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Gunakan nomor Indonesia' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Setujui ketentuan demo' })).toBeVisible();
  });

  test('buat tiket, refresh, lalu batalkan; data tetap terisolasi', async ({ page }) => {
    const date = await tomorrowLocal(page);
    await reachCustomerDetails(page, date);
    await fillCustomerAndConfirm(page);
    await expect(page.locator('.booking-item')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.booking-item')).toHaveCount(1);
    await expect(page.locator('.booking-item')).toContainText('Pelanggan QA Otomatis');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Batalkan tiket' }).click();
    await expect(page.locator('.booking-item')).toHaveCount(0);
    await expect(page.getByText('Belum ada tiket demo aktif.')).toBeVisible();
  });

  test('nomor yang sama tidak dapat membuat dua tiket aktif pada tanggal sama', async ({ page }) => {
    const date = await tomorrowLocal(page);
    await reachCustomerDetails(page, date);
    await fillCustomerAndConfirm(page);
    await service(page).click();
    await next(page).click();
    await page.locator('#wizard-date').fill(date);
    await page.getByRole('group', { name: 'Jam preferensi' }).getByRole('button', { name: '09:30' }).click();
    await next(page).click();
    await page.getByLabel(/Nama lengkap/).fill('Pelanggan Kedua');
    await page.getByLabel(/Nomor HP demo/).fill('081234567890');
    await page.getByRole('checkbox', { name: /Saya paham ini adalah/i }).check();
    await next(page).click();
    await expect(page.getByRole('alert')).toContainText('Nomor ini sudah memiliki reservasi aktif');
    await expect(page.locator('.booking-item')).toHaveCount(1);
  });
});
