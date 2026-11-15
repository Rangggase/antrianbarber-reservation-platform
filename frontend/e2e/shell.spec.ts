import { test, expect, type Page } from '@playwright/test';

/** Sprint 5b: the customer shell (header, demo strip, footer), one h1 per page, and plain-language copy. */

const ROUTES = ['/', '/layanan', '/barber', '/inspirasi', '/tentang', '/faq', '/reservasi', '/halaman-yang-tidak-ada'];

const rgbOf = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('i');
    probe.style.color = `var(--color-${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the header shows the navigation and one call to action, not the menu button', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
    await expect(nav).toBeVisible();
    for (const label of ['Beranda', 'Layanan', 'Barber', 'Inspirasi', 'Tentang', 'FAQ']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('banner').getByRole('link', { name: 'Ambil antrean' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buka menu navigasi' })).toBeHidden();
  });

  test('the current page is marked by aria-current, weight and an underline, not by colour alone', async ({ page }) => {
    await page.goto('/layanan');
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
    const current = nav.getByRole('link', { name: 'Layanan', exact: true });
    const other = nav.getByRole('link', { name: 'FAQ', exact: true });
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(other).not.toHaveAttribute('aria-current', 'page');
    const style = (locator: typeof current) => locator.evaluate((el) => { const s = getComputedStyle(el); return { weight: s.fontWeight, underline: s.borderBottomColor, width: s.borderBottomWidth }; });
    const on = await style(current);
    const off = await style(other);
    expect(on.weight).toBe('700');
    expect(on.width).toBe('2px');
    expect(on.underline).toBe(await rgbOf(page, 'ticket'));
    expect(off.weight).not.toBe('700');
    expect(off.underline).not.toBe(on.underline);
  });

  test('the footer closes with a prompt everywhere except on the booking page', async ({ page }) => {
    await page.goto('/layanan');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByText('Siap mengambil antrean?')).toBeVisible();
    await expect(footer.getByRole('navigation', { name: 'Jelajahi' }).getByRole('link')).toHaveCount(5);
    await page.goto('/reservasi');
    await expect(page.getByRole('contentinfo').getByText('Siap mengambil antrean?')).toHaveCount(0);
  });
});

test('the desktop navigation takes over exactly at 960px', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Buka menu navigasi' });
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
  await page.setViewportSize({ width: 959, height: 800 });
  await expect(menu).toBeVisible();
  await expect(nav).toBeHidden();
  await page.setViewportSize({ width: 960, height: 800 });
  await expect(nav).toBeVisible();
  await expect(menu).toBeHidden();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the menu opens with comfortable targets and closes after navigating', async ({ page }) => {
    await page.goto('/');
    const open = page.getByRole('button', { name: 'Buka menu navigasi' });
    expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await open.click();
    await expect(page.getByRole('button', { name: 'Tutup menu navigasi' })).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByRole('navigation', { name: 'Navigasi mobile' });
    const heights = await panel.getByRole('link').evaluateAll((links) => links.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(heights.length).toBe(7); // six pages + the call to action
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    await panel.getByRole('link', { name: 'Layanan', exact: true }).click();
    await expect(page).toHaveURL(/\/layanan$/);
    await expect(panel).toHaveCount(0);
  });

  test('text in the shell is at least 13px and every shell control is at least 44px tall', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Buka menu navigasi' }).click();
    const r = await page.evaluate(() => {
      const scope = [...document.querySelectorAll('.ds-header, .ds-demo-strip, .ds-footer')];
      const small: string[] = [];
      const short: string[] = [];
      for (const root of scope) {
        for (const el of root.querySelectorAll('*')) {
          const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim());
          const box = el.getBoundingClientRect();
          if (hasText && box.width > 0 && parseFloat(getComputedStyle(el).fontSize) < 13) small.push((el.textContent || '').trim().slice(0, 30));
        }
        for (const el of root.querySelectorAll('a[href], button')) {
          const box = el.getBoundingClientRect();
          if (box.width > 0 && box.height < 44) short.push(`${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)} ${Math.round(box.height)}px`);
        }
      }
      return { small, short };
    });
    expect(r.small).toEqual([]);
    expect(r.short).toEqual([]);
  });
});

test('the demo strip is slim and says where the data goes in demo mode', async ({ page }) => {
  await page.goto('/layanan');
  const strip = page.getByRole('note');
  await expect(strip).toContainText('Demo portofolio. Data hanya tersimpan di browser ini; gunakan data fiktif.');
  const height = (await strip.boundingBox())!.height;
  expect(height).toBeGreaterThanOrEqual(36);
  expect(height).toBeLessThan(64);
});

test('every customer page has exactly one h1 and never skips a heading level', async ({ page }) => {
  for (const path of ROUTES) {
    await page.goto(path);
    const levels = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1])));
    expect(levels.filter((l) => l === 1), `h1 count on ${path}`).toHaveLength(1);
    expect(levels[0], `first heading on ${path}`).toBe(1);
    levels.forEach((level, i) => { if (i > 0) expect(level, `heading order on ${path}: ${levels.join(',')}`).toBeLessThanOrEqual(levels[i - 1] + 1); });
  }
});

test('the shell and the booking page have no English labels and no technical terms', async ({ page }) => {
  const banned = /PostgreSQL|FastAPI|Failed to fetch|STEP 0|Your seat|Your moment|You're on|SAVED IN|READY FOR|NOT A LIVE|DEMO BOOKING|EXPLORE|ABOUT THE PROJECT|Portfolio concept/i;
  await page.goto('/');
  const shell = await page.locator('.ds-header, .ds-demo-strip, .ds-footer').allInnerTexts();
  expect(shell.join('\n')).not.toMatch(banned);
  await page.goto('/reservasi');
  await expect(page.getByRole('heading', { name: /Pesan karcis/ })).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(banned);
});

test('there is no horizontal scroll from 320px to 1440px', async ({ page }) => {
  for (const path of ['/', '/reservasi']) {
    await page.goto(path);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(sizes.scroll, `overflow on ${path} at ${width}px`).toBeLessThanOrEqual(sizes.inner);
    }
  }
});
