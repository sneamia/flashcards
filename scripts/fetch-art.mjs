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

// Words whose glyph's meaning IS its color (exception approved 2026-07-07):
// the listed hexes ship verbatim, but every OTHER color in the file still
// remaps so outlines stay in design ink. Keep this to color-words only.
const KEEP_COLORS = new Map([
  ['red', ['#ea5a47']], // OpenMoji red-square fill
]);

// art filename (without .svg) -> OpenMoji hexcode, verified to resolve (HTTP
// 200) at the pinned OPENMOJI_REF. (~) marks a figurative/approximate concept
// match (e.g. hut for "shed"), not an unverified guess.
const MAP = {
  // --- Digraphs ---
  ship: '1F6A2',      // ship
  shop: '1F3EA',      // convenience store (~ shop)
  shed: '1F6D6',      // hut (~ shed)
  shell: '1F41A',     // spiral shell
  fish: '1F41F',      // fish
  dish: '1F37D',      // fork and knife with plate (~ dish)
  chop: '1FA93',      // axe (~ chop)
  chick: '1F425',     // front-facing baby chick
  chest: '1F9F0',     // toolbox (~ chest)
  bath: '1F6C1',      // bathtub (~ bath)
  moth: '1F98B',      // butterfly (~ moth; no dedicated moth glyph)
  hush: '1F92B',      // shushing face (finger to lips)
  wish: '1F320',      // shooting star (~ wish; wish-upon-a-star)
  wham: '1F4A5',      // collision (comic impact burst)
  math: '1F522',      // input numbers (~ math; numerals)

  // --- Digraphs: NG (ng) ---
  ring: '1F48D',      // ring
  king: '1FAC5',      // person with crown (~ king)
  wing: '1FABD',      // wing
  song: '1F3B5',      // musical note (~ song)
  sing: '1F3A4',      // microphone (~ sing)
  lung: '1FAC1',      // lungs (~ lung)
  // long, hang, fang, gong: no OpenMoji glyph plausibly reads as these for a
  // preschooler (long is an adjective; no hanger/gong glyph; tooth 1F9B7 is a
  // molar, not a fang). Left unmapped — cards stay image-free.

  // --- Digraphs: CK (ck) ---
  duck: '1F986',      // duck
  sock: '1F9E6',      // socks
  rock: '1FAA8',      // rock
  lock: '1F512',      // locked padlock (~ lock)
  pack: '1F392',      // backpack (~ pack)
  sick: '1F912',      // face with thermometer (~ sick)
  // kick, neck, back, tick: no OpenMoji glyph plausibly reads as these for a
  // preschooler (foot 1F9B6 reads "foot", not kick; back/neck are body
  // regions with no glyph; no tick-insect glyph). Left unmapped — image-free.

  // --- CVC ---
  cat: '1F408',       // cat
  hat: '1F3A9',       // top hat
  bag: '1F45C',       // handbag (~ bag)
  van: '1F690',       // minibus (~ van)
  bed: '1F6CF',       // bed
  hen: '1F414',       // chicken (~ hen)
  web: '1F578',       // spider web
  jet: '2708',        // airplane (~ jet)
  pig: '1F416',       // pig
  pin: '1F4CC',       // pushpin (~ pin)
  lip: '1F444',       // mouth (~ lip)
  six: '0036-FE0F-20E3', // keycap 6 (numeral reads as "six")
  dog: '1F415',       // dog
  box: '1F4E6',       // package (~ box)
  fox: '1F98A',       // fox
  sun: '2600',        // sun
  bug: '1F41B',       // bug
  cup: '1F964',       // cup with straw (~ cup)
  bus: '1F68C',       // bus

  // --- Blends ---
  flag: '1F6A9',      // triangular flag
  sled: '1F6F7',      // sled
  plug: '1F50C',      // electric plug
  clock: '23F0',      // alarm clock (~ clock)
  glass: '1F943',     // tumbler glass (~ glass)
  frog: '1F438',      // frog
  drum: '1F941',      // drum
  crab: '1F980',      // crab
  truck: '1F69A',     // delivery truck (~ truck)
  brick: '1F9F1',     // brick
  tree: '1F333',      // deciduous tree (~ tree)
  star: '2B50',       // star
  spoon: '1F944',     // spoon
  snail: '1F40C',     // snail
  skunk: '1F9A8',     // skunk
  nest: '1FABA',      // nest with eggs (~ nest)
  tent: '26FA',       // tent

  // --- S-Blends (s-blends) / Ending Blends (end-blends) ---
  swim: '1F3CA',      // person swimming
  stop: '1F6D1',      // stop sign
  step: '1F463',      // footprints (~ step)
  smog: '1F32B',      // fog (~ smog; haze cloud)
  stem: '1F331',      // seedling (~ stem; sprout stalk)
  hand: '270B',       // raised hand
  sand: '1F3D6',      // beach with umbrella (~ sand)
  milk: '1F95B',      // glass of milk
  gift: '1F381',      // wrapped gift
  raft: '1F6F6',      // canoe (~ raft)
  spider: '1F577',    // spider
  snake: '1F40D',     // snake
  slide: '1F6DD',     // playground slide
  swan: '1F9A2',      // swan
  skate: '26F8',      // ice skate (~ skate)
  plant: '1FAB4',     // potted plant (~ plant)
  wolf: '1F43A',      // wolf
  ant: '1F41C',       // ant
  melt: '1FAE0',      // melting face (~ melt)
  wind: '1F32C',      // wind face (~ wind)

  // --- CVC: Short A (cvc-a) ---
  map: '1F5FA',       // world map (~ map)
  pan: '1F373',       // cooking (egg in frying pan) (~ pan)
  fan: '1FAAD',       // folding hand fan (~ fan)
  bat: '1F987',       // bat (animal)
  rat: '1F400',       // rat
  cap: '1F9E2',       // billed cap
  nap: '1F634',       // sleeping face (~ nap)
  tap: '1F6B0',       // potable water (faucet) (~ tap)
  ram: '1F40F',       // ram
  jam: '1FAD9-200D-1F7E5', // filled jar (jam jar; contents remap to warm palette)

  // --- CVC: Short E (cvc-e) ---
  pen: '1F58A',       // pen
  ten: '1F51F',       // keycap 10 (numeral reads as "ten")
  net: '1F945',       // goal net (~ net)
  leg: '1F9B5',       // leg
  wet: '1F4A7',       // droplet (~ wet)
  men: '1F46C',       // men holding hands (~ men)
  gem: '1F48E',       // gem stone
  red: '1F7E5',       // red square (KEEP_COLORS preserves its red fill)
  // pet: paw prints 1F43E read as "paws"; peg: safety pin 1F9F7 reads as a
  // pin. Left unmapped — image-free.

  // --- CVC: Short U (cvc-u) ---
  tub: '1F6C1',       // bathtub (~ tub)
  nut: '1F95C',       // peanuts (~ nut)
  pup: '1F436',       // dog face (~ pup; puppy face)
  jug: '1F3FA',       // amphora (~ jug)
  hut: '1F6D6',       // hut
  run: '1F3C3',       // person running (~ run)
  cut: '2702',        // scissors (~ cut)
  // mud, rug, gum: no OpenMoji glyph plausibly reads as these for a
  // preschooler (mud/gum have no glyph; yarn 1F9F6 is not a rug). Left
  // unmapped — cards stay image-free.

  // --- CVC: Short I (cvc-i) ---
  wig: '1F9B1',       // curly hair component (~ wig; floating hairpiece)
  dig: '26CF',        // pick (~ dig; digging tool)
  fin: '1F988',       // shark (~ fin; iconic dorsal fin)
  kid: '1F9D2',       // child (~ kid)
  zip: '1F910',       // zipper-mouth face (~ zip; zipper across mouth)
  sit: '1FA91',       // chair (~ sit)
  rib: '1F356',       // meat on bone (~ rib)
  bin: '1F5D1',       // wastebasket (bin)
  // bib, hit: no OpenMoji glyph reliably reads for a preschooler — left
  // unmapped (image-free cards).

  // --- CVC: Short O (cvc-o) ---
  pot: '1F372',       // pot of food (~ pot)
  hop: '1F407',       // rabbit (~ hop; rabbits hop)
  log: '1FAB5',       // wood (log)
  cob: '1F33D',       // ear of corn (~ cob; corn on the cob)
  pod: '1FADB',       // pea pod
  jog: '1F3C3',       // person running (~ jog)
  hot: '1F975',       // hot face
  cop: '1F46E',       // police officer (~ cop)
  bot: '1F916',       // robot
  // top: no OpenMoji glyph reliably reads for a preschooler — left unmapped
  // (image-free card).

  // --- Blends: L-Blends (l-blends) ---
  clap: '1F44F',      // clapping hands
  clip: '1F4CE',      // paperclip (~ clip)
  flip: '1F938',      // person cartwheeling (~ flip; mid-flip figure)
  glad: '1F60A',      // smiling face with smiling eyes (~ glad; happy face)
  plus: '2795',       // heavy plus sign
  cloud: '2601',      // cloud
  flute: '1FA88',     // flute
  plane: '2708',      // airplane
  plate: '1F37D',     // fork and knife with plate (~ plate)
  // glue: no OpenMoji glyph plausibly reads as glue for a preschooler.
  // Left unmapped — card stays image-free.

  // --- Blends: R-Blends (r-blends) ---
  grin: '1F600',      // grinning face
  grass: '1F33F',     // herb (~ grass; leafy sprigs)
  drip: '1F4A7',      // droplet (a drip)
  drop: '1FA78',      // drop of blood (recolors to a plain drop shape)
  trap: '1FAA4',      // mouse trap
  crown: '1F451',     // crown
  train: '1F682',     // locomotive (~ train)
  grapes: '1F347',    // grapes
  bread: '1F35E',     // bread
  brush: '1F58C',     // lower left paintbrush (~ brush)

  // --- Hand-drawn placeholders (leave UNMAPPED so fetch-art never overwrites) ---
  // whip, chip, chin, shin, shut, mop, block: no OpenMoji glyph plausibly
  // reads as these for a preschooler (chin/shin need a figurative arrow to a
  // body part; chip must be a potato chip, not french fries 1F35F, for
  // American English). See public/art/*.svg — hand-authored in the warm
  // palette. Leaving them out of MAP keeps `npm run fetch-art` from clobbering
  // them.
  // whiz: tried 1F4A8 "dashing away" (speed-lines cloud) — dropped on
  // render-check. Alone (no running figure) it reads as smoke/wind, and
  // it's colloquially read as a fart-cloud emoji — not a reliable "whiz"
  // for a preschooler. Left unmapped (stays image-free).
};

