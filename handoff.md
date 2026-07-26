# Handoff — v1.6 backlog quick-wins sweep (COMPLETE, shipped as v1.6.0, awaiting merge)

**Branch:** `v1.6/backlog-quick-wins` (base `main` @ `3324acc`, tree clean)
**Date:** 2026-07-26 · **Status:** all three waves landed; full gate green (validate / 98 unit / 33 e2e / build); adversarial review, coverage audit, 4 review specialists and a red team all done, findings fixed or backlogged. Version bumped to 1.6.0. The only thing left is the PR → `/land-and-deploy`.
**Source docs:** `TODOS.md` (updated to match — the shipped items are out of the backlog and in its Shipped history), repo `DESIGN.md`, `CLAUDE.md` conventions.

## What this was

Autonomous execution of the independently-completable TODOS.md items (James's directive: tackle direct-path items via Sonnet subagents, leave anything needing his input). Decomposed into 3 waves of file-disjoint subagents, then a fresh adversarial review on the full diff.

## Scope decisions made (do not re-litigate)

- **Did:** P1.1 (jog art, option (a)), P1.2(a) ONLY, P3.7, P3.8, P3.9, P3.10, P4.12, P4.13, P4.14.
- **Left for James (do NOT start):** P1.2(b)/(d) (product decisions: captive-portal boot behavior, required-set contents), P1.2(c) (needs real iOS device), P1.3 Mulberry (design sign-off gate), P2.4/2.5/2.6 (content design / child session), P3.11 (parked, accepted risk), P5 lists (device/child sessions), Long Vowels idea (pedagogy sign-off), type-scale proposed drop (needs his delete confirmation).

## Done (`git log --oneline main..`)

Waves 1–3 — the backlog items:

| Commit | Item | What |
|---|---|---|
| `deaf3e0` | P1.1 | jog's img dropped (deck edit + MAP removal + `git rm public/art/jog.svg`). Art coverage now **151/182 by design**. |
| `588e7ad` | P3.7 | `state = initialState()` in render()'s null-deck recovery branch (defense-in-depth; branch provably unreachable today). |
| `18f2429` | P3.10 | `ART_SAMPLE_COUNT = 2` named constant; cap derived from pre-loop url count. |
| `d9dca2d` | P3.8 | validate-decks: per-category duplicate-word guard (negative-fixture verified). |
| `46a6eaa` | P3.9 | validate-decks: CATEGORY_IDS parse anchored to the `CATEGORIES` literal (negative-fixture verified). |
| `9c26d00` | P4.13 | `resolveShuffleDeck(groups, startId, rng)` extracted to `src/decks.ts`; unknown-category → null now unit-tested. 94 → 97 unit tests. |
| `0d39e0d` | P4.12 + P4.14 | Painted-ink canvas-alpha guard on the reveal art; e2e for the pointercancel release path and visibilitychange→hidden pointer reset. |
| `b695c77` | P1.2(a) | Restore recovery also re-checks on `visibilitychange`→visible + `navigator.onLine` (a backgrounded PWA can coalesce/drop the `online` event). |
| `08dbcce` | P4.14 | e2e for `gatherPresentUrls`' two untested branches (`!('caches' in window)`, `caches.match` throwing). |

Review follow-ups (from the fresh adversarial pass on `git diff main...HEAD`):

| Commit | Finding | What |
|---|---|---|
| `a2a537a` | F5 | validate-decks also strips `/* … */` from the CATEGORIES block — 46a6eaa stripped only `//`, so a block-commented id still leaked. Red-then-green proven. |
| `5b74f5a` | nit | Stale "~152 files at v1.5" comment in `art-svg-sizing.test.ts` → 151. |
| `134bbb3` | F8 | Restore recovery re-checks once right after attaching both listeners — connectivity returning during boot's own `await`s fired `online` with nothing listening yet. Has a real (non-vacuous) test via a parked-probe caches stub. |
| `1b2b138` | F2 + F4 | **The important one.** The two new pointer tests asserted only that a later tap still ADVANCES — which the recognizer guarantees regardless, so they passed even with main.ts's own `releasePointer`/`resetPointerTracking` calls gated off. They now also assert long-press EXIT still arms (the thing a stale `downPointerIds` entry actually breaks: no way out of a deck for 10s after an iOS pointer-steal). Both mutation-verified red→green. Also ink-guards `whip`, P4.12's motivating card. |
| `559b1a7` | F1 + F6 + F7 | The no-Cache-API test no longer overclaims (deleting that `if` makes the call throw into the catch below for an identical outcome, so no test can distinguish them); restore.spec header corrected; missing `.catch()` on the reload-triggering evaluate. |

Then `/ship` ran its own gates, which found more:

| Commit | Source | What |
|---|---|---|
| `b41a9ba` | coverage audit | The P1.1 fix had **no enforcement** — only a human eyeball pass. Added a per-category shared-glyph invariant test (mutation-verified: `pan`→`map`'s hex trips it, precisely, with no collateral failures). |
| `382a6d7` | coverage audit | The last untested recovery branch: a foreground return while STILL offline must be a no-op *and* must leave recovery armed. Needed a boot counter, a document sentinel, and a bounded settle — the first version of this test passed with the guard deleted because its assertions raced the navigation. |
| `73846f3` | **red team** | The most important finding of the whole branch. `b41a9ba`'s guard keys on the fetch-art MAP, so it is blind to the likelier reintroduction: pointing a card's `img` straight at another word's file. Proven by execution — `jog` → `art/run.svg` left validate PASSING and 98/98 unit tests green. Closed with a `cardImgsByCategory` guard in the validator, which checks the rendered artifact. Both checks are needed; neither subsumes the other. |
| `dfb1f00` | red team | `paintedInkFraction()` rasterized the reveal `<img>` without waiting for `img.complete`; `drawImage` on an incomplete image is a silent no-op, so the failure mode was a false RED. Now gated on `complete`. |

Docs (`3be5724`): `package.json` 1.5.0 → 1.6.0, `CHANGELOG.md` 1.6.0 entry, `TODOS.md`, `CLAUDE.md`, `handoff.md`. Then `/document-release` (`3e491c2`, `5035505`) synced the two docs that commit missed: `docs/ARCHITECTURE.md` (the new `resolveShuffleDeck` export, the three restore-recovery signals, the per-category `text`/`img` rule) and `.claude/skills/add-deck/SKILL.md` (the same rule at the point an author picks art, with each of the two reintroduction paths attributed to the gate that actually catches it — `npm test` for a reused MAP hexcode, `npm run validate` for a reused `img` path).

## Verification (all run on the final tree)

- `npm run validate` → 17 decks, 0 warnings
- `npx vitest run` → **98 passed** (was 94 on `main`)
- `npm run test:e2e` → **33 passed** (was 26 on `main`)
- `npm run build` → green (`tsc --noEmit` + vite, 166 precache entries)

Reviews run: the original adversarial pass, then `/ship`'s coverage audit, four
review specialists (testing / maintainability / **security: no findings** /
performance), and a red team. 13 findings total; 1 critical (fixed), 5 fixed,
2 backlogged as new **P3.15** (no persistent test harness for `scripts/*.mjs` —
the CATEGORIES anchor already regressed once inside this branch) and **P3.16**
(gesture EXIT dead ≤10s after a lost pointer terminator, pre-existing v1.1), and
5 skipped with rationale recorded in the PR body.

**A methodology note worth carrying forward** (logged as a project learning):
`playwright.config.ts` sets `reuseExistingServer: !CI` and its webServer runs
`npm run build && npm run preview`. Mutation-testing a `src/` change therefore
requires an explicit `npm run build` first — otherwise the suite is served a
stale `dist/`, **every mutation appears survivable, and red-then-green evidence
is worthless**. This bit twice during this branch.

Also confirmed by the reviewer, independently: `src/machine.ts` untouched (Eng #11); nothing from the deferred P1.2(b)/(c)/(d) leaked in; DESIGN.md intact (no motion/sound/gamification); the art set is internally consistent (144 MAP entries, 182 word cards, 151 with `img`, 151 files in `public/art/`, zero orphans, zero missing); and **zero same-hexcode collisions remain within any single category** — the five byte-identical art pairs (tub/bath, dish/plate, drip/wet, hut/shed, jet/plane) are all cross-category, so no shuffle pool can show one drawing for two words. That closes P1.1's "one eyeball pass, then accept" note.

## Next

1. `/land-and-deploy` (merge pre-approved per James's standing preference).
2. Post-merge docs sync: update `CLAUDE.md`'s shipped-state line to v1.6.0 (**art coverage 152 → 151/182**) and its active-branch line.

Note on versioning: this repo keeps its version in `package.json` as 3-digit
semver (`1.6.0`) with a Keep-a-Changelog `CHANGELOG.md`. gstack's
`gstack-version-bump` CLI assumes a 4-digit `VERSION` file and reports
`DRIFT_UNEXPECTED` here — that is the scheme mismatch, not real drift
(`baseVersion`/`currentVersion` both read `0.0.0.0` because no `VERSION` file
exists). The bump was done by hand to stay consistent with the repo's own
convention and docs rather than inventing a `VERSION` file to satisfy the tool.

For the PR body, two things worth surfacing to James:
- **P1.2(a) widens the funnel into the deliberately-deferred P1.2(b) hole.** Recovery now triggers on every foreground return while `onLine`, not just a one-shot event, so a captive-portal reload (connected, no internet → degraded cards with no guidance, which TODOS itself calls "worse than the restore card") is reachable more often. Exposure class is unchanged — the existing `online` listener already reached the same code — but it raises P1.2(b)'s priority. Noted in TODOS.md.
- **The direct-path backlog is now exhausted.** Everything left is `plan first` / `decision only` / device-or-child-session. The next PR needs his input first; leading candidate is the P1.2(b)+(d) offline spec.

## Deferred / follow-ups

See "Left for James" above and `TODOS.md` P1.2(b–d), P1.3, P2, P3.11, P5, Ideas, Conditional/parked, Proposed drops. The v1.3 historical handoff this file replaced is preserved at git `2985084:handoff.md`.
