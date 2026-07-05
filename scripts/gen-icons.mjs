// gen-icons.mjs — one-off PWA icon generator for Potty Flashcards.
//
// Design: matches DESIGN.md exactly — warm cream (#f7f1e3) background, single
// ink (#3d3833) mark, zero decoration, no gradients. The mark is a single
// lowercase "a" set in Andika Bold (the app's own bundled font), rendered at
// the size the WORD-beat card uses it: big, centered, calm. Andika's
// single-story "a" is the same detail DESIGN.md cites as the literacy reason
// the font was chosen, so the icon quietly previews the product.
//
// Not part of the app build — run manually if icons ever need regenerating:
//   node scripts/gen-icons.mjs
//
// Requires `sharp` (has bundled libvips/librsvg, so no system deps). Install
// with `npm install --no-save sharp` if it isn't already present.

import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ICONS_DIR = join(ROOT, 'public', 'icons');
const FONT_PATH = join(ROOT, 'public', 'fonts', 'Andika-Bold.woff2');

const CREAM = '#f7f1e3';
const INK = '#3d3833';

mkdirSync(ICONS_DIR, { recursive: true });

const fontB64 = readFileSync(FONT_PATH).toString('base64');

/**
 * Build a square SVG: cream background, a single ink "a" in Andika Bold.
 * @param {number} size - output pixel size (square)
 * @param {number} fontSize - glyph font-size in px, at the reference 512 scale
 * @param {number} yFrac - baseline y position as a fraction of size (visual centering)
 */
function markSvg(size, fontSize, yFrac) {
  const scaledFont = (fontSize / 512) * size;
  const y = size * yFrac;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      @font-face {
        font-family: 'AndikaIcon';
        font-weight: 700;
        src: url(data:font/woff2;base64,${fontB64}) format('woff2');
      }
    </style>
  </defs>
  <rect width="${size}" height="${size}" fill="${CREAM}"/>
  <text x="${size / 2}" y="${y}" font-family="AndikaIcon" font-weight="700"
        font-size="${scaledFont}" fill="${INK}" text-anchor="middle">a</text>
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
