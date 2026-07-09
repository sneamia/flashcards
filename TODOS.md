# TODOS

## Shipped in v1.4.0 (2026-07-08) — taxonomy consistency + wh extension

- **Deck retitles** — ng/ck lowercased to match sh/ch/th/wh; starter decks renamed
  CVC Mix / Mixed Blends so they no longer echo their category headers. All 17
  titles now pinned by a unit test.
- **Word taxonomy fixes** — grapes→grape (singular, magic-e split gr·a·pe);
  two-syllable spider dropped from S-Blends; wh extended with wheel/whale/whisk
  (whisk image-free by design). 182 words total; pools 70/55/57.
- **Docs-drift guards** — new `docs-sync.test.ts` pins README + DESIGN.md counts
  to the real decks; new `art-map.test.ts` pins the fetch-art MAP against deck
  img references (the stale spider/grapes entries prompted it).

## Deferred from v1.4.0 ship review (2026-07-08)

### Cross-deck duplicate-word guard in validate-decks (adversarial review, INVESTIGATE)
- **What:** validate-decks.mjs checks id/order uniqueness but not card `text`
  across decks; a future duplicate word would silently appear twice in that
  category's shuffle-all pool. All 182 current words verified unique.
- **Fix:** add a per-category (or global) duplicate-text check to
  validate-decks.mjs. **Impact:** data quality. **Category:** tooling.

### Resume-by-identity instead of index (red team, conf 8 — accepted for now)
- **What:** rehydrate() bounds-checks `cardIndex` but has no card-identity check,
  so removing a mid-deck card (spider, this release) makes a pre-update persisted
  run resume one word off (graceful, no crash; index 9 falls back to picker).
- **Fix (if ever worth it):** persist card text alongside cardIndex and re-locate
  by text on rehydrate, falling back to the picker on miss. **Impact:** edge-case
  resume fidelity. **Category:** state machine.

## Shipped in v1.3.0 (2026-07-07) — deck expansion + art-coverage swaps

- **11 new decks** (17 total, 180 words) — five short-vowel CVC decks, NG/CK digraphs,
  four blend-family decks; category shuffle pools now 70 (CVC) / 52 (Digraphs) / 58 (Blends).
- **Art coverage 93/110 (~85%)** on the new words via 25 approved icon-first swaps +
  trap/jam catalog finds; the `red` card keeps a true-red fill via the `KEEP_COLORS`
  exception (fill-only; outline stays ink; recorded in DESIGN.md).
- **Pipeline hardening** — OpenMoji pinned at a commit SHA (was a movable tag),
  post-SVGO active-content denylist, fetch timeout + non-zero exit on failure;
  validate-decks.mjs gained a six-hex palette gate on all shipped art and a
  `graphemes.join('') === text` check.

## Deferred from v1.3.0 ship review (2026-07-07)

### Mulberry Symbols as a second art source (pipeline extension)
- **What:** ~3,400 child-focused AAC SVGs, CC BY-SA 4.0 (same license as OpenMoji);
  covers much of the stubborn 17-word image-free tail (glue, bib, kick, mud…).
- **Fix:** name-based second source in `fetch-art.mjs`. **Impact:** coverage.
  **Category:** content/art.

### Eyeball pass on figurative art + shared-glyph pairs
- **What:** shared glyphs render pixel-identical art for different words: hut/shed
  (1F6D6), jog/run (1F3C3), drip/wet (1F4A7), plane/jet (2708), plate/dish (1F37D).
- **Highest priority pair:** run (cvc-u) and jog (cvc-o) are in the SAME category, so
  the CVC shuffle-all can show the identical picture for two different words in one
  session (adversarial review, INVESTIGATE). Decide: drop jog's img or find distinct art.
- **Impact:** pedagogy. **Category:** content/art.

### Split-digraph grapheme convention (only if graphemes ever render)
- **What:** silent-e words (snake, slide, skate, plate, flute, plane) segment as
  consonant+e chunks (`["sn","a","ke"]`); if the UI ever renders graphemes, this
  teaches the wrong vowel sound. A `a_e`-style convention would need design approval.
- **Impact:** forward-compat data quality. **Category:** content/pedagogy.

