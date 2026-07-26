# Handoff — v1.6 backlog quick-wins sweep (mid-flight)

**Branch:** `v1.6/backlog-quick-wins` (base `main` @ `3324acc`, 5 commits ahead, tree clean at handoff)
**Date:** 2026-07-25 · **Status:** wave 1 of 3 FULLY LANDED and unit-verified; waves 2–3 planned below but NOT dispatched; e2e/build gate not yet run on the branch.
**Source docs:** `TODOS.md` (triaged backlog, the source of truth for every item below), repo `DESIGN.md`, `CLAUDE.md` conventions.

## What this is

Autonomous execution of the independently-completable TODOS.md items (James's directive: tackle direct-path items via Sonnet subagents, leave anything needing his input). Work was decomposed into 3 waves of file-disjoint subagents. This handoff freezes the plan so a fresh session can finish it.

## Scope decisions made (do not re-litigate)

- **Doing:** P1.1 (jog art, option (a) per TODOS recommendation), P1.2(a) ONLY (visibilitychange restore re-check — pure hardening, no product call), P3.7, P3.8, P3.9, P3.10, P4.12, P4.13, P4.14.
- **Left for James (do NOT start):** P1.2(b)/(d) (product decisions: captive-portal boot behavior, required-set contents), P1.2(c) (needs real iOS device), P1.3 Mulberry (design sign-off gate), P2.4/2.5/2.6 (content design / child session), P3.11 (parked, accepted risk), P5 lists (device/child sessions), Long Vowels idea (pedagogy sign-off), type-scale proposed drop (needs his delete confirmation).

## Done (commits on this branch — verify with `git log --oneline main..`)

| Commit | Item | What |
|---|---|---|
| `deaf3e0` | P1.1 | jog's img dropped (deck edit + MAP removal + `git rm public/art/jog.svg`). Art coverage now **151/182 by design**. art-map test red→green sequence verified. |
| `588e7ad` | P3.7 | `state = initialState()` added to render()'s null-deck recovery branch (defense-in-depth; branch provably unreachable today — no new test, rationale in commit body). |
| `18f2429` | P3.10 | `ART_SAMPLE_COUNT = 2` named constant; cap derived from pre-loop url count, decoupled from built/font probe count. |
| `d9dca2d` | P3.8 | validate-decks: per-category duplicate-word guard across `type === 'word'` cards (negative-fixture verified: injected duplicate "chip" → FAIL with pool-collision message). |
| `46a6eaa` | P3.9 | validate-decks: CATEGORY_IDS parse anchored to the `CATEGORIES` array literal, line-comments stripped (negative-fixture verified: commented-out id no longer accepted; zero-ids drift guard still trips). |

## Remaining plan (waves NOT yet dispatched)

Subagent ground rules that applied to wave 1 and must apply again: Sonnet subagents, file-disjoint per wave, shared working tree (never `git add .`; commit with explicit pathspec `git commit -m "..." -- <files>`), TDD, one commit per task, commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, never touch TODOS.md/CLAUDE.md. **Port/build constraint:** playwright e2e builds and serves `dist/` on port 4173 (`playwright.config.ts` webServer) — only ONE agent per wave may run e2e or `npm run build`.

- **Wave 2 (two parallel agents):**
  - **D (P4.12 + P4.14 pointer items; file scope `tests/e2e/flows.spec.ts` only; the only wave-2 agent allowed to run e2e, scoped `npx playwright test tests/e2e/flows.spec.ts`):** (1) reveal-sizing e2e currently asserts only `getBoundingClientRect()` — add a painted-ink assertion (canvas alpha sample of the rendered `.reveal .art`, or equivalent proving nonzero painted pixels; spike both, keep the reliable one). (2) e2e for `onPointerCancel` release path: pointerdown → pointercancel → verify next single tap still advances normally (no stuck session / stale EXIT timer). (3) e2e for `resetPointerTracking()` on visibilitychange→hidden: pointerdown, stub `document.visibilityState` to 'hidden' + dispatch visibilitychange, verify next gesture reads fresh (advances, not misread as multi-touch).
  - **F (P4.13; file scope `src/decks.ts` + `tests/unit/decks.test.ts` + one-line call-site swap in `src/main.ts` dispatch()):** extract the shuffle category-resolution (`SHUFFLE_PREFIX` slice → `groups.find` → `buildShuffledDeck(...) : null`) into a pure exported helper in decks.ts; unit-test the unknown-category → null branch. ORDER EDITS so every intermediate tree state compiles (helper added first, call site swapped second) — agent D's e2e may build mid-wave.
- **Wave 3 (single agent E; P1.2(a) + P4.14 caches items; file scope `src/main.ts` boot/restore section + `tests/e2e/restore.spec.ts`):** in boot()'s restore branch, alongside the one-shot `online` listener, add a `visibilitychange`→visible re-check that calls `recoverFromRestore()` when `navigator.onLine` (backgrounded-PWA Wi-Fi-toggle can coalesce/drop the `online` event). E2E: make restore.spec's stubbed `onLine` getter read its localStorage flag LIVE (currently captured at init) — existing tests keep passing; add (1) restore card recovers on visibilitychange-while-online, (2) `!('caches' in window)` offline boot → restore card, (3) `caches.match` throwing → restore card. May run `npx playwright test tests/e2e/restore.spec.ts`.
- **Then, in order:**
  1. Full gate: `npm run validate` && `npx vitest run` && `npm run test:e2e` && `npm run build`.
  2. Fresh adversarial-review subagent (no implementation memory) on `git diff main...HEAD`; fix findings as small commits.
  3. Update `TODOS.md` (mark items 1, 7, 8, 9, 10, 12, 13, 14 done / P1.2 sub-item (a) done; note coverage 151/182 in P1.3) — **leave it unstaged / commit separately as docs, never bundled into implementation commits**.
  4. `/ship` (bumps version, CHANGELOG, PR) — suggested v1.6.0. Post-merge docs sync updates CLAUDE.md's shipped-state line (art coverage 152→151/182). Then `/land-and-deploy` (merge pre-approved per James's standing preference).

## Verification done

- Baseline before wave 1: `npm run validate` (17 decks, 0 warnings) + `npx vitest run` (94/94) green on `main` @ `3324acc`.
- Per-agent: P1.1 ran validate + full vitest green (151 art files); P3.7/P3.10 ran `tsc --noEmit` + full vitest green after each commit; the P3.8/P3.9 agent finished LAST and ran validate + full vitest (94/94) green with all 5 wave-1 commits landed — so the combined branch is unit/validate green.
- NOT yet run on the branch: `npm run test:e2e`, `npm run build`.

## Next

1. `/clear`, then resume with: **read `handoff.md` and continue the v1.6 backlog sweep** (the `implement` skill picks this file up).
2. Sanity-check `git log --oneline main..` shows the 5 commits above and a clean tree, then dispatch waves 2–3 exactly as specced, gate, adversarial review, ship.

## Deferred / follow-ups

See "Left for James" above and `TODOS.md` P1.2(b–d), P1.3, P2, P5, Ideas, Conditional/parked, Proposed drops. The v1.3 historical handoff this file replaced is preserved at git `2985084:handoff.md`.
