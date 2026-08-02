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
  OpenMoji). Coverage today is **171/210 (~81%)**; the reachable image-free
  tail is 26 words: kick, neck, back, tick, pet, peg, bib, hit, top, mud, rug,
  gum, glue, long, hang, fang, gong, **jog**, plus v1.7's **cape, tape, gate,
  tube, mule, stone, cube, smile** — potentially lifting coverage to ~93%.
  `jog` joined the tail in v1.6 (ex-P1.1 dropped its OpenMoji art for colliding
  with `run`'s inside the CVC shuffle pool); four v1.7 words joined for the same
  cross-category-collision reason — `stone` (byte-identical to `rock`'s),
  `cube` (reads as `block`/`box`) and `smile` (reads as `grin`), all three cut
  in review — and `mule` because OpenMoji's only candidate is a donkey. A
  *visibly distinct* Mulberry drawing is exactly what would earn all five back;
  `mule`, `stone` and `cube` are the strongest candidates in the tail.
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

### 17. The palette gate can't see a MISSING `fill` — 16 files ship pure black (S/M)
- **Path: direct** for the gate change; the 16-file art sweep it uncovers is
  mechanical but wants one eyeball pass.
- **What:** `DESIGN.md` states "The build fails if any shipped art SVG strays
  from these six hexes." It does not. The gate (`scripts/validate-decks.mjs`,
  the `offPalette` loop) regex-scans hex literals **present in the file**, so a
  paint-bearing element that simply omits `fill` — inheriting the SVG default
  `#000000` — is structurally invisible to it. `npm run validate` reports
  PASSED while the file renders pure black next to the warm `#a6785a` clay,
  against DESIGN.md's "one warm world" non-negotiable.
- **Evidence:** found in v1.7 review on `public/art/bike.svg` (two fill-less
  `<path>`s as direct children of `<svg>` — the wheel tires, ~2,974 pure-black
  pixels rasterized at 288×288) and `public/art/smile.svg` (the eyes, ~796px).
  bike was fixed in review by adding `fill="#3d3833"`; smile was cut for an
  unrelated reason. **16 files already on `main` leak the same way** — cop
  (~6,038px), hot (~1,280px), train, hush, melt, grin, sick, zip and others.
  Note a fill-less `<path>` INSIDE a `<g fill="…">` is fine and common (see
  `cake.svg`) — only elements with no fill-bearing ancestor default to black.
- **Fix:** extend the loop to flag `path|circle|rect|ellipse|polygon|polyline`
  elements carrying no `fill` and having no fill-bearing ancestor `<g>`. The
  more robust version rasterizes each SVG and asserts every opaque pixel is in
  `PALETTE ∪ {--cream} ∪ KEEP_COLORS`. Either way the gate immediately reds on
  the 16 pre-existing files, so land the sweep with it.
- **Impact:** makes a documented build guarantee true. **Category:** design/tooling.
  (v1.7 review, design specialist, conf 10 — verified by reading both files.)

### 18. Picker scroll position is lost across a rotate detour on a long list (S/M)
- **Path: plan first** — the honest fix changes what's being remembered (a
  content anchor, not a pixel offset), which is a small design call, not just
  a patch.
- **What:** `render()`'s picker scroll memory (`pickerScrollTop`, added this
  release) is captured by reading `.decks.scrollTop` at the moment the picker
  is torn down. That read is already too late for a rotate detour: flipping
  the viewport to portrait reflows the *still-displayed* `.decks` at the new
  (much taller) `clientHeight` before any JS runs — no `resize`, `matchMedia`
  `change`, or `render()` call happens early enough to observe the pixel
  offset a user actually scrolled to. The browser's own layout pass silently
  re-clamps `scrollTop` to fit the new, smaller scrollable range first, and by
  the time `render()` reads it, the real value is already gone.
- **Evidence:** built and ran an e2e test for exactly this (scroll `.decks` to
  its bottom in landscape, flip to portrait and back, assert the offset
  survives) — it failed. `.decks.scrollHeight`/`clientHeight` measured
  identical (1112/275) before and after the round trip, so it isn't a layout
  drift; the live value read 837 immediately after the manual scroll, but
  335 by the time `render()`'s rotate-transition read it — confirmed via a
  `scroll` listener that the browser dispatches its own corrective `scroll`
  event (`[837, 335]`) as part of the resize, before any app code runs. A
  live-tracking `scroll` listener doesn't fix it either: the corrective event
  looks identical to a real one, so "last scroll wins" just stores 335 too.
  Found while adding coverage for this release's scroll-memory feature — not
  caught by any of the six review passes that ran on this branch (5
  specialists + adversarial), since none of them ran the app under an actual
  rotate-while-scrolled sequence.
