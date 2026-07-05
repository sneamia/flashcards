#!/usr/bin/env node
/* Contrast gate (Design Decision D4). FAILS the build if --label-readable does
 * not clear WCAG AA (>=4.5:1) on --cream. Parses both tokens from styles.css. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS = resolve(__dirname, '..', 'src', 'styles.css');

const css = readFileSync(CSS, 'utf8');
function token(name) {
  const m = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) {
    console.error(`FAIL  token --${name} not found in src/styles.css`);
    process.exit(1);
  }
  return m[1];
}

function toLin(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}
function ratio(a, b) {
  const la = luminance(a) + 0.05;
  const lb = luminance(b) + 0.05;
  return (Math.max(la, lb) / Math.min(la, lb));
}

const fg = token('label-readable');
const bg = token('cream');
const r = ratio(fg, bg);
console.log(`--label-readable ${fg} on --cream ${bg}: ${r.toFixed(2)}:1 (need >=4.5:1)`);
if (r < 4.5) {
  console.error('FAIL  --label-readable does not meet WCAG AA on cream. Darken it toward --ink.');
  process.exit(1);
}

/* --cream is duplicated as a literal in the HTML theme-color and the PWA
 * manifest (Vite can't share a constant into either). Assert they match the
 * CSS token so a palette change can never silently desync the status bar,
 * splash background, or install banner from the product surface. */
const creamDupes = [
  { file: 'index.html', re: /name="theme-color"\s+content="(#[0-9a-fA-F]{6})"/ },
  { file: 'vite.config.ts', re: /background_color:\s*'(#[0-9a-fA-F]{6})'/ },
  { file: 'vite.config.ts', re: /theme_color:\s*'(#[0-9a-fA-F]{6})'/ },
];
let dupeFail = false;
for (const { file, re } of creamDupes) {
  const text = readFileSync(resolve(__dirname, '..', file), 'utf8');
  const m = text.match(re);
  if (!m) {
    console.error(`FAIL  ${file}: expected pattern ${re} not found`);
    dupeFail = true;
  } else if (m[1].toLowerCase() !== bg.toLowerCase()) {
    console.error(`FAIL  ${file}: ${m[1]} does not match --cream ${bg}`);
    dupeFail = true;
  }
}
if (dupeFail) process.exit(1);

console.log('Contrast check PASSED (and theme-color/manifest match --cream).');
