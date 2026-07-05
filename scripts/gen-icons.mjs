// gen-icons.mjs — one-off PWA icon generator for Potty Flashcards.
//
// Design: matches DESIGN.md exactly — warm cream (#f7f1e3) background, single
// ink (#3d3833) mark, zero decoration, no gradients. The mark is a single
// lowercase "a" set in Andika Bold (the app's own bundled font), rendered at
// the size the WORD-beat card uses it: big, centered, calm. Andika's
// single-story "a" is the same detail DESIGN.md cites as the literacy reason
// the font was chosen, so the icon quietly previews the product.
//
// Rendering mechanism: sharp's SVG rasterizer (librsvg) ignores embedded
// woff2 @font-face fonts and silently falls back to a system font — which
// has a generic double-story "a", exactly the detail this icon exists to
// avoid. So instead of asking librsvg to *shape text*, we outline the glyph
// ourselves: decompress the bundled Andika-Bold.woff2 to TTF in memory (via
// wawoff2 — nothing new is committed to the repo), load it with opentype.js,
// pull the "a" glyph (its glyph name is "a.SngStory" — confirms it's the
// single-story variant Andika ships as the *default* glyph for U+0061, no
// stylistic-alternate lookup needed), and convert it to an SVG <path> at the
// right size/position. sharp then just rasterizes a flat vector path — no
// font shaping involved, so no fallback-font risk.
//
// Not part of the app build — run manually if icons ever need regenerating:
//   node scripts/gen-icons.mjs
//
// Requires `sharp`, `opentype.js`, and `wawoff2` (has bundled libvips/
// librsvg, so no system deps). Install with:
//   npm install --no-save sharp opentype.js wawoff2

import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import opentype from 'opentype.js';
import wawoff2 from 'wawoff2';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ICONS_DIR = join(ROOT, 'public', 'icons');
const FONT_PATH = join(ROOT, 'public', 'fonts', 'Andika-Bold.woff2');

const CREAM = '#f7f1e3';
const INK = '#3d3833';

mkdirSync(ICONS_DIR, { recursive: true });

// Decompress the already-bundled woff2 to TTF (in memory only) so
// opentype.js — which can't parse woff2 — can outline the exact glyph the
// app ships, not some other copy of Andika.
const woff2Buf = readFileSync(FONT_PATH);
const ttfBuf = await wawoff2.decompress(woff2Buf);
const ttfArrayBuffer = ttfBuf.buffer.slice(ttfBuf.byteOffset, ttfBuf.byteOffset + ttfBuf.byteLength);
const font = opentype.parse(ttfArrayBuffer);

const glyph = font.charToGlyph('a');
if (!glyph || glyph.unicode !== 97) {
  throw new Error(`expected an "a" glyph, got name=${glyph && glyph.name} unicode=${glyph && glyph.unicode}`);
}
console.log(`using glyph "${glyph.name}" (unitsPerEm=${font.unitsPerEm})`);

/**
 * Build a square SVG: cream background, a single ink "a" outlined as a path
 * (not shaped text — see header comment for why).
 * @param {number} size - output pixel size (square)
 * @param {number} fontSize - glyph font-size in px, at the reference 512 scale
 * @param {number} yFrac - baseline y position as a fraction of size (visual centering)
 */
function markSvg(size, fontSize, yFrac) {
  const scaledFont = (fontSize / 512) * size;
  const y = size * yFrac;
  // Mirror what text-anchor="middle" would do for a single glyph: center on
  // the glyph's advance width, not its (asymmetric) ink bounding box.
  const scale = scaledFont / font.unitsPerEm;
  const advanceWidth = glyph.advanceWidth * scale;
  const x = size / 2 - advanceWidth / 2;
  const path = glyph.getPath(x, y, scaledFont);
  const d = path.toPathData(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${CREAM}"/>
  <path d="${d}" fill="${INK}"/>
</svg>`;
}

// Regular icons: big, dominant mark (mirrors the card WORD beat's "Big Ink").
// Reference scale is a 512 canvas: font-size 420, baseline at 66.5% of height.
const REGULAR_FONT_SIZE = 420;
const REGULAR_Y_FRAC = 0.665;

// Maskable icon: OS may crop to a circle/squircle/rounded-square, so the mark
// must sit inside the ~80%-diameter safe zone. Smaller font, same baseline
// logic, comfortably inside that zone.
const MASKABLE_FONT_SIZE = 260;
const MASKABLE_Y_FRAC = 0.64;

const targets = [
  { file: 'icon-192.png', size: 192, fontSize: REGULAR_FONT_SIZE, yFrac: REGULAR_Y_FRAC, flatten: false },
  { file: 'icon-512.png', size: 512, fontSize: REGULAR_FONT_SIZE, yFrac: REGULAR_Y_FRAC, flatten: false },
  { file: 'icon-512-maskable.png', size: 512, fontSize: MASKABLE_FONT_SIZE, yFrac: MASKABLE_Y_FRAC, flatten: false },
  { file: 'apple-touch-icon.png', size: 180, fontSize: REGULAR_FONT_SIZE, yFrac: REGULAR_Y_FRAC, flatten: true },
];

await Promise.all(
  targets.map(async ({ file, size, fontSize, yFrac, flatten }) => {
    const svg = markSvg(size, fontSize, yFrac);
    let pipeline = sharp(Buffer.from(svg));
    if (flatten) {
      // apple-touch-icon must not carry an alpha channel — iOS applies its
      // own rounded-corner mask, and a transparent icon looks broken on iOS.
      pipeline = pipeline.flatten({ background: CREAM });
    }
    await pipeline.png().toFile(join(ICONS_DIR, file));
    console.log(`wrote ${file} (${size}x${size})`);
  })
);

console.log('done.');