// Pinned to a COMMIT SHA, not a tag or `master`: this script writes remote
// content into public/ (served from the github.io origin), and tags can be
// force-moved upstream — only a SHA is immutable. Bump deliberately to take
// new OpenMoji art. 005bf5b == release tag 15.1.0.
const OPENMOJI_REF = '005bf5bc62392a9f90e1b6429c163d17610a791e';
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

function remap(svg, keepHexes) {
  // Remap every #rrggbb / #rgb fill or stroke to the nearest palette token,
  // except hexes explicitly preserved via KEEP_COLORS (color-word fills).
  // Negative lookbehind: url(#abc123)-style id references are hex-SHAPED but
  // not colors — rewriting them breaks gradient/<use> refs. (rgb()/named
  // colors pass through unremapped — a known limitation of this pipeline.)
  const keep = new Set((keepHexes ?? []).map((h) => h.toLowerCase()));
  return svg.replace(/(?<!url\()#[0-9a-fA-F]{6}\b/g,
                     (m) => (keep.has(m.toLowerCase()) ? m : nearest(m)))
            .replace(/(?<!url\()#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])\b/g,
                     (m, r, g, b) => {
                       const full = `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
                       return keep.has(full) ? m : nearest(full);
                     });
}

async function fetchOne(name, code) {
  const url = `${OPENMOJI_BASE}/${code}.svg`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const raw = await res.text();
  const recolored = remap(raw, KEEP_COLORS.get(name));
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
  // Belt-and-braces after SVGO: refuse to write if any active-content vector
  // survived sanitization (these bytes are served from the site's own origin).
  // Internal #id references (<use xlink:href="#x">) are allowed; anything
  // external or executable fails the word loudly instead of shipping.
  const DENYLIST = /<\s*(script|foreignObject|style|animate|animateTransform|animateMotion|set|iframe|image)\b|javascript:|(?:xlink:)?href\s*=\s*["'](?!#)/i;
  if (DENYLIST.test(data)) throw new Error(`sanitization denylist hit — refused to write ${name}.svg`);
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
// Non-zero exit on any failure so a scripted/CI caller can't mistake a partial
// run for success (existing files stay untouched either way — app still builds).
if (failed) process.exitCode = 1;
