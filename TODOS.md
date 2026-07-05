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

## v1.1 (already in design doc, tracked here for visibility)
- Sentence-finale cards + composed scene illustrations (`sentence` type already schema-valid, warned-and-skipped in v1).
- Mixed "review" deck with cross-digraph word ladders (chip → ship → shop → chop).
- Decision: `th` deck — order unvoiced-first vs split into two passes (decide after one real session).