- **Not a regression on the shipped flow:** the common case this release's
  scroll memory targets — exit a deck run back to the picker — doesn't touch
  the portrait/rotate path at all and is unaffected; e2e coverage for that
  path (`the picker keeps its scroll position when you exit a deck back to
  it`) still passes.
- **Fix if unparked:** track *which row/category* is at the top of the
  visible area (a content anchor) instead of a raw pixel offset, and re-scroll
  that element into view after any render — orientation-independent by
  construction, unlike a pixel offset which is inherently tied to the
  viewport's clientHeight. A raw-offset patch (e.g. snapshotting on every
  `scroll` event) cannot distinguish a genuine user scroll from the browser's
  own corrective one, so it doesn't converge on a real fix.
- **Impact:** a parent who scrolls deep into the picker and rotates the phone
  (even briefly, e.g. to check something) loses their place same as before
  this release shipped scroll memory — requires a long-enough list plus a
  reflow that changes `.decks`' clientHeight mid-picker, not a new regression
  on the primary flow. **Not just rotation:** the same clientHeight-change
  mechanism is triggered by the browser's own dynamic address-bar
  collapse/expand during scroll in a plain (non-installed) mobile Safari/Chrome
  tab — likely more common in everyday one-handed use than a deliberate
  rotation. Substantially, not fully, mitigated by the app's documented
  "Add to Home Screen" install ritual (standalone PWA mode has no dynamic
  toolbar). Validate any eventual content-anchor fix against both triggers,
  not just rotation in an automated harness where the toolbar doesn't exist.
  (Red team, v1.7, conf 4 on the toolbar-collapse addition.)
  **Category:** UI state / picker.

### 19. CI never runs the e2e suite — deploy is protected by unit tests only (S)
- **Path: direct** — adding a Playwright step to an existing GitHub Actions
  workflow is mechanical; the only judgment call is whether to accept the
  added CI time (browser install + a ~25s run), which doesn't need a design
  pass.
