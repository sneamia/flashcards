#!/usr/bin/env node
/* Art pipeline (design doc step 4). DEV-TIME tool — NOT run during `npm run build`.
 * Pulls OpenMoji SVGs (the primary set) and Mulberry Symbols SVGs (a second
 * source, only for words OpenMoji has no honest glyph for) → palette-remaps to
 * the muted warm set → SVGO → public/art.
 * Resilient: on network failure it warns and leaves existing placeholder SVGs
 * untouched so the app still builds. Never leaves a half-written file.
 *
 * Both sources are CC BY-SA 4.0; the recolored SVGs are adaptations (ShareAlike) —
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
  wheel: '1F6DE',     // wheel
  whale: '1F40B',     // whale (full-body profile; better preschooler read
                      // than the spouting-whale/whale-face glyph 1F433)
  math: '1F522',      // input numbers (~ math; numerals)
  // whisk: no OpenMoji glyph exists for a whisk (checked the base set and
  // extras-openmoji.csv at the pinned ref) and no figurative substitute
  // (spoon, swirl, spiral shell) reliably reads as "whisk" for a
  // preschooler. Hand-drawn instead (see the placeholders note below).

  // --- Digraphs: NG (ng) ---
  ring: '1F48D',      // ring
  king: '1FAC5',      // person with crown (~ king)
  wing: '1FABD',      // wing
  song: '1F3B5',      // musical note (~ song)
  sing: '1F3A4',      // microphone (~ sing)
  lung: '1FAC1',      // lungs (~ lung)
  // long, hang, fang, gong: no OpenMoji glyph plausibly reads as these for a
  // preschooler (long is an adjective; no hanger/gong glyph; tooth 1F9B7 is a
  // molar, not a fang). Mulberry has no better: its `long` is a ruler
  // diagram, `hang` a figure on a pull-up bar, `fangs` a roaring mouth, and
  // there is no gong at all. long, hang and fang stay image-free; gong is hand-drawn (see below).

  // --- Digraphs: CK (ck) ---
  duck: '1F986',      // duck
  sock: '1F9E6',      // socks
  rock: '1FAA8',      // rock
  lock: '1F512',      // locked padlock (~ lock)
  pack: '1F392',      // backpack (~ pack)
  sick: '1F912',      // face with thermometer (~ sick)
  // kick, neck, back: no OpenMoji glyph plausibly reads as these for a
  // preschooler (foot 1F9B6 reads "foot", not kick; back/neck are body
  // regions with no glyph) — all three come from Mulberry instead (see
  // MULBERRY below). tick: no tick-insect glyph in either set, and a
  // checkmark would be the wrong (British) sense. Left unmapped — image-free.

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
  // pet: paw prints 1F43E read as "paws" — Mulberry's person-patting-a-dog
  // drawing is used instead (see MULBERRY below). peg: safety pin 1F9F7 reads
  // as a pin, and Mulberry's only candidate is a clothes peg, which a North
  // American child names "clothespin" (the app is American English, see
  // README). peg is hand-drawn as a pegboard instead (see below).

  // --- CVC: Short U (cvc-u) ---
  tub: '1F6C1',       // bathtub (~ tub)
  nut: '1F95C',       // peanuts (~ nut)
  pup: '1F436',       // dog face (~ pup; puppy face)
  jug: '1F3FA',       // amphora (~ jug)
  hut: '1F6D6',       // hut
  run: '1F3C3',       // person running (~ run)
  cut: '2702',        // scissors (~ cut)
  // mud, rug, gum: no OpenMoji glyph plausibly reads as these for a
  // preschooler (mud/gum have no glyph; yarn 1F9F6 is not a rug). Mulberry
  // was checked too (2026-10-12): no mud; its rug is a 350-path pattern
  // (105 KB after SVGO, against a ~6 KB norm here); its chewing gum reads
  // as a chocolate bar once the palette remap strips the colour. rug is
  // hand-drawn (see the placeholders note below). gum: a hand-drawn face
  // blowing a bubble was tried too and read as a face beside a coin — the
  // palette has no way to draw a translucent bubble. mud and gum stay
  // image-free.

  // --- CVC: Short I (cvc-i) ---
  wig: '1F9B1',       // curly hair component (~ wig; floating hairpiece)
  dig: '26CF',        // pick (~ dig; digging tool)
  fin: '1F988',       // shark (~ fin; iconic dorsal fin)
  kid: '1F9D2',       // child (~ kid)
  zip: '1F910',       // zipper-mouth face (~ zip; zipper across mouth)
  sit: '1FA91',       // chair (~ sit)
  rib: '1F356',       // meat on bone (~ rib)
  bin: '1F5D1',       // wastebasket (bin)
  // bib: no OpenMoji glyph — Mulberry's baby bib is used instead (see
  // MULBERRY below). hit: no OpenMoji glyph reliably reads for a
  // preschooler, and Mulberry's candidates are a hammer and a punch (read
  // "hammer" / "angry"). hit is hand-drawn instead (see below).

  // --- CVC: Short O (cvc-o) ---
  pot: '1F372',       // pot of food (~ pot)
  hop: '1F407',       // rabbit (~ hop; rabbits hop)
  log: '1FAB5',       // wood (log)
  cob: '1F33D',       // ear of corn (~ cob; corn on the cob)
  pod: '1FADB',       // pea pod
  hot: '1F975',       // hot face
  cop: '1F46E',       // police officer (~ cop)
  bot: '1F916',       // robot
  // top: no OpenMoji glyph reliably reads for a preschooler — hand-drawn as a
  // spinning top (see the placeholders note below).
  // jog: unlike top, a glyph exists (1F3C3 person running) — but it's the
  // same glyph already mapped to `run` (cvc-u), and run/jog both live in
  // the CVC category, so a single "shuffle all CVC" session could show the
  // identical picture for two different words. Deliberately left unmapped
  // (image-free card) rather than reused — see TODOS.md P1.1.
  // Mulberry's `jog_,_to` is another running figure — same call.

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
  // glue: no OpenMoji glyph plausibly reads as glue for a preschooler —
  // Mulberry's squeeze bottle with a spreader is used instead (see MULBERRY
  // below).

  // --- Blends: R-Blends (r-blends) ---
  grin: '1F600',      // grinning face
  grass: '1F33F',     // herb (~ grass; leafy sprigs)
  drip: '1F4A7',      // droplet (a drip)
  drop: '1FA78',      // drop of blood (recolors to a plain drop shape)
  trap: '1FAA4',      // mouse trap
  crown: '1F451',     // crown
  train: '1F682',     // locomotive (~ train)
  grape: '1F347',     // grapes (~ grape)
  bread: '1F35E',     // bread
  brush: '1F58C',     // lower left paintbrush (~ brush)

  // --- Magic E (magic-e) ---
  cake: 'E0C7',       // cake (extras-openmoji; plain cake, no candles)
  wave: '1F30A',      // water wave
  kite: '1FA81',      // kite
  bike: '1F6B2',      // bicycle (~ bike)
  five: '0035-FE0F-20E3', // keycap 5 (numeral reads as "five")
  nine: '0039-FE0F-20E3', // keycap 9 (numeral reads as "nine")
  // smile: 1F642 (slightly smiling face) renders, after the palette remap, as
  // the same tan circle with two dots and a curved mouth as `grin` (1F600,
  // r-blends) — a child names both "happy face". Same call as `stone` below.
  // Left unmapped — image-free card.
  // Mulberry's `smile_,_to` is a bare mouth with teeth — closer still to grin.
  pine: '1F332',      // evergreen tree (~ pine)
  bone: '1F9B4',      // bone
  // stone: public/art/stone.svg was byte-identical to `rock`'s (1FAA8,
  // digraphs). Cross-category hex reuse is legal by convention (a shuffle
  // pool never spans categories) and five pairs ship that way — see the
  // pinned allowlist in tests/unit/decks.test.ts. This one is a judgment
  // call rather than a new rule: rock and stone are near-synonyms a
  // preschooler may treat as ONE word, so the identical picture reads as the
  // app having lost its place rather than as two words that happen to share
  // a drawing (same reasoning that dropped `jog`'s art in favor of `run`'s —
  // see above). Left unmapped — image-free card.
  // Mulberry's `stone` is the same smooth-rock silhouette — same call.
  globe: '1F30D',     // globe showing Europe-Africa (~ globe)
  home: '1F3E0',      // house (~ home)
  cone: '1F366',      // soft ice cream (~ cone; the cone shape)
  rope: '1FAA2',      // knot (~ rope)
  // tape: no OpenMoji glyph — Mulberry's roll of masking tape is used
  // instead (see MULBERRY below). cape: no glyph in either set (1F9B8
  // superhero reads "superhero"). tube: Mulberry offers only a test tube and
  // two AAC chew toys, none of which reads "tube" to a 4-year-old. cape stays
  // image-free; tube and gate are hand-drawn (see below).
  // cube: 1F9CA (ice) renders as a plain tan isometric box once the palette
  // remap strips the translucency — the same object as `block` (blends) and
  // `box` (cvc), both of which a child meets earlier. Same call as `smile`
  // and `stone`. Left unmapped — image-free card.
  // Mulberry has only stock cubes and dice — same call.
  // mule: the only candidate glyph (1FACF) is a donkey — a different
  // animal — so a preschooler names the picture "donkey" or "horse",
  // contradicting the read instead of confirming it. Left unmapped —
  // image-free card.
  // Mulberry's only candidate is likewise a donkey.

  // --- Hand-drawn placeholders (leave UNMAPPED so fetch-art never overwrites) ---
  // whip, chip, chin, shin, shut, mop, block, gate, rug, top, tube, whisk, gong, peg, hit: no OpenMoji (or Mulberry) glyph plausibly
  // reads as these for a preschooler (chin/shin need a figurative arrow to a
  // body part; chip must be a potato chip, not french fries 1F35F, for
  // American English). See public/art/*.svg — hand-authored in the warm
  // palette. Leaving them out of MAP keeps `npm run fetch-art` from clobbering
  // them.
  // The 2026-10-12 set: rug (two shaded ovals), top (spinning top), tube (hollow roll), whisk, gong (in its stand),
  // peg (pegboard — the North American sense), hit (bat striking a ball), gate (garden gate).
  // whiz: tried 1F4A8 "dashing away" (speed-lines cloud) — dropped on
  // render-check. Alone (no running figure) it reads as smoke/wind, and
  // it's colloquially read as a fart-cloud emoji — not a reliable "whiz"
  // for a preschooler. Left unmapped (stays image-free).
};

// Second source — Mulberry Symbols (https://mulberrysymbols.org), AAC
// pictograms drawn for children. CC BY-SA 4.0 like OpenMoji, so the same
// ShareAlike adaptation terms apply (public/art/LICENSE). Used ONLY where
// OpenMoji has no glyph that honestly reads as the word; every entry was
// eyeballed on a contact sheet AFTER the palette remap (2026-10-12).
// art filename -> Mulberry `EN/` file name WITHOUT `.svg`, verified to
// resolve (HTTP 200) at the pinned MULBERRY_REF. Mulberry's own naming is
// kept verbatim — verbs carry a `_,_to` suffix. (~) as in MAP. A word lives
// in exactly ONE of MAP / MULBERRY (enforced at startup below).
const MULBERRY = {
  // --- Digraphs: CK (ck) ---
  kick: 'kick_ball_1_,_to', // child kicking a ball (~ kick; a child may say "soccer")
  neck: 'neck',             // torso with an ink arrow at the neck (same device as chin/shin)
  back: 'back',             // rear view of a torso (~ back)

  // --- CVC: Short E (cvc-e) / Short I (cvc-i) ---
  pet: 'stroke_,_to',       // person patting a dog (~ pet; a child may say "dog")
  bib: 'bib',               // baby bib

  // --- Blends: L-Blends (l-blends) ---
  glue: 'glue',             // squeeze bottle with a spreader

  // --- Magic E (magic-e) ---
  tape: 'masking_tape',     // roll of tape with a peeled end
};

// Same immutability reasoning as OPENMOJI_REF below. 9cbab9f == `master` on
// 2026-10-12 (the repo moved from straight-street/ to mulberrysymbols/).
const MULBERRY_REF = '9cbab9f400c5de44e2bc58839cca07294aadb086';
const MULBERRY_BASE = `https://raw.githubusercontent.com/mulberrysymbols/mulberry-symbols/${MULBERRY_REF}/EN`;

// Pinned to a COMMIT SHA, not a tag or `master`: this script writes remote
// content into public/ (served from the github.io origin), and tags can be
// force-moved upstream — only a SHA is immutable. Bump deliberately to take
// new OpenMoji art. 005bf5b == release tag 15.1.0.
const OPENMOJI_REF = '005bf5bc62392a9f90e1b6429c163d17610a791e';
const OPENMOJI_BASE = `https://raw.githubusercontent.com/hfg-gmuend/openmoji/${OPENMOJI_REF}/color/svg`;

// A word's art comes from exactly one upstream. Fail loudly at startup rather
// than letting MAP silently win — keeps the two tables honest.
const inBoth = Object.keys(MAP).filter((name) => Object.hasOwn(MULBERRY, name));
if (inBoth.length) {
  console.error(`fetch-art: mapped in BOTH MAP and MULBERRY: ${inBoth.join(', ')} — a word has exactly one source`);
  process.exit(1);
}

// Resolve a word to its upstream URL plus a label for the log line, or null
// for hand-drawn / deliberately image-free words.
function sourceOf(name) {
  if (Object.hasOwn(MAP, name)) {
    return { url: `${OPENMOJI_BASE}/${MAP[name]}.svg`, label: `OpenMoji ${MAP[name]}` };
  }
  if (Object.hasOwn(MULBERRY, name)) {
    // Mulberry names carry commas (`_,_to`) — encode so the raw URL is exact.
    return {
      url: `${MULBERRY_BASE}/${encodeURIComponent(MULBERRY[name])}.svg`,
      label: `Mulberry ${MULBERRY[name]}`,
    };
  }
  return null;
}

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

// CSS named colours. remap()'s two passes below only see hex literals, so a
// `fill="orange"` would pass through untouched; SVGO's convertColors then
// turns it into `#ffa500`, which validate-decks.mjs's palette gate rejects at
// build time — loud, but the file is unusable. Both upstreams are hex-first,
// yet Mulberry's seeds.svg does carry one. Map the names that occur in flat
// symbol art to hex FIRST so the normal nearest-palette remap handles them.
const NAMED_COLORS = {
  black: '#000000', white: '#ffffff', red: '#ff0000', orange: '#ffa500', yellow: '#ffff00',
  green: '#008000', lime: '#00ff00', blue: '#0000ff', navy: '#000080', purple: '#800080',
  pink: '#ffc0cb', brown: '#a52a2a', gray: '#808080', grey: '#808080', silver: '#c0c0c0',
  maroon: '#800000', olive: '#808000', teal: '#008080', aqua: '#00ffff', fuchsia: '#ff00ff',
};
const NAMED_COLOR_RE = new RegExp(
  `(?<![\\w-])(fill|stroke|stop-color)(\\s*[=:]\\s*["']?)(${Object.keys(NAMED_COLORS).join('|')})\\b`,
  'gi',
);

function remap(svg, keepHexes) {
  // Remap every #rrggbb / #rgb fill or stroke to the nearest palette token,
  // except hexes explicitly preserved via KEEP_COLORS (color-word fills).
  // Negative lookbehind: url(#abc123)-style id references are hex-SHAPED but
  // not colors — rewriting them breaks gradient/<use> refs. (rgb() colors
  // pass through unremapped — SVGO's convertColors turns them into hex
  // afterwards, so a non-palette one still fails validate-decks' palette gate,
  // and rgb(0,0,0) collapses to the default fill, which inkDefaultFills then
  // inks.)
  const keep = new Set((keepHexes ?? []).map((h) => h.toLowerCase()));
  const named = svg.replace(NAMED_COLOR_RE, (m, prop, sep, name) => `${prop}${sep}${NAMED_COLORS[name.toLowerCase()]}`);
  return named.replace(/(?<!url\()#[0-9a-fA-F]{6}\b/g,
                     (m) => (keep.has(m.toLowerCase()) ? m : nearest(m)))
            .replace(/(?<!url\()#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])\b/g,
                     (m, r, g, b) => {
                       const full = `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
                       return keep.has(full) ? m : nearest(full);
                     });
}

// SVG's default `fill` is opaque BLACK. A paint element with no fill of its
// own and no fill-bearing ancestor therefore renders #000 — off-palette, and
// invisible to validate-decks.mjs's palette gate, which only sees hex
// literals PRESENT in the file (TODOS.md P3.17; bike.svg shipped that way in
// v1.7 and was hand-fixed). Treat the implicit black exactly as remap()
// treats an explicit one — nearest palette colour, i.e. the ink — by writing
// it in. Runs AFTER SVGO so it sees the final tree (collapseGroups /
// moveGroupAttrsToElems can move a fill up or down a level). Children of
// <defs>, <pattern>, <marker> and <symbol> DO paint once referenced (via
// <use>/fill) and default to black there too, so they are inked like anything
// else. Only <mask> and <clipPath> subtrees are left alone: their default-black
// child means "hide"/"clip", and inking it would change that.
const PAINT_ELEMENTS = new Set(['path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline']);
const NON_RENDERING = new Set(['mask', 'clipPath']);
const INK = PALETTE[5]; // #3d3833
function inkDefaultFills(svg) {
  const stack = []; // one entry per open ancestor: is fill already settled below it?
  let inked = 0;
  const out = svg.replace(/<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g, (tag, close, el, attrs, selfClose) => {
    if (close) { stack.pop(); return tag; }
    const inherited = stack.length > 0 && stack[stack.length - 1];
    const own = /(?:^|\s)fill\s*=/.test(attrs) || /(?:^|\s)style\s*=\s*["'][^"']*\bfill\s*:/.test(attrs);
    const settled = inherited || own || NON_RENDERING.has(el);
    let result = tag;
    if (!settled && PAINT_ELEMENTS.has(el)) {
      inked++;
      result = `<${el}${attrs} fill="${INK}"${selfClose}>`;
    }
    if (!selfClose) stack.push(settled || PAINT_ELEMENTS.has(el));
    return result;
  });
  return { svg: out, inked };
}

async function fetchOne(name, url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const raw = await res.text();
  const recolored = remap(raw, KEEP_COLORS.get(name));
  // preset-default does NOT strip <script> or on* handlers — and these SVGs
  // are remote content that ends up served from the site's own origin.
  const { data } = optimize(recolored, {
    multipass: true,
    plugins: [
      // removeViewBox stays OFF: the app's art must be viewBox-only (see
      // tests/unit/art-svg-sizing.test.ts), and Mulberry roots declare a
      // width/height equal to the viewBox — exactly the case where the default
      // would drop the viewBox, leaving NO size information once
      // removeDimensions runs below.
      { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
      'removeScriptElement',
      // Mulberry roots carry width="850.394" height="850.394"; OpenMoji's
      // carry none, so this is a no-op for them (outputs stay byte-identical).
      'removeDimensions',
      // on*: active content. class: Mulberry's theming hooks (aac-skin-fill)
      // — dead weight, nothing here styles by class.
      { name: 'removeAttrs', params: { attrs: ['(^on.*)', 'class'] } },
    ],
  });
  const { svg, inked } = inkDefaultFills(data);
  if (inked) console.warn(`note  ${name}: ${inked} fill-less paint element(s) would have rendered black — inked ${INK}`);
  // Belt-and-braces after SVGO: refuse to write if any active-content vector
  // survived sanitization (these bytes are served from the site's own origin).
  // Internal #id references (<use xlink:href="#x">) are allowed; anything
  // external or executable fails the word loudly instead of shipping. A
  // surviving <style> block (class-based fills some Mulberry files use) is
  // refused too — its generic .st0/#Layer_1 names would collide if inlined.
  const DENYLIST = /<\s*(script|foreignObject|style|animate|animateTransform|animateMotion|set|iframe|image)\b|javascript:|(?:xlink:)?href\s*=\s*["'](?!#)/i;
  if (DENYLIST.test(svg)) throw new Error(`sanitization denylist hit — refused to write ${name}.svg`);
  // .tmp suffix (NOT .svg) so a crash mid-write can never leave a stray file
  // that vite.config.ts's `**/*.svg` precache glob would ship to every user.
  const tmp = join(ART_DIR, `${name}.svg.tmp`);
  const out = join(ART_DIR, `${name}.svg`);
  writeFileSync(tmp, svg, 'utf8');
  renameSync(tmp, out); // atomic — never a half-written asset
  return svg.length;
}

const requested = process.argv.slice(2);
const targets = requested.length ? requested : [...Object.keys(MAP), ...Object.keys(MULBERRY)];

let ok = 0, failed = 0;
for (const name of targets) {
  const source = sourceOf(name);
  if (!source) { console.warn(`skip  ${name}: no OpenMoji or Mulberry mapping`); continue; }
  try {
    const bytes = await fetchOne(name, source.url);
    console.log(`ok    ${name}.svg  (${bytes} bytes, remapped from ${source.label})`);
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
