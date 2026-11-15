import { expect, test } from '@playwright/test';

test.describe('Mobile viewport dan aksesibilitas dasar', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('navigasi mobile membuka route dan menutup menu', async ({ page }) => {
    await page.goto('/');
    const openMenu = page.getByRole('button', { name: 'Buka menu navigasi' });
    await expect(openMenu).toBeVisible();
    await openMenu.click();
    const mobile = page.getByRole('navigation', { name: 'Navigasi mobile' });
    await expect(mobile).toBeVisible();
    await mobile.getByRole('link', { name: 'Barber', exact: true }).click();
    await expect(page).toHaveURL(/\/barber$/);
    await expect(mobile).toBeHidden();
  });

  test('tidak ada overflow horizontal pada halaman utama dan booking', async ({ page }) => {
    for (const url of ['/', '/layanan', '/barber', '/inspirasi', '/reservasi']) {
      await page.goto(url);
      await expect(page.locator('main')).toBeVisible();
      const widths = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      if (widths.document > widths.viewport + 1) {
        const suspects = await page.evaluate(() => {
          const viewport = document.documentElement.clientWidth;
          return [...document.querySelectorAll<HTMLElement>('body *')]
            .map(el => {
              const rect = el.getBoundingClientRect();
              return {
                tag: el.tagName.toLowerCase(),
                className: typeof el.className === 'string' ? el.className.slice(0, 100) : '',
                text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              };
            })
            .filter(el => el.right > viewport + 1 || el.left < -1)
            .sort((a, b) => b.right - a.right)
            .slice(0, 12);
        });
        throw new Error(`Overflow horizontal pada ${url}: ${JSON.stringify(widths)}\nElemen tersangka: ${JSON.stringify(suspects, null, 2)}`);
      }
      expect(widths.document, `Overflow horizontal pada ${url}: ${JSON.stringify(widths)}`)
        .toBeLessThanOrEqual(widths.viewport + 1);
    }
  });
});
