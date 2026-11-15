// Guards the design tokens: every text/background pair the design system uses must meet WCAG 2.x.
// Reads src/styles/tokens.css (the single source of colour values). Run: npm run check:contrast
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const color = {};
for (const [, name, hex] of css.matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) color[name] = hex;

const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground token, background token, minimum ratio, description]. 4.5 = text, 3 = non-text (borders, icons, focus).
const PAIRS = [
  ['ink', 'surface-page', 4.5, 'Body text on page'],
  ['ink', 'surface', 4.5, 'Body text on card'],
  ['ink-2', 'surface-page', 4.5, 'Secondary text'],
  ['ink-muted', 'surface-page', 4.5, 'Caption on page'],
  ['ink-muted', 'surface', 4.5, 'Caption / placeholder on card'],
  ['surface', 'action', 4.5, 'Primary button text'],
  ['surface', 'action-hover', 4.5, 'Primary button hover text'],
  ['action', 'surface-page', 4.5, 'Link on page'],
  ['action', 'surface', 4.5, 'Link on card'],
  ['ink', 'ticket', 4.5, 'Ticket text'],
  ['ink-2', 'ticket', 4.5, 'Ticket secondary text'],
  ['on-ink', 'ink', 4.5, 'Text on ink surface'],
  ['on-ink-muted', 'ink', 4.5, 'Secondary text on ink surface'],
  ['ticket', 'ink', 4.5, 'Ticket colour (numbers, primary action) on ink'],
  ['danger', 'surface', 4.5, 'Error text on card'],
  ['danger', 'danger-bg', 4.5, 'Danger badge'],
  ['success', 'success-bg', 4.5, 'Success badge'],
  ['progress', 'progress-bg', 4.5, 'In-service badge'],
  ['warn', 'warn-bg', 4.5, 'Pending badge'],
  ['neutral', 'neutral-bg', 4.5, 'Completed badge'],
  ['ink', 'success-bg', 4.5, 'Notice text on success tint'],
  ['ink', 'warn-bg', 4.5, 'Notice text on warning tint'],
  ['ink', 'danger-bg', 4.5, 'Notice text on danger tint'],
  ['control', 'surface', 3, 'Input border on card (non-text)'],
  ['control', 'surface-page', 3, 'Input border on page (non-text)'],
  ['action', 'surface', 3, 'Focus ring on light (non-text)'],
  ['action', 'surface-page', 3, 'Focus ring on page (non-text)'],
  ['ticket', 'ink', 3, 'Focus ring on ink (non-text)'],
  ['success', 'success-bg', 3, 'Notice icon on success tint (non-text)'],
  ['warn', 'warn-bg', 3, 'Notice icon on warning tint (non-text)'],
  ['danger', 'danger-bg', 3, 'Notice icon on danger tint (non-text)'],
  ['action', 'surface', 3, 'Notice icon on info (non-text)'],
];

let failed = 0;
for (const [fg, bg, min, label] of PAIRS) {
  if (!color[fg] || !color[bg]) { console.error(`MISSING token for pair ${fg} on ${bg}`); failed++; continue; }
  const r = ratio(color[fg], color[bg]);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)} >= ${String(min).padEnd(3)} ${label} (${fg} ${color[fg]} on ${bg} ${color[bg]})`);
}
console.log(`\n${PAIRS.length - failed}/${PAIRS.length} pairs pass; ${Object.keys(color).length} colour tokens read`);
process.exit(failed ? 1 : 0);
