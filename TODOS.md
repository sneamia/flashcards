# TODOS

Prioritized backlog, restructured in a triage pass 2026-07-25. Every code
reference below was re-verified against `main` that day. Release history lives
in CHANGELOG.md; the detailed "shipped in vX" notes this file used to carry are
preserved in its git history (see the Shipped history section at the bottom).

Effort: **S** = under an hour, **M** = a focused session, **L** = multi-session.
Path: **direct** = go straight to implementation (TDD, no spec needed);
**plan first** = write a short spec / get a design or product decision before
any code; **decision only** = no code — the deliverable is the call itself.

---

## P1 — Next up (visible in a real session)

### 1. run/jog show the identical picture inside one CVC shuffle run (S)
- **Path: direct.** The only decision — (a) vs (b) below — is a micro-call to
  make in the PR itself; recommend (a).
- **What:** `run` (cvc-u) and `jog` (cvc-o) both map to OpenMoji `1F3C3`
  (`scripts/fetch-art.mjs:170` and `:194`), and both live in the **same
  category**, so a single "shuffle all CVC" session can reveal the same
  drawing for two different words — actively confusing for a child using the
  picture to confirm the read. (Adversarial review, v1.3; still live.)
- **Fix:** decide — (a) drop `jog`'s `img` (the image-free one-beat is the
  honest card), or (b) source/draw visibly distinct art. (a) is a one-line
  deck edit + MAP removal.
- **Note:** the other shared-glyph pairs — hut/shed `1F6D6`, drip/wet `1F4A7`,
  plane/jet `2708`, plate/dish `1F37D` — are all **cross-category**, so they
  can't collide in one shuffle pool. One eyeball pass, then accept.
- **Impact:** pedagogy. **Category:** content/art.

### 2. Offline restore recovery hardening (M; one sub-item needs a device)
- **Path: plan first.** Four sub-items interact (the recovery-signal matrix,
  what an online-but-broken boot should show, whether art leaves the required
  set) and (b) is a real product decision — a half-page spec settling those,
  then (a)+(b)+(d) implement directly with headless e2e.
- The family's real iOS failure mode: cache eviction → restore card → recovery
  depends on fragile signals. From the v1.1 adversarial review; all four
  sub-items re-verified still live in `main.ts` today.
- **(a) Backgrounded reconnect can strand the restore card** (conf 8): recovery
  is a single one-shot `online` listener (`main.ts:925`). Backgrounding the PWA
  to toggle Wi-Fi — the natural fix action — can coalesce/drop that event on a
  thawed page. **Fix:** also re-check on `visibilitychange`→visible +
  `navigator.onLine`.
- **(b) Captive-portal over-trust** (conf 7): boot skips the integrity check
  entirely when `navigator.onLine` (`main.ts:917`), so a
  connected-but-no-internet reconnect reloads into degraded cards with **no**
  guidance — worse than the restore card. **Fix:** run
  `checkPrecacheIntegrity()` even when online, or verify reachability before
  dismissing restore.
- **(c) Reload may not actually re-precache** (INVESTIGATE, needs real iOS):
  Workbox fills the precache on SW *install*; `recoverFromRestore()` is a bare
  `location.reload()` (`main.ts:886`), which with the same activated SW may
  serve evicted entries from network without repopulating — next offline
  launch shows restore again. **Fix:** force `registration.update()` /
  reinstall on recovery; confirm against real iOS eviction (→ device-session
  checklist, P5).
- **(d) Restore over-blocks on art-only eviction:** art has a graceful
  image-free fallback (D2), yet `criticalAssetUrls()` (`main.ts:832`) puts two
  art samples in the *required* set — a single evicted SVG blocks the whole
  app offline. **Consider:** restrict the required set to assets without a
  runtime fallback (built JS/CSS + fonts).
- **Suggested shape:** ship (a)+(b)+(d) with headless e2e coverage as one
  release; fold (c)'s verification into the next device session.
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
  OpenMoji). Coverage today is **152/182 (~84%)**; the reachable image-free
  tail is 17 words: kick, neck, back, tick, pet, peg, bib, hit, top, mud, rug,
  gum, glue, long, hang, fang, gong — potentially lifting coverage to ~93%.
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
  (`validate-decks.mjs:144`).
- **Impact:** feature. **Category:** content + renderer.

