# Handoff — v1.8 vowel-team decks + Mulberry Symbols art (BRANCH, not yet reviewed or shipped)

**Branch:** `v1.8/vowel-teams-mulberry-art` — 8 commits ahead of `main` @ `6090513` (7 implementation commits plus this record). Not squashed, not PR'd, not merged, not deployed.
**Date:** 2026-10-12 · **Status:** implementation complete, all four gates green; `/review` and `/ship` are the next steps (not yet run).
**Source docs:** the plan at `docs/superpowers/plans/2026-10-12-v1.8-vowel-teams-mulberry-art.md` (in-repo, untracked at the time of writing — the controller decides whether it ships), `TODOS.md`, `DESIGN.md`, `CLAUDE.md`. The v1.7 record this replaced lives at git `6090513:handoff.md`.

## What this was

Two pieces of work on one branch. (A) Shrink the image-free tail: add Mulberry
Symbols as a SHA-pinned second art source for words OpenMoji cannot draw, and
hand-draw the rest where an honest picture exists. James's mid-task ask: draw
`rug` as two shaded ovals, and draw the other tail words rather than leave them
blank. Result: 7 tail words from Mulberry, 8 hand-drawn (gate, rug, top, tube,
whisk, gong, peg, hit) plus a hand-drawn `tail`; a hand-drawn `gum` was tried
and cut.

(B) Five vowel-team decks under Long Vowels — `ai`, `ee`, `igh`, `oa`, `ea`,
47 words, 37 illustrated, each carrying its team as one grapheme chunk. Five,
not six: `ow` was researched and deferred (see TODOS ideas). Long Vowels is now
6 decks / 75 words.

## Scope decisions made (do not re-litigate)

- **`ow` deferred.** The same spelling says /ow/ in cow, so it belongs beside the
  other vowel sounds, and its long-o words (slow, grow, row, glow, show, throw)
  have no honest art. `ay` has at most 50% honest art. Both in TODOS ideas.
- **`seed` replaced by `heel`** in the `ee` deck.
- **`coat` from Mulberry** — OpenMoji's coat glyph reads "dress".
- **Word-only on purpose:** wait, high, right, bright, sigh, toad, float, loaf,
  sea, speak. Reasons: toad reads "frog", float's best picture is a ring buoy
  that reads "life ring", speak is a head that reads "talk", sea/loaf have no
  glyph a 4-year-old names correctly, and wait/high/right/bright/sigh are
  abstract.
- **Mulberry candidates rejected:** clothes peg (reads "clothespin"), chewing
  gum (a chocolate bar once the colour is gone), 105 KB rug (too heavy). All
  three replaced by hand-drawn versions, except gum — the hand-drawn gum (a face
  blowing a bubble) was tried and cut because it read as a face beside a coin.
- **No OpenMoji hex reused across categories for the new decks** — stricter than
  the convention, so no new byte-identical pairs.
- **Magic E graphemes untouched** (still 0/28, pinned); the vowel-team decks are
  pinned the other way, to carry them.
- **One commit per unit of work** (below): Mulberry source + 7 words
  (`3ede482`), hand-drawn pictures (`1fb2364`), attribution docs (`14abdfc`),
  rug shading fix (`33f1908`), pipeline hardening from review (`8b94220`), gum
  cut (`0f7871c`), vowel-team decks + 37 drawings (`115617f`), release record
  (this commit).

## Done (`git log --oneline main..`)

```
<this commit> docs: record v1.8.0 — vowel-team decks, Mulberry Symbols source, backlog follow-ons
115617f feat: five vowel-team decks (ai, ee, igh, oa, ea) under Long Vowels with 37 new drawings
0f7871c fix: cut gum's hand-drawn art — a face beside a light disc reads as a coin, not a bubble
8b94220 refactor: harden the art pipeline's default-fill inking and named-colour remap after review
33f1908 fix: smooth the rug's shading into one continuous band
14abdfc docs: credit Mulberry Symbols alongside OpenMoji in the overlay, license and docs
1fb2364 feat: nine hand-drawn illustrations for words neither symbol set covers
3ede482 feat: add Mulberry Symbols as a second art source and illustrate seven image-free words
```

## Verification (final tree)

| Gate | Result |
|---|---|
| `npm run validate` | PASSED — 23 decks |
| `npx vitest run` | 107 passed (9 files) |
| `npm run test:e2e` | 37 passed (run by the controller before the vowel-team commit; not re-run for this docs-only record) |
| `npm run build` | clean; precache 230 entries / 507.39 KiB |

Totals: 23 decks / 257 cards / 249 distinct words / 223 illustrated (87%) /
215 art SVGs / 178 MAP + 21 MULBERRY entries. Pools 70 / 55 / 57 / 75.

## Guards worth knowing about

- **Inverse graphemes pin.** `tests/unit/decks.test.ts` pins Magic E at no
  `graphemes` key on any card AND the five vowel-team decks at carrying them
  with the team as one chunk (`r·ai·n`). A tool "helpfully" filling or stripping
  either side now fails red.
- **One source per word.** A word may sit in MAP or MULBERRY, never both —
  enforced at runtime by `fetch-art.mjs` (it refuses) and by a unit test.
- **`inkDefaultFills`.** The fetch pipeline inks fill-less paint elements in the
  palette's dark tone, so new art cannot ship black. This closes the hole for new
  art only; the validate-decks gate and the 16 older files are still TODOS P3.17.
- **Scroll-restore e2e now taps `ea`.** The picker-scroll test used to tap the
  last row, which was Magic E; Long Vowels now has six decks and Magic E sits
  mid-list, so the test taps `ea` (the new last deck) to keep proving the bottom
  of a long list is reachable and restored.

## Open — needs James

1. **Device eyeball list** — the figurative-art picks (Mulberry people-scenes,
   hand-drawn nine, figurative OpenMoji). See the v1.8 bullet in `TODOS.md` P5.
2. **Dormant single-deck label branch.** No single-deck category ships now; the
   plain `shuffle` form is covered only by a unit test. Nothing to do unless a
   single-deck category returns (TODOS parked).
3. **Whether to re-add `ow` / `ay`** — researched, deferred, not rejected (TODOS
   ideas), alongside the Other Vowels / Bossy R categories.
4. **P3.17** — the validate-decks fill-less gate and the 16-file black-fill sweep
   are still open.

## Known gap (non-blocking)

Cross-model review status: filled in by /review.
