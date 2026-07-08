#!/usr/bin/env node
/* Build-time deck validation (Eng Decision #4). Run in prebuild + CI.
 * FAILS the build on structural errors; WARNS (not fail) on v1 sentence cards
 * so the loader's skip is never silent. */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DECKS_DIR = join(ROOT, 'decks');
const ART_DIR = join(ROOT, 'public', 'art');

// Category ids the picker knows how to group under. Derived from the TS
// manifest (src/categories.ts) rather than hand-copied, so the two can't drift:
// a category that exists in one place but not the other would let the validator
// pass while groupByCategory() silently drops the deck from the picker. This
// .mjs can't import TS, so parse the `id:` string literals out of CATEGORIES.
const CATEGORIES_SRC = readFileSync(join(ROOT, 'src', 'categories.ts'), 'utf8');
const CATEGORY_IDS = new Set(
  [...CATEGORIES_SRC.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]),
);
// Reserved id namespace for synthetic per-category "shuffle all" decks.
// A real deck must never claim it. Derived from src/decks.ts (same anti-drift
// reason as CATEGORY_IDS above) rather than hand-copied.
const DECKS_SRC = readFileSync(join(ROOT, 'src', 'decks.ts'), 'utf8');
const SHUFFLE_PREFIX = DECKS_SRC.match(
  /SHUFFLE_PREFIX\s*=\s*'([^']+)'/,
)?.[1] ?? 'shuffle:';

const errors = [];
const warnings = [];
const orders = new Map(); // `${category}:${order}` -> deckFile (order is unique WITHIN a category)
const ids = new Map(); // id -> deckFile (duplicate id = second deck silently unreachable)

if (CATEGORY_IDS.size === 0) {
  errors.push('src/categories.ts: parsed zero category ids (manifest moved or regex drift?)');
}

const files = readdirSync(DECKS_DIR).filter((f) => f.endsWith('.json'));
if (files.length === 0) errors.push('decks/: no .json deck files found');

// Exact-case listing of public/art — see the case-sensitivity note below.
const artFiles = new Set(readdirSync(ART_DIR));