### validate-decks category-regex anchor (low)
- **What:** `CATEGORY_IDS` harvests every `id: '...'` literal in `src/categories.ts`,
  including any future commented-out ones — theoretically false-permissive.
- **Fix:** anchor the parse to the `CATEGORIES` array literal. **Impact:** robustness.
  **Category:** tooling.

## Shipped in v1.2.0 (2026-07-05) — CVC + Blends + category shuffle

- **CVC + Blends decks** — a 20-word CVC deck (short-a…u) and an 18-word Blends
  deck (L/R/S initial + `-nk`/`-st`/`-nt` finals), both authored for ~100% image
  coverage. Words selected for a clean OpenMoji glyph or a hand-drawn fallback.
- **Categories** — decks now group under CVC / Digraphs / Blends headers in the
  picker. `category` field on each deck JSON + `src/categories.ts` manifest
  (title + display order); `groupByCategory()` in `src/decks.ts` (pure, tested).
  validate-decks.mjs enforces the category and per-category `order` uniqueness.
- **Per-category "shuffle all"** — reverses the earlier blanket no-shuffle stance
  (see the now-updated "Cross-digraph variety mode" note below) but keeps its
  pedagogy: shuffle is an **opt-in** extra row per category, the authored ordered
  decks stay the default, and the digraphs shuffle pools sh/ch/th/wh. Pure
  `shuffle(items, rng)` (`src/shuffle.ts`) + synthetic `shuffle:<cat>` deck built
  in `main.ts` with `Math.random`; machine.ts untouched; runs are non-resumable.
- **Figurative coverage** — `chin` (face + arrow to chin) and `shin` (leg + arrow
  to shin), previously rejected as ambiguous, are now hand-drawn annotated art;
  `shut` (closed door) added; `chip` redrawn as a potato chip (American English,
  was french fries). Overall coverage ~53% → ~83%. DESIGN.md now permits ink-arrow
  annotation art.

## Deferred from v1.2.0 ship review (2026-07-05)

### render() null-deck recovery is incomplete defense-in-depth (adversarial review, INVESTIGATE)
- **What:** `render()` in `main.ts` (~:468), on `screen==='card'` with `findDeck()===null`,
  repaints the picker but leaves `state.screen==='card'`. Since `startFromRow` guards on
  `screen==='deck_pick'`, every picker row is then dead — only an EXIT long-press recovers.
- **Reachability:** provably unreachable today (rehydrate maps null decks to `initialState`;
  the `buildShuffledDeck` null branch can't fire because `startId` always names a real group;
  start actions don't span a macrotask so dispatches can't interleave). This is latent, not a
  live bug — but the defense-in-depth is itself incomplete if any future change reaches it.
- **Fix:** in that branch also reset `state = initialState()` (or dispatch EXIT) rather than
  only re-painting. One line. **Impact:** Robustness. **Category:** state machine.

### dispatch() unknown-category shuffle null path untested (testing specialist, conf 5)
- **What:** `activeShuffleDeck = group ? buildShuffledDeck(...) : null` (main.ts ~:557) — the
  null branch (a `shuffle:<id>` whose category is absent → findDeck→null→picker) has no test.
- **Fix:** extract the category-resolution into a tiny pure helper and unit-test the null
  branch, or add an e2e that routes a synthetic unknown shuffle id and asserts picker fallback.
  Not unit-testable as-is. **Impact:** Coverage. **Category:** testing.

### Picker heading outline starts at h2 (design specialist, conf 6) — a11y
- **What:** `.cat` category headers are `<h2>` but the app has no `<h1>` anywhere (corner label
  and card words are `<div>`s), so the screen-reader heading outline skips level 1.
- **Why deferred:** ties into the already-Held on-device VoiceOver work below — partial a11y
  (one h1) without the full VoiceOver pass would be inconsistent. Do it with that pass.
- **Fix:** add a visually-hidden `<h1>` for the picker (or promote the corner label), keeping
  the `.cat` small-caps styling. **Impact:** a11y. **Category:** accessibility.

### rowEl() / shuffleRowEl() duplication (maintainability specialist, conf 5) — optional
- **What:** the two picker-row builders share an ~8-line button-construction + click-wiring
  skeleton. Kept separate for now (clarity in user-visible rendering code).
