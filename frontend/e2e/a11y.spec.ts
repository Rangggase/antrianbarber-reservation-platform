import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Automated WCAG 2.0/2.1 A and AA scan (MASTER.md decision 7). Demo mode, customer routes and the booking page. */
const routes = ['/', '/layanan', '/barber', '/inspirasi', '/tentang', '/faq', '/reservasi'];

for (const route of routes) {
  test(`axe: no serious or critical WCAG A/AA violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const summary = blocking.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node)`);
    expect(summary, `blocking axe violations on ${route}`).toEqual([]);
  });
}
