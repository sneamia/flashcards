# Handoff — v1.8 vowel-team decks + Mulberry Symbols art (BRANCH, not yet reviewed or shipped)

**Branch:** `v1.8/vowel-teams-mulberry-art` — 12 commits ahead of `main` @ `6090513` (see Done). Not squashed, not merged, not deployed; a PR is open from this branch (`gh pr view`).
**Date:** 2026-10-12 · **Status:** implementation complete, all four gates green on the final tree; `/review` run (6 specialists + red team + Claude adversarial + Codex adversarial) and its findings fixed in `8252992`; the unresolved items are device-eyeball judgments (Open, below). Merge and deploy are James's call (`/land-and-deploy`) — P1.3 reserved the Mulberry design sign-off for him.
**Source docs:** the plan at `docs/superpowers/plans/2026-10-12-v1.8-vowel-teams-mulberry-art.md` (committed in `c2b251e` with an as-executed note), `TODOS.md`, `DESIGN.md`, `CLAUDE.md`. The v1.7 record this replaced lives at git `6090513:handoff.md`.

## What this was

Two pieces of work on one branch. (A) Shrink the image-free tail: add Mulberry
Symbols as a SHA-pinned second art source for words OpenMoji cannot draw, and
hand-draw the rest where an honest picture exists. James's mid-task ask: draw
`rug` as two shaded ovals, and draw the other tail words rather than leave them
blank. Result: 7 tail words from Mulberry, 7 hand-drawn from the tail (gate,
rug, top, tube, gong, peg, hit), `whisk` moved off the old never-chase list and
hand-drawn too, plus a hand-drawn `tail` for the new `ai` deck; a hand-drawn
`gum` was tried and cut.

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
  that reads "life ring", speak is a head that reads "talk", loaf's only glyph
  is `bread`'s and reads "bread", sea's candidates are `wave`'s glyph (same
  category) or coral, wait/high/right/bright/sigh have nothing that reads
  honestly (building → "tall", bare arrow, second bulb, exhaling face → "blow").
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
  (`5faf500`), stale-comment refresh (`2d2cfd5`), the plan doc (`c2b251e`),
  the `/review` fixes (`8252992`), this handoff refresh (HEAD).

## Done (`git log --oneline main..`)

```
(HEAD)  docs: refresh the handoff after /review — commit count, gates on the final tree, cross-model status
8252992 fix(review): keep shared-class fills through SVGO, harden the art denylist and inking, gate colour-word files per hex
c2b251e docs: add the v1.8 implementation plan (Mulberry source, hand-drawn tail set, vowel-team decks)
2d2cfd5 docs: refresh the single-deck comments the vowel-team decks made stale; pin the handoff's SHA
5faf500 docs: record v1.8.0 — vowel-team decks, Mulberry Symbols source, backlog follow-ons
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
| `npm run validate` | PASSED — 23 decks (on `8252992`, with the per-hex KEEP_COLORS gate live) |
| `npx vitest run` | 107 passed (9 files) (on `8252992`) |
| `npm run test:e2e` | 37 passed (on `8252992`, `/review` probe 015) |
| `npm run build` | clean; precache 230 entries / 507 KiB (on `8252992`) |

Evidence: `.gstack/qa-reports/review-v1.8-20261012/functional/` (gitignored, local
to James's machine) holds the `/review` probe captures 001–015.

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
- **Scroll-restore e2e now taps `ea`.** The picker-scroll test scrolls `.decks`
  to its maximum and expects that exact offset back after a run. With five decks
  below it, the Magic E row is ~33px above the viewport at max scroll, and
  Playwright's `tap()` scrolls an out-of-view row into view BEFORE the tap — so
  `render()` captured the post-tap offset (1024, not 1057) and restored it
  faithfully. Not an app bug: the test now taps `ea`, the bottom-most deck row,
  which is visible at max scroll. The comment in the test records this.

- **`/review` hardening (`8252992`).** SVGO now inlines SHARED classes too
  (`inlineStyles: { onlyMatchedOnce: false }`) — before, a Mulberry file with
  `.stN` classes lost every fill and would have shipped as an ink silhouette
  under a green run (latent: no shipped file was affected; proven by harness,
  and jeep/coat re-derive byte-identical). `inkDefaultFills` skips
  `<defs>`/`<symbol>` (a `<use fill>` would be overridden), inks fill-less
  `<use>`, and rewrites `inherit`/`initial`/`unset`/`currentColor` fills in
  place. The DENYLIST accepts namespace-prefixed element names and refuses
  `<text>`/`<tspan>`/`<object>`/`<embed>`/`<link>` and external `url()`.
  `validate-decks.mjs` gates KEEP_COLORS files on PALETTE ∪ their listed hex
  instead of skipping the whole file — DESIGN.md's "surgical" claim is now true.

## Open — needs James

1. **Device eyeball list** — the figurative-art picks (Mulberry people-scenes,
   hand-drawn nine, figurative OpenMoji), extended by the review's design pass:
   `back` is the only body-part card without an arrow (add one or cut), `teeth`
   may read "mouth", `tube` "roll", `jeep`/`coat` render dark because the remap
   collapses their browns, and `three`/`five`/`nine` are three keycap squares
   in one Long Vowels pool. See the v1.8 bullet in `TODOS.md` P5.
0. **`green` in KEEP_COLORS** — the colour-word exception's second member
   (precedent: `red`, approved 2026-07-07). DESIGN.md now names it; your
   sign-off is the only thing missing.
2. **Dormant single-deck label branch.** No single-deck category ships now; the
   plain `shuffle` form is covered only by a unit test. Nothing to do unless a
   single-deck category returns (TODOS parked).
3. **Whether to re-add `ow` / `ay`** — researched, deferred, not rejected (TODOS
   ideas), alongside the Other Vowels / Bossy R categories.
4. **P3.17** — the validate-decks fill-less gate and the 16-file black-fill sweep
   are still open.

## Cross-model review

Codex (`gpt-6.1-sol`) **did** run this time — the adversarial pass completed
with two Low findings (the `<use>` fill override and the `inherit`/`initial`
keywords), both fixed in `8252992` alongside the Claude adversarial pass's
shared-class finding. The Claude adversarial, six specialists and red team all
completed.

**KNOWN GAP (non-blocking):** the Codex *structured* review (`codex review
--base main`) returned untagged prose ("No actionable regressions were
identified") with no severity tags or explicit no-findings marker, so the
review tooling records it as unverified coverage rather than a pass.