// Palette gate (DESIGN.md): every shipped art SVG must stay within the six
// warm-palette hexes. PALETTE and the KEEP_COLORS exception list are derived
// from scripts/fetch-art.mjs (same anti-drift reason as CATEGORY_IDS above).
const FETCH_ART_SRC = readFileSync(join(__dirname, 'fetch-art.mjs'), 'utf8');
const PALETTE = new Set(
  ((FETCH_ART_SRC.match(/const PALETTE = \[([^\]]+)\]/)?.[1] ?? '')
    .match(/#[0-9a-fA-F]{6}/g) ?? []).map((h) => h.toLowerCase()),
);
const KEEP_COLORS = new Set(
  ((FETCH_ART_SRC.match(/const KEEP_COLORS = new Map\(\[([\s\S]*?)\]\);/)?.[1] ?? '')
    .match(/\['[^']+'/g) ?? []).map((s) => s.slice(2, -1)),
);
if (PALETTE.size === 0) {
  errors.push('scripts/fetch-art.mjs: parsed zero PALETTE hexes (palette moved or regex drift?)');
}
for (const art of artFiles) {
  if (!art.endsWith('.svg') || KEEP_COLORS.has(art.replace(/\.svg$/, ''))) continue;
  const svg = readFileSync(join(ART_DIR, art), 'utf8');
  const offPalette = new Set();
  // Same hex-shape rules as fetch-art's remap(): skip url(#id) references.
  for (const m of svg.matchAll(/(?<!url\()#([0-9a-fA-F]{6})\b/g)) {
    const hex = `#${m[1].toLowerCase()}`;
    if (!PALETTE.has(hex)) offPalette.add(hex);
  }
  for (const m of svg.matchAll(/(?<!url\()#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])\b(?![0-9a-fA-F])/g)) {
    const hex = `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase();
    if (!PALETTE.has(hex)) offPalette.add(hex);
  }
  if (offPalette.size) {
    errors.push(`public/art/${art}: off-palette color(s) ${[...offPalette].join(', ')} — art must stay within the six DESIGN.md hexes (KEEP_COLORS in scripts/fetch-art.mjs is the only sanctioned exception)`);
  }
}

for (const file of files) {
  const path = join(DECKS_DIR, file);
  let deck;
  try {
    deck = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${file}: invalid JSON — ${e.message}`);
    continue;
  }

  for (const field of ['id', 'title', 'kind', 'category']) {
    if (typeof deck[field] !== 'string' || deck[field].length === 0) {
      errors.push(`${file}: missing/invalid "${field}"`);
    }
  }

  if (typeof deck.category === 'string' && deck.category.length > 0 && !CATEGORY_IDS.has(deck.category)) {
    errors.push(`${file}: unknown category "${deck.category}" (must be one of ${[...CATEGORY_IDS].join(', ')} — see src/categories.ts)`);
  }

  if (typeof deck.id === 'string' && deck.id.length > 0) {
    if (deck.id.startsWith(SHUFFLE_PREFIX)) {
      errors.push(`${file}: id "${deck.id}" uses the reserved "${SHUFFLE_PREFIX}" prefix (synthetic shuffle-all decks only)`);
    } else if (ids.has(deck.id)) {
      errors.push(`${file}: duplicate id "${deck.id}" (also in ${ids.get(deck.id)}) — findDeck() would always resolve the first, making this deck unreachable`);
    } else {
      ids.set(deck.id, file);
    }
  }

  // order is the intra-category sort key, so uniqueness is scoped to the
  // category: cvc #1 and digraphs #1 must NOT collide, but two digraph decks
  // sharing order 1 still must.
  if (!Number.isInteger(deck.order)) {
    errors.push(`${file}: missing/invalid integer "order"`);
  } else if (typeof deck.category === 'string') {
    const key = `${deck.category}:${deck.order}`;
    if (orders.has(key)) {
      errors.push(`${file}: duplicate order ${deck.order} within category "${deck.category}" (also in ${orders.get(key)})`);
    } else {
      orders.set(key, file);
    }
  }

  if (!Array.isArray(deck.cards) || deck.cards.length === 0) {
    errors.push(`${file}: empty or missing "cards" array`);
    continue;
  }

  // A deck whose cards are ALL sentence-type passes the emptiness check above
  // but yields zero renderable cards in the v1 loader — a "0 words" picker
  // row that crashes the WORD-beat render. Fail it, don't warn.
  if (!deck.cards.some((c) => c && c.type === 'word')) {
    errors.push(`${file}: no renderable "word" cards — the v1 loader skips "sentence" cards, leaving this deck empty`);
  }

  deck.cards.forEach((card, i) => {
    const where = `${file} card[${i}] (${card && card.text ? card.text : '?'})`;
    if (!card || (card.type !== 'word' && card.type !== 'sentence')) {
      errors.push(`${where}: missing/invalid "type" (must be "word" or "sentence")`);
      return;
    }
    if (typeof card.text !== 'string' || card.text.length === 0) {
      errors.push(`${where}: missing/invalid "text"`);
    }
    if (card.type === 'sentence') {
      warnings.push(`${where}: "sentence" card present — v1 loader SKIPS it (author-ahead forward-compat)`);
    }
    // graphemes is unused at runtime today (forward-compat, src/types.ts), but
    // a split that doesn't join back to the word is an authoring error that
    // would ship silently until a feature consumes the field.
    if (card.graphemes != null) {
      if (!Array.isArray(card.graphemes) || card.graphemes.length === 0
          || card.graphemes.some((g) => typeof g !== 'string' || g.length === 0)) {
        errors.push(`${where}: "graphemes" must be a non-empty array of non-empty strings`);
      } else if (card.graphemes.join('') !== card.text) {
        errors.push(`${where}: graphemes [${card.graphemes.join(', ')}] do not join to "${card.text}"`);
      }
    }
    if (card.img != null) {
      const img = String(card.img);
      // Strict: the runtime prepends BASE_URL verbatim and GitHub Pages is
      // case-sensitive, so the validator must not be looser than production
      // (existsSync is case-INsensitive on Windows/macOS dev machines).
      if (!/^art\/[A-Za-z0-9._-]+\.svg$/.test(img)) {
        errors.push(`${where}: img "${img}" must match art/<name>.svg exactly`);
      } else if (!artFiles.has(img.slice('art/'.length))) {
        errors.push(`${where}: img "${img}" does not resolve (case-sensitively) to a file in public/art/`);
      }
    }
  });
}

for (const w of warnings) console.warn(`WARN  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`FAIL  ${e}`);
  console.error(`\nDeck validation FAILED: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Deck validation PASSED: ${files.length} deck(s), ${warnings.length} warning(s).`);