- **Fix (if touched again):** extract `makeRow({cls,label,count,aria,startId})`. **Impact:**
  minor DRY. **Category:** maintainability.

## Shipped in v1.1.0 (2026-07-05)

- **Offline cache-eviction recovery** — boot integrity check probes critical precached
  assets (built JS/CSS, both Andika woff2, representative art) via the Cache API; if
  incomplete AND offline, shows a calm text-only "reconnect once to restore" `.syscard`
  (precedence over rotate), recovering on the `online` event. Pure decision logic in
  `src/integrity.ts` (unit-tested); shell I/O in `main.ts`. DESIGN.md updated.
- **Icon font fidelity** — `scripts/gen-icons.mjs` now outlines the Andika "a" glyph via
  opentype.js (decompressing the bundled woff2 at gen time), fixing the double-story "a"
  librsvg was substituting. 4 PNGs regenerated; single-story confirmed.
- **Gesture-scoped long-press timer** — replaced the always-on 100ms `setInterval` poll
  with a `pointerdown`-scoped `setTimeout` (fires EXIT at ~820ms, zero idle wakeups).
  Ship review caught that the removed poll also ran the `STALE_POINTER_MS` lost-pointer
  self-heal; the sweep now runs on the next `handle('down')` / `onPointerDown` instead
  (`gestures.ts` + `main.ts`, regression-tested), keeping the zero-idle-timer win.
- **Figurative image coverage** — reveal-image coverage raised 41% → **53% (17/32)**:
  added `hush` (shushing face), `wish` (shooting star), `wham` (collision burst),
  `math` (input numbers), all palette-remapped warm via the fetch-art pipeline.
- **Ship-review polish** — restore card pre-warms the font (no fallback→Andika flash) and
  its explanation clamps ≥16px in portrait; `releasePointer()` extracted (DRY).

## Deferred from v1.1.0 ship review (2026-07-05)

### Offline restore recovery hardening (adversarial review)
- **Restore may not recover on a backgrounded reconnect** (conf 8): recovery relies on a
  single one-shot `online` event. The natural fix action (background the PWA to toggle
  Wi-Fi) can coalesce/drop that event on a thawed page, stranding the child on the
  restore card until force-quit. **Fix:** also re-check on `visibilitychange`→visible +
  `navigator.onLine`, not just the one-shot `online`.
- **`navigator.onLine` over-trust** (conf 7): a captive-portal / connected-but-no-internet
  reconnect fires `online` → reload → boot sees online → skips the integrity check →
  renders degraded cards with no guidance (worse than the restore card). **Fix:** on
  reload still run `checkPrecacheIntegrity()` even when online, or verify reachability
  before dismissing restore.
- **Reload may not actually re-precache** (INVESTIGATE): Workbox only fills the precache on
  SW *install*; a bare `location.reload()` with the same activated SW serves evicted
  entries from network without repopulating, so the next offline launch shows restore
  again. **Fix:** force `registration.update()` / reinstall on recovery, confirm vs real
  iOS eviction behavior.
- **Restore over-blocks on art-only eviction** (INVESTIGATE): art has a graceful
  image-free fallback (D2), yet a single missing art SVG in the required set blocks the
  whole app offline. **Consider:** drop art from the *required* set so restore fires only
  for assets without a runtime fallback (built JS/CSS + fonts).

### Test-coverage gaps (all in changed code, coverage 83% — above 80% target)
- `gatherPresentUrls` untested branches: `!('caches' in window)` and the `caches.match`
  throw/catch.
- `onPointerCancel` release path (iOS pointer-steal) has no e2e test.
- `resetPointerTracking()` on `visibilitychange`→hidden has no e2e test.

### Minor
- `criticalAssetUrls` `urls.size >= 6` magic number: derive from a named
  `ART_SAMPLE_COUNT` so the art-sample cap is independent of the built/font asset count.

## v1.1

