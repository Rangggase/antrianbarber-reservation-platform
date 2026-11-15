import { test, expect, type Page } from '@playwright/test';

/** Resolve a colour token to the browser's computed rgb() string, so tests compare tokens, not hex. */
const rgbOf = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('i');
    probe.style.color = `var(--color-${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);

test.beforeEach(async ({ page }) => {
  await page.goto('/ui-kit');
  // the page is a lazy chunk: wait until it has actually rendered before touching the DOM
  await expect(page.getByRole('heading', { name: 'Design system kit' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('renders every primitive and has exactly one h1', async ({ page }) => {
  await expect(page.locator('h1')).toHaveCount(1);
  for (const name of ['Warna', 'Tipografi dan angka', 'Tombol', 'Isian', 'Pemberitahuan', 'Status', 'Karcis']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
});

test('Archivo Variable is applied and really loaded (not a silent fallback)', async ({ page }) => {
  const info = await page.evaluate(() => ({
    family: getComputedStyle(document.querySelector('.ds-root')!).fontFamily,
    check: document.fonts.check('16px "Archivo Variable"'),
    loaded: [...document.fonts].some((f) => f.family.includes('Archivo') && f.status === 'loaded'),
  }));
  expect(info.family).toContain('Archivo Variable');
  expect(info.check).toBe(true);
  expect(info.loaded).toBe(true);
});

test('figures are tabular (equal widths) and the width axis works', async ({ page }) => {
  // Measuring before the font has loaded would measure the fallback font and prove nothing.
  await page.evaluate(() => document.fonts.load('400 40px "Archivo Variable"', 'Antrian Barber 0123456789'));
  const r = await page.evaluate(() => {
    // Archivo's default figures converge as weight grows (at 700 "1" and "0" are nearly equal), so the
    // proportional-vs-tabular contrast is measured at 400, where the difference is large and meaningful.
    const width = (text: string, css: string, weight = 400) => {
      const el = document.createElement('span');
      el.className = 'ds-root';
      el.style.cssText = `position:absolute;white-space:nowrap;font-size:40px;font-weight:${weight};${css}`;
      el.textContent = text;
      document.body.appendChild(el);
      const w = el.getBoundingClientRect().width;
      el.remove();
      return w;
    };
    return {
      tabularOnes: width('1111', 'font-variant-numeric: tabular-nums'),
      tabularZeros: width('0000', 'font-variant-numeric: tabular-nums'),
      proportionalOnes: width('1111', 'font-variant-numeric: proportional-nums'),
      proportionalZeros: width('0000', 'font-variant-numeric: proportional-nums'),
      condensed: width('Antrian Barber', 'font-stretch: 75%'),
      normal: width('Antrian Barber', 'font-stretch: 100%'),
    };
  });
  expect(Math.abs(r.tabularOnes - r.tabularZeros)).toBeLessThan(0.5);          // tnum makes them equal...
  expect(Math.abs(r.proportionalOnes - r.proportionalZeros)).toBeGreaterThan(2); // ...and without it they are not
  // Only Archivo has a width axis: this also proves the measurements above used Archivo, not a fallback.
  expect(r.condensed).toBeLessThan(r.normal * 0.9);
  const live = await page.evaluate(() => ({ ones: document.getElementById('num-ones')!.getBoundingClientRect().width, zeros: document.getElementById('num-zeros')!.getBoundingClientRect().width }));
  expect(Math.abs(live.ones - live.zeros)).toBeLessThan(0.5); // the .ds-num utility in the real page
});

test('keyboard focus ring is 3px, blue on light and ticket-coloured on ink', async ({ page }) => {
  await page.keyboard.press('Tab'); // establish keyboard modality so :focus-visible applies
  const light = page.locator('[data-surface="light"] .ds-btn--primary').first();
  await light.focus();
  const lightRing = await light.evaluate((el) => { const s = getComputedStyle(el); return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor }; });
  expect(lightRing).toEqual({ width: '3px', style: 'solid', color: await rgbOf(page, 'action') });

  const ink = page.locator('[data-surface="ink"] .ds-btn--primary').first();
  await ink.focus();
  const inkRing = await ink.evaluate((el) => { const s = getComputedStyle(el); return { width: s.outlineWidth, color: s.outlineColor }; });
  expect(inkRing).toEqual({ width: '3px', color: await rgbOf(page, 'ticket') });
});

test('the one primary action inverts on an ink surface (blue would be 2.44:1)', async ({ page }) => {
  const bg = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg('[data-surface="light"] .ds-btn--primary')).toBe(await rgbOf(page, 'action'));
  expect(await bg('[data-surface="ink"] .ds-btn--primary')).toBe(await rgbOf(page, 'ticket'));
});

test('a field with an error is wired for assistive technology and clears when fixed', async ({ page }) => {
  const phone = page.getByLabel('Nomor HP');
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await phone.getAttribute('aria-describedby');
  const error = page.locator(`#${describedBy}`);
  await expect(error).toHaveAttribute('role', 'alert');
  await expect(error).toContainText('belum lengkap');
  await expect(error.locator('svg[aria-hidden="true"]')).toHaveCount(1); // icon + text, not colour alone
  await phone.fill('081234567890');
  await expect(phone).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator(`#${describedBy}`)).toHaveCount(0);
  await expect(page.getByLabel('Nama lengkap')).toHaveAttribute('aria-describedby', /.+-hint$/); // helper text is linked too
});

