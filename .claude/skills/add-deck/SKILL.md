---
name: add-deck
description: Use when adding a new phonics deck or word list to potty-flashcards, extending an existing deck with more words, or improving art coverage (OpenMoji or Mulberry Symbols) on cards that currently render image-free.
---

## Overview

Turns a phonics word list (e.g. "bl blends") into a shipped deck: schema-correct JSON, verified OpenMoji or Mulberry Symbols art (or a hand-drawn SVG, or a deliberate image-free card), and a passing validate/test/build pipeline.

## When to Use

- A new phonics pattern needs a deck.
- An existing deck needs more words.
- Improving art coverage on cards that render image-free.

## Process

1. **Read a sibling deck** in `decks/*.json` for the target `category` (`cvc`, `digraphs`, `blends`, `magic-e` — see `src/categories.ts`; note `magic-e`'s display title is "Long Vowels", so the id and the title differ) to find the next free `order`; unique **within** a category, not globally.
   **Adding a whole new category?** Add `{ id, title, order }` to `src/categories.ts` — that file only; validate-decks.mjs regex-derives the valid id set from it, so nothing else in `src/` changes. The category must ship with at least one deck whose `category` matches, or `groupByCategory()` silently drops it and it never renders. You also owe: a README bullet (pinned by `tests/unit/docs-sync.test.ts`) and the pinned id/title/count arrays in `tests/unit/decks.test.ts` + `tests/e2e/flows.spec.ts`.
2. **Draft the deck JSON** (schema below). One `type:"word"` card per word; `graphemes` documents the phonics split; omit `img` entirely for image-free cards (never `null`/`""`). **Exception — `decks/magic-e.json` deliberately carries no `graphemes` key at all** and must stay that way: silent-e words segment as consonant+e chunks (`["sn","a","ke"]`), which teaches the wrong vowel sound if graphemes ever render, and the `a_e` notation that would fix it is illegal under validate-decks.mjs's `graphemes.join('') === text` rule. Do not "helpfully" fill it in — see the parked convention item in `TODOS.md`.
3. **Find art per word.** Pick an OpenMoji hexcode and verify it resolves at the pinned ref (`OPENMOJI_REF` in `scripts/fetch-art.mjs` — a commit SHA equal to release 15.1.0, see Quick Reference). No OpenMoji glyph? Check Mulberry Symbols second — the `MULBERRY` table in `scripts/fetch-art.mjs`, pinned at `MULBERRY_REF`; grep the `EN/` file list at that commit, names are literal (`clothes_peg`, `kick_ball_1_,_to`), and files with a `<style>` block or an embedded raster are refused by the denylist. A word goes in exactly ONE of the two tables (fetch-art exits non-zero otherwise). Neither set reads? A hand-drawn SVG in the house style (see `public/art/chin.svg`, `rug.svg`) is the third option — list it in the placeholders comment, never in a table. No literal glyph? Think figuratively before giving up (e.g. `shed` → hut `1F6D6`); an ink-arrow to a body part (`chin`, `shin`) is allowed per DESIGN.md. Nothing reliably reads for a 3–5-year-old? Leave it image-free (see `whiz`, `thud`) — wrong art is worse than none. Also never reuse a hexcode already mapped to another word **in the same category** (see Common Mistakes) — that's why `jog` is image-free even though `1F3C3` exists.
4. **Add verified entries to `MAP` (OpenMoji) or `MULBERRY` (Mulberry)** in `scripts/fetch-art.mjs` (match their comment style), then `npm run fetch-art -- word1 word2 ...` to fetch, palette-remap, and SVGO-optimize into `public/art/`.
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
| Verify a hexcode at the pinned ref (expect `200`) | `curl -sI https://raw.githubusercontent.com/hfg-gmuend/openmoji/$(node -p "require('fs').readFileSync('scripts/fetch-art.mjs','utf8').match(/OPENMOJI_REF = '([^']+)'/)[1]")/color/svg/<HEX>.svg` |
| Verify a Mulberry file name at the pinned ref (expect `200`) | `curl -sI "https://raw.githubusercontent.com/mulberrysymbols/mulberry-symbols/$(node -p "require('fs').readFileSync('scripts/fetch-art.mjs','utf8').match(/MULBERRY_REF = '([^']+)'/)[1]")/EN/<name>.svg"` |
| Fetch + recolor specific words | `npm run fetch-art -- word1 word2` |
| Fetch + recolor everything in MAP | `npm run fetch-art` |
| Validate schema/order/category/art paths | `npm run validate` |
| Contrast gate | `npm run check-contrast` |
| Unit tests | `npm test` |
| E2E tests | `npm run test:e2e` |
| Full build (validate + contrast + typecheck + vite) | `npm run build` |

## Common Mistakes

- **Running `npm run fetch-art` with no arguments.** It re-fetches every mapped word from both sources (and would rewrite 150+ files if SVGO's output ever shifts); always pass the words you changed.
- **Unverified hexcodes.** A hex in `MAP` not confirmed to 200 at the pinned `OPENMOJI_REF` (not `master`) can keep a stale placeholder or fetch the wrong image — glyphs move between releases. The same goes for a Mulberry file name — verify it at `MULBERRY_REF`, not `master`.
- **Skipping `npm run validate`.** Catches duplicate `order` per category, duplicate word `text` or duplicate `img` within a category, unknown `category`, and `img` paths that don't case-sensitively resolve — GitHub Pages is case-sensitive even when local dev isn't.
- **Giving two words in one category the same drawing.** A category's "shuffle all" row mixes every deck in that category into one pool, so two cards there pointing at the same SVG reveal the identical picture for two different words — which reads to the child as the app having lost its place. It comes back two ways, each caught by a different gate — run both: reusing one `MAP` hexcode across two words fails `npm test` (`tests/unit/art-map.test.ts`, which joins card text → MAP key), while aiming a card's `img` straight at another word's existing file fails `npm run validate` (which checks the rendered file path and so is blind to the MAP). Neither gate subsumes the other. Leave the second word image-free instead — that's why `jog` ships without art while `run` keeps OpenMoji `1F3C3` (both CVC). **Across** categories the reuse is deliberate and stays legal (a pool never spans categories): `jet`/`plane`, `dish`/`plate`, `bath`/`tub`, `hut`/`shed`, `drip`/`wet` all ship byte-identical.
- **Touching `src/machine.ts`.** The pure reducer is off-limits — a new deck in an *existing* category is pure data (Eng Decision #11) and needs no `src/` change at all. A new *category* is the one exception, and it is still only the `CATEGORIES` array in `src/categories.ts`.
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