### Screen-reader announcement polish
- **What:** Live-region announcements on beat transitions (WORD→IMAGE→next) plus VoiceOver-tuned focus order, tested on-device.
- **Why:** v1 ships the cheap semantic baseline (labelled deck rows, word-as-text, `aria-hidden` art, accessible tap-stage name), but a VoiceOver user still gets no feedback when a card advances — the beats are silent to them.
- **Pros:** Makes the app usable end-to-end with VoiceOver.
- **Cons:** Real work (live regions + device VoiceOver testing) for an audience currently one known sighted family; announcements must not fight the calm/silent ethos.
- **Context:** From /plan-design-review D5 (2026-07-04). The v1 baseline already covers labelling; this is the expensive remainder.
- **Held (2026-07-05):** acceptance criterion is on-device VoiceOver verification, which can't be met headlessly. Do when a real device session is available.
- **Depends on:** v1 state machine + semantic baseline shipped.

### Type-scale token (from /design-review 2026-07-04, Polish)
- **What:** Font sizes are untokenized — `0.72rem` appears on both `.corner` and `.pfoot .gest`, `.ct` is `0.8rem`, and each card size is its own `clamp()`. A `--step-*` scale would make "same size" relationships enforced rather than coincidental.
- **Why deferred:** Visual output is already coherent and this is a hand-tuned file; adding a type-scale system risks indirection with zero user-visible gain.
- **Recommendation (2026-07-05):** likely skip — low priority, no user-visible gain, real indirection risk.
- **Impact:** Polish. **Category:** typography/consistency.

### Cross-digraph variety mode (from user request 2026-07-04) — PARTLY SHIPPED
- **What:** A way to see words spanning more than one digraph in a session, for variety once a child already knows the individual digraphs.
- **Shipped (2026-07-05):** the **"shuffle all Digraphs"** picker row now pools sh/ch/th/wh into one randomized run — the variety mechanism the user asked for. It's opt-in and sits alongside the ordered per-digraph decks (never replaces or reorders them), so the one-digraph-at-a-time scaffolding is still the default path. The earlier "random shuffle is rejected" constraint is superseded by this opt-in design.
- **Still deferred:** the *curated* cross-digraph **review deck** with authored word ladders (`chip → ship → shop → chop`) — a designed order, distinct from the random shuffle. Needs the ladders authored; earns its place after a child has the individual digraphs down.
- **Impact:** Feature. **Category:** content/pedagogy.

### Figurative image coverage — remaining (from user request + /design-review 2026-07-04)
- **Done (2026-07-05):** `chin` (face + arrow to chin) and `shin` (leg + arrow to shin) — previously rejected as ambiguous — are now hand-drawn **annotated** art, plus `shut` (closed door). `chip` redrawn as a potato chip. New decks (CVC, Blends) authored at ~100% coverage. Overall ~83%.
- **Still image-free by design:** `whiz` (no reliable glyph), `thud` (no glyph evokes a dull impact), `thin`/`chat`, and the pure function/sight words `much, such, that, this, them, with, when, rich`. The image-free one-beat is the honest card, not a gap to fill.
- **Rule (updated):** add art only where the image reliably evokes the word for a 3–5yo — a plain OpenMoji glyph OR, where none reads, a hand-drawn figurative drawing (an ink arrow may point at the named part; see DESIGN.md). Palette-remapped muted warm (no blues), CC BY-SA where OpenMoji-derived, via the `fetch-art` + `validate` pipeline. Figurative annotation lifts the old ~60% ceiling.
- **Impact:** Feature/polish. **Category:** content/art.

### Picker footer gesture-hint mismatch — FIXED by /design-review on v1.2/cvc-blends-category-shuffle, 2026-07-05
- **What:** The deck-picker footer showed `two-finger tap: back · hold: exit` (`GESTURE_LINES.slice(1)`), but the picker is the root screen: there's no beat to go "back" to, and a long-press there opens the About overlay, not an "exit".
- **Resolution:** Footer now reads `hold for about` (commit 87f7a8a) — the picker's one non-obvious gesture. The in-deck legend (`GESTURE_LINES`) still renders in full on the about overlay; the footer no longer derives from it. DESIGN.md updated to match.
- **Impact:** Polish. **Category:** content/microcopy.

## v1.1 (already in design doc, tracked here for visibility)
- Sentence-finale cards + composed scene illustrations (`sentence` type already schema-valid, warned-and-skipped in v1).
- Mixed "review" deck with cross-digraph word ladders (chip → ship → shop → chop).
- Decision: `th` deck — order unvoiced-first vs split into two passes (decide after one real session).
