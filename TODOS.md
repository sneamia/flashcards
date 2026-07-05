# TODOS

## Shipped 2026-07-05 (this pass — uncommitted in working tree, pending review)

- **Offline cache-eviction recovery** — boot integrity check probes critical precached
  assets (built JS/CSS, both Andika woff2, representative art) via the Cache API; if
  incomplete AND offline, shows a calm text-only "reconnect once to restore" `.syscard`
  (precedence over rotate), recovering on the `online` event. Pure decision logic in
  `src/integrity.ts` (unit-tested); shell I/O in `main.ts`. DESIGN.md updated.
- **Icon font fidelity** — `scripts/gen-icons.mjs` now outlines the Andika "a" glyph via
  opentype.js (decompressing the bundled woff2 at gen time), fixing the double-story "a"
  librsvg was substituting. 4 PNGs regenerated; single-story confirmed.
- **Gesture-scoped long-press timer** — replaced the always-on 100ms `setInterval` poll
  with a `pointerdown`-scoped `setTimeout` (fires EXIT at ~820ms, zero idle wakeups);
  `gestures.ts` untouched.
- **Figurative image coverage** — reveal-image coverage raised 41% → **53% (17/32)**:
  added `hush` (shushing face), `wish` (shooting star), `wham` (collision burst),
  `math` (input numbers), all palette-remapped warm via the fetch-art pipeline.

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

### Cross-digraph variety mode (from user request 2026-07-04)
- **What:** A way to see words spanning more than one digraph in a session, for variety once a child already knows the individual digraphs.
- **Design constraint:** Random shuffle across all digraphs is explicitly rejected in the design doc — it removes the one-digraph-at-a-time scaffolding a beginning reader needs, turning every card into a cold decode. The sanctioned shape is the curated cross-digraph **review deck** already tracked below (`chip → ship → shop → chop`): a 5th deck, ordered by design, added alongside the per-digraph decks, never replacing them or randomizing them.
- **Why deferred:** Needs the word ladders authored; only earns its place after a child has the individual digraphs down. Decide after a real session. (Consolidate with the "Mixed 'review' deck" line below when built.)
- **Impact:** Feature. **Category:** content/pedagogy.

### Figurative image coverage — remaining (from user request + /design-review 2026-07-04)
- **Done this pass:** hush, wish, wham, math added (coverage now 17/32, 53%).
- **Rejected as unreliable for a 3–5yo:** `whiz` (dashing-away glyph reads as smoke/cloud alone), `chin`, `shin` (body-part glyphs ambiguous), `thud` (no glyph plausibly evokes a dull impact in isolation). Left image-free by design.
- **Rule (unchanged):** add art only where the image reliably evokes the word for a 3–5yo. Pure function words stay image-free — `much, such, that, this, them, with, when, rich` — the image-free one-beat is the honest card, not a gap to fill.
- **Constraints:** OpenMoji source, palette-remapped muted warm (no blues), CC BY-SA, via the existing `fetch-art` + `validate` pipeline. Realistic ceiling ~60%; further gains need new figurative candidates that pass the rule.
- **Impact:** Feature/polish. **Category:** content/art.

### Picker footer gesture-hint mismatch (from /design-review 2026-07-05, deferred by user)
- **What:** The deck-picker footer shows `two-finger tap: back · hold: exit` (`GESTURE_LINES.slice(1)`), but the picker is the root screen: there's no beat to go "back" to, and a long-press there opens the About overlay, not an "exit".
- **Why deferred:** User call (2026-07-05) — it's a defensible persistent gesture legend, and the "hold" hint does point the parent at the long-press that reveals the full About legend. Leaving as-is.
- **If revisited:** either show the picker's own gesture (`hold: about`, via a new constant so the in-deck legend stays intact) or drop the footer on the picker entirely.
- **Impact:** Polish. **Category:** content/microcopy.

## v1.1 (already in design doc, tracked here for visibility)
- Sentence-finale cards + composed scene illustrations (`sentence` type already schema-valid, warned-and-skipped in v1).
- Mixed "review" deck with cross-digraph word ladders (chip → ship → shop → chop).
- Decision: `th` deck — order unvoiced-first vs split into two passes (decide after one real session).
