# Handoff — v1.7 Long Vowels category (BRANCH, not yet reviewed or shipped)

**Branch:** `v1.7/magic-e-category` — 13 commits ahead of `main` @ `1783040`. Not squashed, not PR'd, not merged, not deployed.
**Date:** 2026-08-01 · **Status:** implementation complete, all four gates green, adversarial review done and its findings fixed or backlogged. **Next step is `/review` then `/ship`.**
**Source docs:** the spec authored in-session via `/spec` (archived under `~/.gstack/projects/flashcards/specs/`), `TODOS.md` (updated), repo `DESIGN.md`, `CLAUDE.md` conventions. The v1.6 record this replaced lives at git `1783040:handoff.md`.

## What this was

Add silent-e / CVCe as a fourth category — the natural pedagogy step after
blends, and the first new category since the app shipped with three. Specced
first (it was a `plan first` backlog item), then implemented in three
file-disjoint waves plus a review-fix pass.

Two things worth carrying forward: the spec's own "what breaks" table was wrong
in two places, and the adversarial review found three HIGH findings. Both are
recorded here rather than quietly corrected.

## Scope decisions made (do not re-litigate)

James decided these explicitly during the spec (D1–D5):

- **One deck, not per-vowel.** Word supply is lopsided — u_e yields only 3 usable
  words, so per-vowel decks would ship a visible runt.
- **No `graphemes` key** on any Magic E card. **This one needs revisiting — see
  Open below.**
- **Soft c/g, s=/z/, `ph` words held back** (face, page, race, space, rice, mice,
  nose, rose, phone). Each smuggles in a rule the app has never taught. Now its
  own TODOS item, with art already researched and verified.
- **The 8 existing magic-e words duplicated in, not moved.** Moving them would
  reorder cards mid-deck in 5 shipped decks — the exact trigger condition TODOS
  item 11 names for revisiting the resume-by-index bug.
- **28 cards**, longest deck in the app (previous max 20, `cvc`). I raised the
  session-length concern; James reaffirmed. A chosen trade, not a defect.

## Done (`git log --oneline main..`)

```
874a302 docs: close the Magic-E backlog item and record what v1.7 review left open
07d126a docs: sync CLAUDE.md current state to the in-flight v1.7 branch
c2d6c08 v1.7.0: Long Vowels category with the 28-card Magic E deck
186d058 docs: add the Long Vowels category to the doc enumerations and fix the u_e rule
1fd6cf1 test: guard deck-vs-category titles and cross-category duplicate words
7151781 fix: rename the category to Long Vowels and drop misleading mule/stone art
70ab071 chore: gitignore the /implement wave-state directory
971c0d5 docs: correct the stale single-deck shuffle comment in shuffleRowEl
5d8bda0 test: cover the four-category picker and the single-deck shuffle label
b80c462 docs: document the Magic E category and the single-deck shuffle label
47cea1a test: pin deck and category totals to 18 decks / 4 categories
0b8636f feat: add the Magic E deck as a fourth category (28 cards)
84ba0d9 feat: add OpenMoji art for the Magic E deck (16 glyphs)
```

## Shipped

- Category id `magic-e`, **title "Long Vowels"** — id and title differ on
  purpose. The deck inside is titled "Magic E". They must not match; there is now
  a guard for it.
- 28 cards, 20 illustrated, 8 word-only (cape, tape, gate, tube, mule, stone,
  cube, smile).
- 12 new OpenMoji glyphs shipped (16 were verified HTTP 200 at the pinned ref
  `005bf5b`, OpenMoji 15.1.0, before going into MAP; `mule` and `stone` were
  cut mid-implementation and `cube` and `smile` cut in `/review` — see Fixed
  in CHANGELOG).
- **First single-deck category in the app's history.** `shuffleRowEl`'s
  `decks.length > 1` branch (`src/main.ts:288`, `:294`) had been dead code since
  v1.2; it now renders plain `shuffle` instead of `shuffle all`, because nothing
  is being combined. Pinned by e2e in *both* directions with exact-match
  assertions — `toContainText('shuffle')` passes for either label and would
  prove nothing.
- **First cross-category duplicate words**: 210 cards, 202 distinct.

## Verification (final tree)

| Gate | Result |
|---|---|
| `npm run validate` | PASSED — 18 decks, 0 warnings |
| `npx vitest run` | 104 passed (9 files) |
| `npm run test:e2e` | 36 passed |
| `npm run build` | clean; `tsc --noEmit` clean; precache 178 entries / 363.25 KiB |

Totals: 18 decks / 210 cards / 202 distinct words / 171 illustrated (81%) /
163 art SVGs / 156 MAP entries. Pools 70 / 55 / 57 / 28.

## Two new guards worth knowing about

Both in `tests/unit/decks.test.ts`, both deliberately broken and re-verified red
before being committed green:

- **A deck title never equals its own category title.** v1.4 retitled `CVC Mix`
  and `Mixed Blends` precisely to stop them echoing their headers, but that rule
  lived *only* as a prose comment in a test — which is why this branch first
  shipped a `Magic E` deck under a `Magic E` header with the whole suite green.
  A collision also makes a deck run and a category shuffle run render an
  identical in-run corner (`${title} · 1 of 28` either way) even though only the
  deck run is resumable.