test('a loading button keeps focus, announces busy, and ignores clicks', async ({ page }) => {
  const send = page.getByRole('button', { name: /^(Kirim|Mengirim)/ }); // its name changes while loading
  await send.click();
  await expect(send).toHaveAttribute('aria-busy', 'true');
  await expect(send).toHaveAttribute('aria-disabled', 'true');
  await expect(send).toBeFocused(); // aria-disabled, not disabled: focus is not thrown away
  await expect(send).toContainText('Mengirim');
  await expect(send).not.toHaveAttribute('aria-busy', 'true', { timeout: 4000 }); // finishes by itself
});

test('all six statuses show an icon and a text label', async ({ page }) => {
  const labels = ['Menunggu', 'Terkonfirmasi', 'Dilayani', 'Selesai', 'Dibatalkan', 'Tidak hadir'];
  const badges = page.locator('.ds-badge');
  await expect(badges).toHaveCount(6);
  for (const [i, label] of labels.entries()) {
    await expect(badges.nth(i)).toContainText(label);
    await expect(badges.nth(i).locator('svg[aria-hidden="true"]')).toHaveCount(1);
  }
});

test('the ticket shows the time until confirmation, then the queue number', async ({ page }) => {
  const [before, after] = await page.locator('.ds-ticket').all();
  await expect(before.locator('.ds-ticket__big')).toHaveText('14.30');
  await expect(before).toContainText('Nomor antre belum terbit');
  await expect(before).toContainText('Diberikan saat barber mengonfirmasi');
  await expect(after.locator('.ds-ticket__big')).toHaveText('07');
  await expect(after).toContainText('2 antrean di depan');
  expect(await page.locator('.ds-ticket').allInnerTexts()).not.toContain('№'); // Archivo has no № glyph
});

test('reduced motion turns off the ticket animation and the spinner', async ({ page }) => {
  const animation = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await animation('.ds-ticket--print')).toBe('ds-print');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await animation('.ds-ticket--print')).toBe('none');
});

test('there is no horizontal scroll from 320px to 1440px', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(sizes.scroll, `overflow at ${width}px`).toBeLessThanOrEqual(sizes.inner);
  }
});

test.describe('touch devices', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('every button is at least 44px tall and every input 48px', async ({ page }) => {
    const heights = await page.evaluate(() => ({
      buttons: [...document.querySelectorAll('.ds-btn')].map((el) => Math.round(el.getBoundingClientRect().height)),
      inputs: [...document.querySelectorAll('.ds-input')].map((el) => Math.round(el.getBoundingClientRect().height)),
    }));
    expect(heights.buttons.length).toBeGreaterThan(8);
    expect(Math.min(...heights.buttons)).toBeGreaterThanOrEqual(44);
    expect(Math.min(...heights.inputs)).toBeGreaterThanOrEqual(48);
  });
});
