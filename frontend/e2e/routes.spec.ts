import { expect, test } from '@playwright/test';

test.describe('Navigasi publik', () => {
  const routes = [
    { label: 'Beranda', url: '/' },
    { label: 'Layanan', url: '/layanan' },
    { label: 'Barber', url: '/barber' },
    { label: 'Inspirasi', url: '/inspirasi' },
    { label: 'Tentang', url: '/tentang' },
    { label: 'FAQ', url: '/faq' },
  ];

  for (const route of routes) {
    test(`menu ${route.label} membuka ${route.url}`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('navigation', { name: 'Navigasi utama' })
        .getByRole('link', { name: route.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${route.url === '/' ? '/$' : `${route.url}$`}`));
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main h1, main h2').first()).toBeVisible();
    });
  }

  test('navigasi ke reservasi melalui CTA utama', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'FAQ' }).click();
    await page.getByRole('link', { name: /Ambil Antrean/i }).first().click();
    await expect(page).toHaveURL(/\/reservasi$/);
    await expect(page.getByRole('heading', { name: /Your seat/i })).toBeVisible();
  });

  test('URL tidak dikenal menampilkan halaman 404 dan tetap punya navigasi', async ({ page }) => {
    await page.goto('/alamat-yang-tidak-ada');
    await expect(page.locator('main')).toContainText(/404|tidak ditemukan|not found/i);
    await expect(page.getByRole('link', { name: 'Antrian Barber — beranda' })).toBeVisible();
  });

  test('browser back mengembalikan halaman sebelumnya', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Layanan' }).click();
    await expect(page).toHaveURL(/\/layanan$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('Katalog dan halaman profil', () => {
  test('memilih layanan memprefill wizard', async ({ page }) => {
    await page.goto('/layanan');
    await page.getByRole('button', { name: 'Pilih layanan Fade & Taper' }).click();
    await expect(page).toHaveURL(/\/reservasi\?layanan=fade$/);
    await expect(page.getByRole('group', { name: 'Pilih layanan' })
      .getByRole('button', { name: /Fade & Taper/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('memilih barber memprefill wizard', async ({ page }) => {
    await page.goto('/barber');
    await page.getByRole('link', { name: /Pilih barber ini/ }).first().click();
    await expect(page).toHaveURL(/\/reservasi\?barber=raka$/);
    await page.getByRole('group', { name: 'Pilih layanan' }).getByRole('button', { name: /Classic Haircut/ }).click();
    await page.getByRole('button', { name: 'Lanjutkan' }).click();
    await expect(page.getByRole('group', { name: 'Pilih barber' })
      .getByRole('button', { name: /Raka Pratama/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('filter galeri menampilkan jumlah foto yang tepat', async ({ page }) => {
    await page.goto('/inspirasi');
    const filters = page.getByRole('group', { name: 'Filter kategori inspirasi' });
    const cards = page.locator('.gallery-grid .gallery-card');
    await expect(cards).toHaveCount(6);
    await filters.getByRole('button', { name: 'Fade', exact: true }).click();
    await expect(cards).toHaveCount(2);
    await expect(filters.getByRole('button', { name: 'Fade' })).toHaveAttribute('aria-pressed', 'true');
    await filters.getByRole('button', { name: 'Classic' }).click();
    await expect(cards).toHaveCount(2);
    await filters.getByRole('button', { name: 'Semua' }).click();
    await expect(cards).toHaveCount(6);
  });
});