- **Cross-category duplicate words restricted to a pinned 8-word allowlist.**
  `validate-decks.mjs`'s duplicate-word guard is scoped per category, so the
  moment intentional duplicates existed, an *accidental* one became invisible to
  every gate in the repo.

## Where the spec was wrong (for calibration)

- It named `NUMBER_WORDS` in `docs-sync.test.ts` as the fix for documenting a
  single-deck category, but missed that the regex on the next line hardcodes the
  plural `decks,`. A subagent caught it and correctly refused to force the suite
  green. Fix was widening the pattern to `decks?,`, which changes what the guard
  *parses*, not what it *asserts*.
- It listed one stale assertion site in `decks.test.ts`; there were four, plus
  two test names carrying the old counts in prose.

## What `/review` changed (2026-08-01, after the record above)

Seven reviewers (5 specialists + red team + adversarial). Decisions D1–D4 taken
by James; everything else was mechanical and auto-applied.

- **Cut `cube` and `smile` art** (D2) — `cube` renders as the same tan box as
  `block`/`box`, `smile` as the same face as `grin`. Same call as `stone`. Deck
  is now 20 illustrated / 8 word-only; app art 171/210.
- **Pinned cross-category art sharing** (D1) — two new guards: shared `img`
  paths (GUARD C, `decks.test.ts`) and byte-identical files
  (`art-svg-sizing.test.ts`, the 5 grandfathered pairs). A reviewer proved the
  hole live: `jog` → `art/globe.svg` passed validate + unit + build green. The
  `stone` MAP comment was narrowed from "new rule" to the judgment call it is.
- **GUARD B strengthened** (was vacuous) — it pinned the *set* of duplicate
  words and discarded the span, so escalating `whale` to a third category
  passed 101/101. Now pins the full word → categories map. GUARD A extended to
  cover deck-vs-deck title collisions.
- **Picker keeps its scroll position** (D4) — `render()` rebuilt `.decks` every
  time, so returning to the picker reset a ~3-viewport list to the top, with
  Long Vowels last. ~6 lines in `src/main.ts`, pinned by e2e.
- **`bike.svg` black fill fixed** (D3) — two fill-less `<path>`s defaulted to
  `#000000`. The palette gate structurally cannot see a *missing* `fill`, so
  `DESIGN.md`'s "the build fails" claim is false; 16 files on `main` leak the
  same way. Now **TODOS P3.17**.
- **Counts corrected** — "16 new glyphs" was 14 (now 12 after the cuts), in
  three docs. CHANGELOG's "the build now fails if a ninth shows up" was false:
  only `npm test` catches it, and there is no PR-triggered CI.
- **Doc drift swept** — stale 3-category enumerations in `styles.css`,
  `categories.ts`, `types.ts`, `ARCHITECTURE.md`, `docs-sync.test.ts`, e2e test
  names; `README`'s "add a category = categories.ts only" corrected (this
  branch disproved it); `add-deck` SKILL.md gained a new-category step and the
  `graphemes` carve-out; `package-lock.json` synced 1.4.0 → 1.7.0.

Both strengthened guards and the new e2e were verified **red** against real
mutations before being accepted green.

## Open — needs James

1. **The `graphemes` inconsistency (review H1, conf 9).** The 8 duplicated words
   already carry consonant+e splits in their original decks — `snake` is
   `["sn","a","ke"]` in s-blends, and v1.4 shipped `grape` as `gr·a·pe`
   deliberately. So the same word now has phonics data in one deck and none in
   the other, and nothing catches it: the validator only checks `graphemes` when
   present, and no test asserts coverage. Decision D2 was taken without this fact
   on the table. Three options are written up in `TODOS.md` under the parked
   convention item; **(c) pin 0/28 as intentional with a test** is cheapest,
   **(a) strip graphemes from the 8 originals** is most consistent. Until it is
   settled, do not let a tool fill that field in.
2. **Four figurative art cards to eyeball** — `home`→house glyph, `cone`→soft ice
   cream, `pine`→evergreen, `globe`→Earth. The risk is a child naming the picture
   with a word they already know, which contradicts the read instead of
   confirming it. `mule` (donkey — wrong animal), `stone` (byte-identical to
   `rock`), `cube` (reads as `block`/`box`) and `smile` (reads as `grin`) were
   all cut to word-only for exactly this — the last two in `/review`. These
   four survive because the risk is a *naming* call a real child has to settle,
   not a duplicate-drawing call with an existing precedent. → P5 device checklist.
3. **`rowEl`/`shuffleRowEl` extract is now triggered** — the parked condition was
   "next time either changes", and `shuffleRowEl` changed here.

## Known gap (non-blocking)

The adversarial review ran **Claude-only** — no independent cross-model check.
Codex is disabled on this account (`codex_reviews: disabled`), and `/implement`
has no `codex exec` dispatch wired regardless. Recorded, not a blocker. `/review`
*does* shell out to Codex, so running it next is the first genuine cross-model
coverage this branch will get.
