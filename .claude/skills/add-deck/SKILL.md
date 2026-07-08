---
name: add-deck
description: Use when adding a new phonics deck or word list to potty-flashcards, extending an existing deck with more words, or improving OpenMoji art coverage on cards that currently render image-free.
---

## Overview

Turns a phonics word list (e.g. "bl blends") into a shipped deck: schema-correct JSON, verified OpenMoji art (or a deliberate image-free card), and a passing validate/test/build pipeline.

## When to Use

- A new phonics pattern needs a deck.
- An existing deck needs more words.
- Improving art coverage on cards that render image-free.

## Process

1. **Read a sibling deck** in `decks/*.json` for the target `category` (`cvc`, `digraphs`, `blends` — see `src/categories.ts`) to find the next free `order`; unique **within** a category, not globally.
2. **Draft the deck JSON** (schema below). One `type:"word"` card per word; `graphemes` documents the phonics split; omit `img` entirely for image-free cards (never `null`/`""`).
3. **Find art per word.** Pick an OpenMoji hexcode and verify it resolves at the pinned release (`OPENMOJI_REF = '15.1.0'` in `scripts/fetch-art.mjs`, see Quick Reference). No literal glyph? Think figuratively before giving up (e.g. `shed` → hut `1F6D6`); an ink-arrow to a body part (`chin`, `shin`) is allowed per DESIGN.md. Nothing reliably reads for a 3–5-year-old? Leave it image-free (see `whiz`, `thud`) — wrong art is worse than none.
4. **Add verified entries to `MAP`** in `scripts/fetch-art.mjs` (match its comment style), then `npm run fetch-art -- word1 word2 ...` to fetch, palette-remap, and SVGO-optimize into `public/art/`.
5. **Write `decks/<id>.json`**, pointing `img` only at words that got art.
6. **Validate, test, build** (Quick Reference); fix any reported error.
7. **Report art coverage** as a table (below).

## Deck JSON Schema (from `decks/blends.json`)

```json
{
  "id": "blends",
  "title": "Blends",
  "kind": "phonics",
  "category": "blends",
  "order": 1,
  "cards": [
    { "type": "word", "text": "flag", "graphemes": ["fl", "a", "g"], "img": "art/flag.svg" },
    { "type": "word", "text": "tent", "graphemes": ["t", "e", "nt"] }
  ]
}
```

`img`, when present, must exactly match `art/<name>.svg` and the file must already exist (case-sensitively) in `public/art/`.

## Quick Reference

| Task | Command |
|---|---|
| Verify a hexcode at the pinned release (expect `200`) | `curl -sI https://raw.githubusercontent.com/hfg-gmuend/openmoji/15.1.0/color/svg/<HEX>.svg` |
| Fetch + recolor specific words | `npm run fetch-art -- word1 word2` |
| Fetch + recolor everything in MAP | `npm run fetch-art` |
| Validate schema/order/category/art paths | `npm run validate` |
| Contrast gate | `npm run check-contrast` |
| Unit tests | `npm test` |
| E2E tests | `npm run test:e2e` |
| Full build (validate + contrast + typecheck + vite) | `npm run build` |

## Common Mistakes

- **Unverified hexcodes.** A hex in `MAP` not confirmed to 200 at `15.1.0` (not `master`) can keep a stale placeholder or fetch the wrong image — glyphs move between releases.
- **Skipping `npm run validate`.** Catches duplicate `order` per category, unknown `category`, and `img` paths that don't case-sensitively resolve — GitHub Pages is case-sensitive even when local dev isn't.
- **Touching `src/machine.ts`.** The pure reducer is off-limits — a new deck is pure data (Eng Decision #11); it never requires `src/` changes.
- **Breaking the recolor palette.** Art in `public/art/` must stay within the six `PALETTE` hexes (`scripts/fetch-art.mjs`): `#a6785a #c9b48f #e0cba8 #cbb287 #8a6a4a #3d3833`. No blues, no saturation, even hand-drawn.
- **Adding motion or gamification to "help" coverage.** DESIGN.md is absolute: zero animation, sound, mascots, stars. A figurative image may add one ink (`#3d3833`) arrow at most.
- **Forcing a weak figurative match.** An ambiguous image confuses a 4-year-old; leaving it image-free is the honest choice.

## Art-Coverage Report

Finish every run with this table; flag figurative/image-free rows for James to eyeball.

| Word | Hexcode | Has Art | Verdict |
|---|---|---|---|
| flag | 1F6A9 | yes | direct match |
| shed | 1F6D6 | yes | figurative (~hut) — eyeball |
| whiz | — | no | no reliable glyph, image-free |