### 6. `th` deck ordering decision (S)
- **Path: decision only** (no code until decided; blocked on a child session).
- **What:** decide unvoiced-first vs splitting into two passes — explicitly
  deferred until after one real session (design doc). → child-session
  checklist, P5.
- **Impact:** pedagogy. **Category:** content.

---

## P3 — Robustness quick wins (bundle as one small chore PR)

All small, all verified still-present, **all Path: direct** — acceptance is
unambiguous and each is a contained TDD change. Good rainy-day bundle or
ride-along with the next feature branch.

### 7. render() null-deck recovery leaves dead picker rows (S, direct)
- `render()` on `screen==='card'` with `findDeck()===null` repaints the picker
  but leaves `state.screen==='card'` (`main.ts:468–474`); `startFromRow` guards
  on `screen==='deck_pick'` (`main.ts:257`), so every row would be dead — only
  a long-press EXIT recovers. Provably unreachable today; the defense-in-depth
  is incomplete if a future change reaches it. **Fix:** also reset
  `state = initialState()` in that branch. One line. (Adversarial review, v1.2.)

### 8. Cross-deck duplicate-word guard in validate-decks (S, direct)
- `validate-decks.mjs` checks id/order uniqueness but not card `text` across
  decks; a future duplicate would silently appear twice in that category's
  shuffle pool. All 182 current words verified unique. **Fix:** per-category
  (or global) duplicate-text check. (Adversarial review, v1.4.)

### 9. Anchor the CATEGORY_IDS parse to the CATEGORIES literal (S, direct)
- The regex harvests every `id: '...'` in `src/categories.ts`
  (`validate-decks.mjs:20`), including any future commented-out ones —
  theoretically false-permissive. **Fix:** scope the parse to the `CATEGORIES`
  array literal. (v1.3 review.)

### 10. Name the art-sample cap in criticalAssetUrls (S, direct)
- `urls.size >= 6` magic number (`main.ts:845`) couples the art-sample cap to
  the built/font asset count. **Fix:** derive from a named `ART_SAMPLE_COUNT`.
  (v1.1 review. Note: doing P1.2(d) first may remove art from the required set
  and moot this — sequence after that decision.)

### 11. Resume-by-identity instead of index (parked — accepted risk; direct if unparked)
- `rehydrate()` bounds-checks `cardIndex` but stores no card identity
  (`main.ts:515–537`), so removing a mid-deck card makes a pre-update persisted
  run resume one word off (graceful; worst case falls back to the picker).
  **Fix if ever worth it:** persist card text, re-locate by text on rehydrate.
  Revisit only when a release next removes/reorders mid-deck cards.
  (Red team, v1.4, conf 8 — accepted.)

---

## P4 — Test fidelity (all Path: direct — test-only changes)

### 12. Reveal-sizing e2e asserts the box, not painted ink (S/M, direct)
- The "image (reveal) sizing" e2e reads `getBoundingClientRect()`
  (`flows.spec.ts:440–448`) — CSS-box geometry, independent of whether the SVG
  paints a pixel. A future viewBox/art edit that blanks a drawing would pass
  green. `whip`'s tightened viewBox runs near the ink edge (verified not
  clipped today). **Fix:** add a pixel/visibility assertion (canvas alpha
  sample, or `naturalWidth>0` + rendered-content check — pick whichever proves
  ink in the spike). (v1.5 review.)

### 13. dispatch() unknown-category shuffle null path untested (S, direct)
- `activeShuffleDeck = group ? buildShuffledDeck(...) : null` (`main.ts:560`) —
  the null branch has no test and isn't unit-testable as-is. **Fix:** extract
  the category resolution into a pure helper and unit-test it, or e2e a
  synthetic unknown shuffle id → picker fallback. (Testing review, v1.2, conf 5.)

### 14. v1.1 coverage gaps (S each, direct; still open)
- `gatherPresentUrls` untested branches: `!('caches' in window)` and the
  `caches.match` throw/catch (`main.ts:859–873`).
- `onPointerCancel` release path (iOS pointer-steal) has no e2e (`main.ts:706`).
- `resetPointerTracking()` on `visibilitychange`→hidden has no e2e
  (`main.ts:744–755`).
- Natural ride-alongs: the pointer ones with any gesture work; the caches ones
  with P1.2.

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
