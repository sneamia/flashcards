# TODOS

Prioritized backlog, restructured in a triage pass 2026-07-25. Every code
reference below was re-verified against `main` that day. Release history lives
in CHANGELOG.md; the detailed "shipped in vX" notes this file used to carry are
preserved in its git history (see the Shipped history section at the bottom).

The v1.6 sweep (2026-07-26) cleared items 1, 7, 8, 9, 10, 12, 13, 14 and
P1.2 sub-item (a). Their numbers are **deliberately not reused** — commit
messages and CHANGELOG entries reference them (`P3.9`, `P4.13`, …), so the
gaps below are traceability, not omissions.

Effort: **S** = under an hour, **M** = a focused session, **L** = multi-session.
Path: **direct** = go straight to implementation (TDD, no spec needed);
**plan first** = write a short spec / get a design or product decision before
any code; **decision only** = no code — the deliverable is the call itself.

---

## P1 — Next up (visible in a real session)

### 2. Offline restore recovery hardening (M; one sub-item needs a device)
- **Path: plan first.** The three remaining sub-items interact (what an
  online-but-broken boot should show, whether art leaves the required set) and
  (b) is a real product decision — a half-page spec settling those, then
  (b)+(d) implement directly with headless e2e.
- The family's real iOS failure mode: cache eviction → restore card → recovery
  depends on fragile signals. From the v1.1 adversarial review.
