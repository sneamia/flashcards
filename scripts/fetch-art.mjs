#!/usr/bin/env node
/* Art pipeline (design doc step 4). DEV-TIME tool — NOT run during `npm run build`.
 * Pulls OpenMoji SVGs → palette-remaps to the muted warm set → SVGO → public/art.
 * Resilient: on network failure it warns and leaves existing placeholder SVGs
 * untouched so the app still builds. Never leaves a half-written file.
 *
 * OpenMoji is CC BY-SA 4.0; the recolored SVGs are adaptations (ShareAlike) —
 * see public/art/LICENSE. Usage:  node scripts/fetch-art.mjs [name ...]
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { optimize } from 'svgo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ART_DIR = resolve(__dirname, '..', 'public', 'art');
if (!existsSync(ART_DIR)) mkdirSync(ART_DIR, { recursive: true });

// Muted warm palette (DESIGN.md). Every source color remaps to the nearest of these.
const PALETTE = ['#a6785a', '#c9b48f', '#e0cba8', '#cbb287', '#8a6a4a', '#3d3833'];

// art filename (without .svg) -> best-effort OpenMoji hexcode.
// Hexcodes verified against the OpenMoji index where confident; the rest are
// the closest available glyph and marked (~). Adjust as coverage is audited.
const MAP = {
  ship: '1F6A2',      // ship
  shop: '1F3EA',      // convenience store (~ shop)
  shed: '1F6D6',      // hut (~ shed)
  shell: '1F41A',     // spiral shell
  fish: '1F41F',      // fish
  dish: '1F37D',      // fork and knife with plate (~ dish)
  chip: '1F35F',      // french fries (~ chip)
  chop: '1FA93',      // axe (~ chop)
  chick: '1F425',     // front-facing baby chick
  chest: '1F9F0',     // toolbox (~ chest)
  bath: '1F6C1',      // bathtub (~ bath)
  moth: '1F98B',      // butterfly (~ moth; no dedicated moth glyph)
  // whip: intentionally omitted. No OpenMoji/Unicode glyph plausibly reads as
  // "whip" — 1FA83 boomerang was tried and is unrecognizable as a whip on
  // render-check. Keeping the hand-drawn placeholder (public/art/whip.svg)
  // instead; leave unmapped so `npm run fetch-art` never overwrites it.
};

// Pinned to a release tag, NOT `master`: this script writes remote content
// into public/ (served from the github.io origin), so the upstream ref must
// be immutable. Bump the tag deliberately to take new OpenMoji art.
const OPENMOJI_REF = '15.1.0';
const OPENMOJI_BASE = `https://raw.githubusercontent.com/hfg-gmuend/openmoji/${OPENMOJI_REF}/color/svg`;

function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const PAL_RGB = PALETTE.map(hexToRgb);
function nearest(hex) {
  const [r, g, b] = hexToRgb(hex);
  let best = PALETTE[0], bestD = Infinity;
  PALETTE.forEach((p, i) => {
    const [pr, pg, pb] = PAL_RGB[i];
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  });
  return best;
}

function remap(svg) {
  // Remap every #rrggbb / #rgb fill or stroke to the nearest palette token.
  // Negative lookbehind: url(#abc123)-style id references are hex-SHAPED but
  // not colors — rewriting them breaks gradient/<use> refs. (rgb()/named
  // colors pass through unremapped — a known limitation of this pipeline.)
  return svg.replace(/(?<!url\()#[0-9a-fA-F]{6}\b/g, (m) => nearest(m))
            .replace(/(?<!url\()#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])\b/g,
                     (_, r, g, b) => nearest(`#${r}${r}${g}${g}${b}${b}`));
}

async function fetchOne(name, code) {
  const url = `${OPENMOJI_BASE}/${code}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const raw = await res.text();
  const recolored = remap(raw);
  // preset-default does NOT strip <script> or on* handlers — and these SVGs
  // are remote content that ends up served from the site's own origin.
  const { data } = optimize(recolored, {
    multipass: true,
    plugins: [
      'preset-default',
      'removeScriptElement',
      { name: 'removeAttrs', params: { attrs: '(^on.*)' } },
    ],
  });
  // .tmp suffix (NOT .svg) so a crash mid-write can never leave a stray file
  // that vite.config.ts's `**/*.svg` precache glob would ship to every user.
  const tmp = join(ART_DIR, `${name}.svg.tmp`);
  const out = join(ART_DIR, `${name}.svg`);
  writeFileSync(tmp, data, 'utf8');
  renameSync(tmp, out); // atomic — never a half-written asset
  return data.length;
}

const requested = process.argv.slice(2);
const targets = requested.length ? requested : Object.keys(MAP);

let ok = 0, failed = 0;
for (const name of targets) {
  const code = MAP[name];
  if (!code) { console.warn(`skip  ${name}: no OpenMoji mapping`); continue; }
  try {
    const bytes = await fetchOne(name, code);
    console.log(`ok    ${name}.svg  (${bytes} bytes, remapped from ${code})`);
    ok++;
  } catch (e) {
    console.warn(`warn  ${name}: ${e.message} — kept existing placeholder`);
    failed++;
  }
}
console.log(`\nfetch-art: ${ok} updated, ${failed} kept as placeholder.`);
if (failed && !ok) {
  console.warn('Network appears unavailable; all placeholders preserved. App still builds.');
}
