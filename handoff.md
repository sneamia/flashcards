# Handoff — v1.3 deck expansion (11 new decks) + art-coverage swaps

**Branch:** `v1.3/deck-expansion` (base `main` @ `43f392d`, 2 commits ahead, tree clean)
**Date:** 2026-07-07 · **Status:** decks built AND art-coverage swaps applied (James approved all 25 swaps + red exception 2026-07-07); fully verified; ready to ship
**Source docs:** `~/.gstack/projects/flashcards/james-none-design-20260704-193000.md` (approved design spec), repo `DESIGN.md`, `TODOS.md`, `.claude/skills/add-deck/SKILL.md` (deck-adding process)

## What this is

Expanded the deck lineup from 6 to 17 decks (70 → 275 words) via six parallel subagents, one lane each: five short-vowel CVC decks, ng/ck digraphs, and four blend-family decks. Then researched how to raise art coverage (currently 68/110 new words, ~62%) — findings below, not yet implemented.

## Done

- **11 new decks** (`decks/*.json`): cvc-a/e/i/o/u (orders 2–6), ng/ck (digraph orders 5–6), l-blends/r-blends/s-blends/end-blends (blend orders 2–5). 67 new palette-remapped SVGs in `public/art/`; append-only MAP additions in `scripts/fetch-art.mjs` (all hexcodes curl-verified at OpenMoji 15.1.0).
- **Test fixtures updated** for the new landscape: `tests/unit/decks.test.ts` (17 decks, per-deck counts, digraph order sh/ch/th/wh/ng/ck, CVC/Blends no longer single-deck categories) and `tests/e2e/flows.spec.ts` (digraphs shuffle pool 32 → 52 words).
- **Art-coverage swaps APPLIED** (commit `081199e`): all 25 icon-first swaps below, trap/jam glyphs, and the red `KEEP_COLORS` exception in `fetch-art.mjs`. Coverage now **93/110 (~85%)**. Adversarial review: no blockers; graphemes for split-digraph words (snake/slide/skate/plate/flute/plane) use consonant+e chunks — unrendered forward-compat data, revisit if graphemes ever render.
- **Coverage research** (now implemented, kept for reference):
  - Catalog sweep of all 4,284 OpenMoji 15.1.0 entries found 2 missed glyphs: **trap → 1FAA4** (mouse trap, direct) and **jam → 1FAD9-200D-1F7E5** (jar with red content).
  - **Icon-first word swaps** (all hexcodes verified in catalog): mat→ram 1F40F; vet→gem 1F48E; cot→cop 1F46E, job→bot 1F916; L-blends flat→cloud 2601, blob→flute 1FA88, blot→plane 2708, plum→plate 1F37D; R-blends grab/trip/crib/prop/press→crown 1F451/train 1F682/grapes 1F347/bread 1F35E/brush 1F58C; S-blends spin/snap/slip/slam/skip→spider 1F577/snake 1F40D/slide 1F6DD/swan 1F9A2/skate 26F8; End-blends band/lamp/jump/belt/pond→plant 1FAB4/wolf 1F43A/ant 1F41C/melt 1FAE0/wind 1F32C.
  - **"red" exception approved in principle by James**: use 1F7E5 red square, add a per-word `keepColors` flag to `fetch-art.mjs` skipping the palette remap for just that file; verify check-contrast still passes.
  - Net effect if all adopted: 68/110 → **93/110 (~85%)**, no new dependencies. Stubborn tail (17 words: pet, peg, top, mud, rug, gum, bib, hit, long, hang, fang, gong, kick, neck, back, tick, glue) has no honest OpenMoji glyph.
  - **Other image sets**: other emoji sets (Twemoji/Noto) add nothing — same Unicode concept space. Best true complement is **Mulberry Symbols** (CC BY-SA 4.0, same license as OpenMoji, ~3,400 child-focused AAC SVGs — has glue, bib, kick, mud…); would need a name-based second source in fetch-art.mjs. Game-icons.net (CC BY, needs curation) and ARASAAC (CC BY-NC-SA) are weaker fits.
- Shared-glyph duplicates flagged for eyeball: hut/shed (1F6D6), jog/run (1F3C3), drip/wet (1F4A7).

## Verification done

`npm run validate` (17 decks, 0 errors) · `npm run check-contrast` · `npm test` (84/84) · `npm run test:e2e` (23/23) · `npm run build` green (PWA precache 166 entries). All run AFTER the swaps were applied.

## Next

1. `/ship` (branch → PR → merge per land-and-deploy; merging is pre-authorized in user CLAUDE.md).

## Deferred / follow-ups

- Mulberry Symbols as second art source for the stubborn 17 image-free words (pipeline extension).
- Eyeball pass on figurative art + the shared-glyph pairs: hut/shed (1F6D6), jog/run (1F3C3), drip/wet (1F4A7), plane/jet (2708), plate/dish (1F37D).
- Split-digraph grapheme convention (e.g. `a_e`) if graphemes ever render (see review note above).
- See `TODOS.md` for pre-existing backlog.