- **(a) Backgrounded reconnect can strand the restore card** — **SHIPPED
  v1.6.0.** Recovery now re-checks on `visibilitychange`→visible +
  `navigator.onLine` alongside the one-shot `online` listener, plus a single
  re-check right after both listeners attach (connectivity returning during
  boot's own `await`s used to fire `online` with nothing listening yet).
- **(b) Captive-portal over-trust** (conf 7): boot skips the integrity check
  entirely when `navigator.onLine` (`main.ts:933`), so a
  connected-but-no-internet reconnect reloads into degraded cards with **no**
  guidance — worse than the restore card. **Fix:** run
  `checkPrecacheIntegrity()` even when online, or verify reachability before
  dismissing restore. **Note (v1.6):** (a) widened the funnel into this hole —
  recovery now triggers on *every* foreground return while `onLine`, not just
  a one-shot event, so a captive-portal reload is reachable more often. Still
  gated on a real offline boot, and the exposure class is unchanged, but this
  raises (b)'s priority relative to the 2026-07-25 triage.
- **(c) Reload may not actually re-precache** (INVESTIGATE, needs real iOS):
  Workbox fills the precache on SW *install*; `recoverFromRestore()` is a bare
  `location.reload()` (`main.ts:902`), which with the same activated SW may
  serve evicted entries from network without repopulating — next offline
  launch shows restore again. **Fix:** force `registration.update()` /
  reinstall on recovery; confirm against real iOS eviction (→ device-session
  checklist, P5).
- **(d) Restore over-blocks on art-only eviction:** art has a graceful
  image-free fallback (D2), yet `criticalAssetUrls()` (`main.ts:844`) puts two
  art samples in the *required* set — a single evicted SVG blocks the whole
  app offline. **Consider:** restrict the required set to assets without a
  runtime fallback (built JS/CSS + fonts). **Note:** doing this deletes the
  `ART_SAMPLE_COUNT` constant (`main.ts:836`) that shipped ex-P3.10 — expect
  to remove it, not preserve it.
- **Suggested shape:** ship (b)+(d) with headless e2e coverage as one release;
  fold (c)'s verification into the next device session.
- **Impact:** offline reliability. **Category:** PWA/robustness.

### 3. Mulberry Symbols as a second art source (M)
- **Path: plan first.** Needs design sign-off before any pipeline code: a
  second illustration style will sit beside OpenMoji on equal footing (does it
  hold the "one warm world" feel after palette remap?), attribution must
  extend beyond OpenMoji (the About overlay `ATTRIBUTION` constant, README
  credits, `public/art/LICENSE`), and each candidate glyph needs the
  "reliably evokes the word" eyeball. The spec is a curated word→glyph list +
  attribution wording; the pipeline change itself is then direct.
- **What:** ~3,400 child-focused AAC SVGs, CC BY-SA 4.0 (same license as
  OpenMoji). Coverage today is **151/182 (~83%)**; the reachable image-free
  tail is 18 words: kick, neck, back, tick, pet, peg, bib, hit, top, mud, rug,
  gum, glue, long, hang, fang, gong, **jog** — potentially lifting coverage to
  ~93%. `jog` joined the tail in v1.6 (ex-P1.1 dropped its OpenMoji art for
  colliding with `run`'s inside the CVC shuffle pool); a *visibly distinct*
  Mulberry drawing is exactly what would earn it back.
- **Stays image-free by design** (do NOT chase art for these 13): the
  function/sight words much, such, that, this, them, with, when, rich, plus
  whiz, thud, thin, chat, whisk (no glyph reliably reads for a 3–5yo).
- **Fix:** name-based second source in `fetch-art.mjs` (SHA-pinned like
  OpenMoji), same palette remap + SVGO + active-content gates.
- **Impact:** coverage. **Category:** content/art + pipeline.

---

## P2 — Features (design-doc v1.1 remainder)

### 4. Curated cross-digraph review deck (M)
- **Path: plan first.** The ladders ARE the spec — authoring them is content
  design that deserves its own written pass (plus one small design call on
  picker placement). Once authored, shipping is pure data (Eng #11).
- **What:** authored word ladders (`chip → ship → shop → chop`) as a designed
  review deck — the *curated* counterpart to the shipped random "shuffle all".
  Earns its place once a child has the individual digraphs down.
- **Impact:** feature. **Category:** content/pedagogy.

### 5. Sentence-finale cards + composed scene illustrations (L)
- **Path: plan first.** The largest open feature: needs a full design + eng
  pass (sentence renderer, word-size measurement for multi-word lines,
  composed-scene art direction) before any code.
- **What:** `sentence` cards are schema-valid and warned-and-skipped today
  (`validate-decks.mjs:178`).
- **Impact:** feature. **Category:** content + renderer.

### 6. `th` deck ordering decision (S)
- **Path: decision only** (no code until decided; blocked on a child session).
- **What:** decide unvoiced-first vs splitting into two passes — explicitly
  deferred until after one real session (design doc). → child-session
  checklist, P5.
- **Impact:** pedagogy. **Category:** content.

---

## P3 — Robustness quick wins

Items 7–10 shipped in v1.6.0. Two new items came out of v1.6's own review.

### 15. No persistent test harness for `scripts/*.mjs` (S/M)
- **Path: plan first** — it reverses a standing convention ("no unit-test harness
  for .mjs scripts in this repo"), so the approach is a small design call before
  code.
- **What:** `validate-decks.mjs` now carries real logic — the CATEGORIES-literal
  anchor with two-pass comment stripping, the per-category duplicate-word guard,
  and the new per-category duplicate-`img` guard. All three are verified only by
  hand-edited negative fixtures recorded in commit bodies; nothing persists in
  the tree. **The anchor already regressed once inside v1.6** (46a6eaa stripped
  only `//`, missing `/* */`; caught by a human review pass, not a test) — this
  is a demonstrated, not hypothetical, gap. (Testing specialist, v1.6, conf 7.)
- **Why it needs a decision, not just a test:** the obvious cheap move — mirror
  the regex inside a `?raw`-based vitest test — tests the mirror, not the script,
  and is exactly the vacuous-test shape v1.6's review spent its time deleting.
  The honest options are (a) extract the pure parse/guard helpers into an
  importable `scripts/lib/*.mjs` and test those directly, or (b) add a
  node-typed vitest project so a test can drive the real script over a temp
  fixture tree. Both interact with a known pitfall: `tsconfig` includes `tests/`
  and `npm run build` runs `tsc --noEmit` with **no node types**, so a test
  importing `node:fs` passes vitest silently and breaks the build gate *and* the
  Playwright webServer.
- **Impact:** regression safety on the build gate. **Category:** testing/tooling.

### 16. Gesture EXIT is dead for up to 10s after a lost pointer terminator (S)
- **Path: decision only** first — this is pre-existing v1.1 behavior and may be
  an acceptable trade, so the deliverable is the call, then a test either way.
- **What:** during a two-finger BACK, if one finger lifts normally and the other
  is dragged off the screen edge, neither `pointerup` nor `pointercancel` ever
  arrives for it. `recognizer.multi` stays latched AND a live entry remains in
  `downPointerIds`, so the next `pointerdown` takes the `size >= 2` branch
  (`main.ts:687`), sets `sessionBlocked`, and clears the EXIT timer — long-press
  exit cannot fire until `sweepStalePointers` ages the ghost out after
  `STALE_POINTER_MS` (10s, `gestures.ts:38`). A plausible toddler grip, and the
  exact "stuck in a deck with no way out" outcome v1.6's new pointer tests were
  written to rule out — those tests cover the delivered-terminator and
  backgrounded cases, not this one. Self-heals; graceful. (Red team, v1.6,
  conf 6.)
- **Fix if unparked:** either document 10s as intended and add the third e2e
  (pointerdown A + pointerdown B + pointerup A only, then assert EXIT), or drop
  pointers from `downPointerIds` when the recognizer reports no live gesture.
- **Impact:** recoverability mid-session. **Category:** gestures.

### 11. Resume-by-identity instead of index (parked — accepted risk; direct if unparked)
- `rehydrate()` bounds-checks `cardIndex` but stores no card identity
  (`main.ts:521–543`), so removing a mid-deck card makes a pre-update persisted
  run resume one word off (graceful; worst case falls back to the picker).
  **Fix if ever worth it:** persist card text, re-locate by text on rehydrate.
  Revisit only when a release next removes/reorders mid-deck cards.
  (Red team, v1.4, conf 8 — accepted.)

---

## P4 — Test fidelity

Items 12, 13, 14 all shipped in v1.6.0 — the section is empty and kept only so
the numbering above stays legible. One caveat worth carrying forward: the
no-Cache-API restore test guards the *outcome* (offline + no Cache API →
restore card), not that one `if` — deleting the guard makes the `caches.match`
call throw into the catch immediately below it for the same result, so no test
can distinguish them. Documented in `restore.spec.ts`; not a gap to re-open.

---

## P5 — Waiting on the real world (batch each list into one session)

### Device-session checklist (real iPhone, one sitting)
- **VoiceOver pass** (held since 2026-07-05) — **Path: plan first**: the
  announcement copy and politeness semantics (what the live region says on
  WORD→IMAGE→next, and how it stays out of the calm ethos' way) are a design
  decision before code; implementation follows directly, and on-device
  VoiceOver verification is the acceptance gate. Do the **heading-outline
  fix** with it (picker `.cat` headers are `<h2>` with no `<h1>` anywhere —
  add a visually-hidden `<h1>`), not before — partial a11y would be
  inconsistent. (Design review D5 + v1.2 review.)
- **Restore reload behavior** — P1.2(c), investigation (part of the P1.2
  plan): does `location.reload()` re-precache after a real iOS cache
  eviction, or does restore re-fire offline?
- **Wide-reveal eyeball** — verification only, no code planned: `whip`
  (~4.42:1) hits the 82vw width cap, sits ~40vh tall and centered (top edge
  ~18vh vs 6vh for square art). Inherent to a wide subject; judge whether it
  reads as intended. (v1.5 review, design note.)

### Child-session checklist (real reader — decisions only, no code)
- `th` ordering decision (P2.6): unvoiced-first vs two passes.
- Sanity-check the review-deck ladders (P2.4) once drafted.

---

## Ideas (new in the 2026-07-25 triage — unvalidated, need design sign-off)

### Long Vowels / Magic-E as a fourth category
- **Path: plan first** — full spec + pedagogy sign-off; gated on the grapheme
  convention below.
- Magic-e words already ship scattered through the blends decks (grape, snake,
  slide, skate, plate, flute, plane); a dedicated category is the natural
  pedagogy step after blends. Pure data + one `src/categories.ts` entry.

---

## Conditional / parked

- **Split-digraph grapheme convention** (only if graphemes ever render) —
  **plan first if triggered** (needs design approval by its own terms):
  silent-e words segment as consonant+e chunks (`["sn","a","ke"]`); if the UI
  ever renders graphemes this teaches the wrong vowel sound. An `a_e`-style
  convention is the candidate. Also gates the Magic-E category idea above.
- **rowEl()/shuffleRowEl() extract** (only if touched again) — **direct if
  triggered**: the two picker row builders share an ~8-line skeleton; extract
  `makeRow({cls,label,count,aria,startId})` next time either changes. (v1.2
  review, conf 5.)

---

## Proposed drops (delete on confirmation — flagged 2026-07-25)

- **Type-scale token** (design review 2026-07-04): tokenize font sizes into a
  `--step-*` scale. Already assessed "likely skip" on 2026-07-05 — no
  user-visible gain, real indirection risk in a hand-tuned file. Recommend
  deleting.

---

## Shipped history

One line per release; details in CHANGELOG.md and this file's git history.

- **v1.6.0** (2026-07-26) — backlog sweep: `jog`'s colliding art dropped
  (151/182), restore recovery re-checks on `visibilitychange` + post-listener,
  validator per-category duplicate-word + duplicate-`img` + comment-proof
  CATEGORIES guards, `resolveShuffleDeck`
  extracted, painted-ink + pointer-release + caches-branch e2e coverage
  (items 1, 7, 8, 9, 10, 12, 13, 14, P1.2(a)).
- **v1.5.0** (2026-07-22) — reveal art fills the frame (definite height +
  object-fit); 7 SVGs made viewBox-only; sizing drift guards.
- **v1.4.0** (2026-07-08) — taxonomy consistency (ng/ck lowercase, CVC Mix /
  Mixed Blends, grape, spider dropped, wh +3 → 182 words); docs/MAP drift guards.
- **v1.3.0** (2026-07-07) — 11 new decks (17/180), art swaps to ~85% new-word
  coverage, red KEEP_COLORS exception, SHA-pinned art pipeline, palette +
  graphemes build gates.
- **v1.2.0** (2026-07-05) — CVC + Blends decks, category grouping, opt-in
  per-category shuffle, figurative/annotated art (~83% coverage); picker footer
  hint fixed (commit 87f7a8a).
- **v1.1.0** (2026-07-05) — offline cache-eviction restore card, icon font
  fidelity, gesture-scoped long-press timer, figurative coverage to 53%.
