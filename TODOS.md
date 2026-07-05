# TODOS

## v1.1

### Offline cache-eviction recovery
- **What:** Detect a partial/evicted precache at boot and, if incomplete AND offline, show a calm "reconnect once to restore" card instead of broken assets.
- **Why:** iOS Safari evicts Cache API storage under pressure or after long non-use. The offline guarantee is "strong, not absolute." Today a parent in airplane mode with an evicted cache hits broken images with no explanation.
- **Pros:** Turns a silent broken state into a calm, actionable message; makes the offline story robust.
- **Cons:** Adds a boot-time integrity check (compare cached entries against the Workbox precache manifest) and a new card state to the state machine.
- **Context:** vite-plugin-pwa/Workbox generates a precache manifest with per-asset revision hashes; the check compares live cache contents against it. Deferred because eviction is rare and the existing "relaunch with connectivity restores it" path already recovers it — just without guidance.
- **Depends on:** v1 PWA precache + state machine shipped.

### Screen-reader announcement polish
- **What:** Live-region announcements on beat transitions (WORD→IMAGE→next) plus VoiceOver-tuned focus order, tested on-device.
- **Why:** v1 ships the cheap semantic baseline (labelled deck rows, word-as-text, `aria-hidden` art, accessible tap-stage name), but a VoiceOver user still gets no feedback when a card advances — the beats are silent to them.
- **Pros:** Makes the app usable end-to-end with VoiceOver.
- **Cons:** Real work (live regions + device VoiceOver testing) for an audience currently one known sighted family; announcements must not fight the calm/silent ethos.
- **Context:** From /plan-design-review D5 (2026-07-04). The v1 baseline already covers labelling; this is the expensive remainder.
- **Depends on:** v1 state machine + semantic baseline shipped.

### Icon font fidelity (from /review 2026-07-04)
- **What:** The PWA icons render a double-story "a" — sharp/librsvg ignores the embedded Andika woff2, so the single-story "a" the icon was designed around is missing. Fix: outline the glyph via opentype.js (needs a TTF) in scripts/gen-icons.mjs and regenerate the 4 PNGs.
- **Why deferred:** Icon still reads as calm cream/ink; fix needs extra dev deps and asset regeneration.

### Gesture-scoped long-press timer (from /review 2026-07-04)
- **What:** Replace the always-on 100ms poll setInterval with a setTimeout scoped to pointerdown (EXIT at exactly 800ms, zero idle wakeups).
- **Why deferred:** Battery delta is negligible (wake lock holds the screen on anyway) and the change touches the most delicate input path.

### Type-scale token (from /design-review 2026-07-04, Polish)
- **What:** Font sizes are untokenized — `0.72rem` appears on both `.corner` and `.pfoot .gest`, `.ct` is `0.8rem`, and each card size is its own `clamp()`. A `--step-*` scale would make "same size" relationships enforced rather than coincidental.
- **Why deferred:** Visual output is already coherent and this is a 173-line hand-tuned file; adding a type-scale system risks indirection with zero user-visible gain. Low priority — may not be worth doing.
- **Impact:** Polish. **Category:** typography/consistency.

### Cross-digraph variety mode (from user request 2026-07-04)
- **What:** A way to see words spanning more than one digraph in a session, for variety once a child already knows the individual digraphs.
- **Design constraint:** Random shuffle across all digraphs is explicitly rejected in the design doc — it removes the one-digraph-at-a-time scaffolding a beginning reader needs, turning every card into a cold decode. The sanctioned shape is the curated cross-digraph **review deck** already tracked below (`chip → ship → shop → chop`): a 5th deck, ordered by design, added alongside the per-digraph decks, never replacing them or randomizing them.
- **Why deferred:** Needs the word ladders authored; only earns its place after a child has the individual digraphs down. Decide after a real session.
- **Impact:** Feature. **Category:** content/pedagogy. (Consolidate with the "Mixed 'review' deck" line below when built.)

### Figurative image coverage (from user request + /design-review 2026-07-04)
- **What:** Raise reveal-image coverage past today's 13/32 cards (41%) by sourcing *figurative* illustrations for concrete-but-not-literal words: `hush` (finger to lips), `wish` (shooting star), `whiz` (speed lines), `wham` (impact burst), `chin`, `shin`, `thud`, `math` (numbers). Realistic ceiling ~60%.
- **Rule:** Add art only where the image reliably evokes the word for a 3–5yo. Leave the pure function words image-free — `much, such, that, this, them, with, when, rich` — the image-free one-beat is the honest, correct card for those, not a gap to fill.
- **Constraints:** OpenMoji source, palette-remapped to muted warm (no blues), CC BY-SA, run through the existing `fetch-art` + `validate` pipeline.
- **Why deferred:** Additive polish; the image-free fallback already renders cleanly. Incremental — no single card blocks a ship.
- **Impact:** Feature/polish. **Category:** content/art.

## v1.1 (already in design doc, tracked here for visibility)
- Sentence-finale cards + composed scene illustrations (`sentence` type already schema-valid, warned-and-skipped in v1).
- Mixed "review" deck with cross-digraph word ladders (chip → ship → shop → chop).
- Decision: `th` deck — order unvoiced-first vs split into two passes (decide after one real session).