- **What:** `.github/workflows/deploy.yml` runs on push to `main` only (no
  PR-triggered CI at all) and executes exactly two gates: `npm test` (vitest
  unit) and `npm run build` (validate + contrast + tsc + vite build). It never
  runs `npm run test:e2e`. This release's headline feature — the picker
  scroll-memory fix (`pickerScrollTop`/`appendPicker()` in `src/main.ts`) —
  plus the aria-label/label single-source-of-truth pin (`isMulti` in
  `shuffleRowEl`) and the single-deck "shuffle" vs "shuffle all" label branch
  are verified **exclusively** by Playwright tests in `tests/e2e/flows.spec.ts`.
  None of that runs in CI. A future edit that reverts any of these — even one
  that also happens to keep all 105 unit tests green — would merge and deploy
  to production with a fully green pipeline. `CLAUDE.md`'s "verify with `npm
  run validate`, `npm test`, `npm run test:e2e`, `npm run build`" is a
  developer checklist, not an enforced gate; nothing stops a future session
  from skipping the local e2e run.
- **Evidence:** read `.github/workflows/deploy.yml` directly — confirmed no
  Playwright/e2e step exists on any trigger. (Red team, v1.7, conf 9.)
- **Fix:** add a step to `deploy.yml` (`npx playwright install --with-deps` +
  `npm run test:e2e`) before the build/deploy steps, gating deploy on it. If
  the added CI time or flakiness risk isn't wanted, the alternative is
  explicitly documenting in `CLAUDE.md` that e2e is a manual-only gate, so a
  future session doesn't mistake "all four gates green" for CI-enforced
  protection.
- **Impact:** this release's core new behavior has zero automated regression
  protection once merged. **Category:** CI/tooling.

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
- **Long Vowels figurative-art eyeball** (v1.7) — verification only: four cards
  keep art whose glyph a child might name with a *different word they already
  know*. `home` → house glyph (conf 9 it reads "house"), `cone` → soft-ice-cream
  (reads "ice cream"), `pine` → evergreen (reads "tree"), `globe` → Earth (reads
  "earth"/"ball"). `mule` and `stone` were already cut to image-free for the same
  reason. Judge whether these four confirm the read or contradict it; cutting any
  is a one-line `img` removal plus a MAP comment. (v1.7 review H3.)
- **Long Vowels scroll reachability** (v1.7) — the picker is now 4 categories /
  18 decks / 4 shuffle rows, and Long Vowels sits last. The v1.7 review probed
  iPhone-13-landscape in Chromium: the list does scroll (`.decks` 275px tall vs
  ~1112px content) and the last row lands flush at max scroll, but the e2e test
  uses `.tap()`, which auto-scrolls programmatically and so proves nothing about
  a real finger. iOS Safari's `touch-action` intersection differs from
  Chromium's — confirm a thumb can actually reach the bottom row. (v1.7 review
  L6, conf 6.)
- **Wide-reveal eyeball** — verification only, no code planned: `whip`
  (~4.42:1) hits the 82vw width cap, sits ~40vh tall and centered (top edge
  ~18vh vs 6vh for square art). Inherent to a wide subject; judge whether it
  reads as intended. (v1.5 review, design note.)

### Child-session checklist (real reader — decisions only, no code)
- `th` ordering decision (P2.6): unvoiced-first vs two passes.
- Sanity-check the review-deck ladders (P2.4) once drafted.

---

## Ideas (new in the 2026-07-25 triage — unvalidated, need design sign-off)

### ~~Long Vowels / Magic-E as a fourth category~~ — SHIPPED v1.7.0
Delivered as the **Long Vowels** category (id `magic-e`) with one 28-card
**Magic E** deck. Decisions taken: one deck rather than per-vowel; the 8
already-shipped magic-e words duplicated in rather than moved; `graphemes`
omitted; soft-c/g + s=/z/ + `ph` words held back (see the follow-on below).

### Soft C / Soft G / s=/z/ / ph as a follow-on deck (M)
- **Path: plan first** — pedagogy call, then pure data.
- **What:** 9 words researched and art-verified during the v1.7 spec but
  deliberately held back, because each smuggles in a rule the app has never
  taught: `face`, `page`, `race`, `space` (soft c/g), `rice`, `mice` (soft c),
  `nose`, `rose` (s saying /z/), `phone` (`ph`). All 9 have strong direct-match
  OpenMoji glyphs — better art than most of what shipped in Magic E — so the
  only open question is whether they form one deck or split by rule.
- **Impact:** content. **Category:** content/pedagogy.

---

## Conditional / parked

- **Split-digraph grapheme convention** — **PARTLY DECIDED in v1.7, mitigated
  by /ship's own review pass.** Decided: the `a_e` notation is **rejected** — it
  is illegal under `validate-decks.mjs:200`, which requires
  `graphemes.join('') === card.text`, so adopting it means weakening a build
  gate for a field with no runtime consumer (`src/types.ts:16`). The Magic E
  deck therefore ships with **no `graphemes` key at all**, the only deck of 18
  without one.
  **The inconsistency (found by the v1.7 adversarial review, conf 9):** the 8
  words Magic E duplicates already carry the consonant+e split in their original
  decks — `plate ["pl","a","te"]`, `snake ["sn","a","ke"]`, `whale
  ["wh","a","le"]`, and so on; v1.4 shipped `grape` as `gr·a·pe` on purpose. So
  the *same word* now has phonics data in one deck and none in the other. The
  three options were: (a) omit `graphemes` on the 8 originals too, accepting
  that magic-e words carry no split anywhere; (b) add the consonant+e split to
  Magic E, matching the shipped originals and accepting the wrong-vowel-sound
  risk if graphemes ever render; (c) keep the split as-is and add a test
  pinning that Magic E is intentionally at 0/28, so the next `/add-deck` run
  can't "helpfully" fill it in.
  **(c) implemented in /ship's review pass** — `tests/unit/decks.test.ts`
  ("the Magic E deck intentionally carries no graphemes key on any card") now
  pins 0/28, so the omission is test-visible and any future edit that adds a
  `graphemes` key to a magic-e card fails red instead of silently shipping a
  wrong-vowel-sound split. This closes the "nothing catches it" gap but does
  **not** settle the underlying inconsistency (the 8 duplicated words still
  carry a split in their original deck, none in Magic E) — (a) vs (b) is still
  James's call whenever it's revisited; the pinning test just means that
  decision can be made deliberately, on a schedule James picks, instead of
  drifting further by accident in the meantime.
- **rowEl()/shuffleRowEl() extract** — **TRIGGERED in v1.7, not done.**
  **Path: direct.** The parked condition was "next time either changes";
  `shuffleRowEl` changed in v1.7 (its single-deck label branch went live). The
  two picker row builders still share an ~8-line skeleton; extract
  `makeRow({cls,label,count,aria,startId})`. (v1.2 review, conf 5; re-flagged
  by the v1.7 review.)

---

## Proposed drops (delete on confirmation — flagged 2026-07-25)

- **Type-scale token** (design review 2026-07-04): tokenize font sizes into a
  `--step-*` scale. Already assessed "likely skip" on 2026-07-05 — no
  user-visible gain, real indirection risk in a hand-tuned file. Recommend
  deleting.

---

## Shipped history

One line per release; details in CHANGELOG.md and this file's git history.

- **v1.7.0** (2026-08-01) — **Long Vowels** category (id `magic-e`) with one
  28-card **Magic E** deck; 12 new glyphs (art 171/210); first cross-category
  duplicate words (8, allowlist-guarded); first single-deck category, taking the
  plain-`shuffle` label branch live after 5 releases dormant; `mule`/`stone` art
  cut on review; new guards for deck-vs-category title collision and accidental
  cross-category duplicates (101 unit / 35 e2e).
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
