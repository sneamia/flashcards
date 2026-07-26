# potty-flashcards

## Current state

- **Last shipped: v1.5.0** (PR #6, merged + deployed 2026-07-22): reveal illustrations fill the frame (definite `--art-max-h` + `object-fit:contain`), 7 hand-drawn SVGs made viewBox-only, size-agnostic drift guards (`art-svg-sizing.test.ts` + reveal-sizing e2e). App totals: 17 decks / 182 words, category pools 70/55/57, art coverage 152/182.
- **Earlier releases** (all merged + deployed — see `CHANGELOG.md`): v1.4.0 taxonomy consistency + wh extension (PR #5, 2026-07-09), v1.3.0 deck expansion (PR #3, 2026-07-07).
- **Active branch:** `v1.6/backlog-quick-wins` — autonomous sweep of the direct-path TODOS items, **COMPLETE and awaiting `/ship`**: all three waves landed (P1.1 jog art drop → coverage 151/182, P3.7–P3.10, P4.12–14, P1.2(a)), full gate green (validate / 98 unit / 33 e2e / build), adversarial review + 4 review specialists + red team done and their findings fixed or backlogged (new P3.15/P3.16). **Full state: `handoff.md`.**
- **Backlog:** `TODOS.md` triaged 2026-07-25 (PR #7) into a prioritized backlog (P1–P5 + ideas/parked/proposed-drops); every actionable item carries a **Path** label — `direct` (straight to TDD implementation) or `plan first` (short spec / design decision before code). The direct-path items are now exhausted — **everything remaining is `plan first` / `decision only` / waiting on a real device or child session**, so the next PR needs James's input before code (leading candidate: the P1.2(b)+(d) offline spec, whose priority v1.6 raised).
- **Design spec:** `~/.gstack/projects/flashcards/james-none-design-20260704-193000.md` (approved 2026-07-04) + repo `DESIGN.md` (absolute: zero animation/sound/gamification, six-hex warm palette).

## Reference docs

| Doc | What |
|---|---|
| `handoff.md` | LIVE handoff for the in-flight v1.6 backlog sweep (the old v1.3 historical record it replaced is preserved at git `2985084:handoff.md`) |
| `DESIGN.md` | Visual/interaction rules (Big Ink, palette, no motion) |
| `TODOS.md` | Prioritized backlog (P1–P5; Path labels: direct / plan first) |
| `CHANGELOG.md` | Release history (Keep a Changelog format) |
| `.claude/skills/add-deck/SKILL.md` | Process for adding/extending decks + art |

## Conventions

- New decks are pure data (`decks/*.json`) — never touch `src/machine.ts` (Eng Decision #11).
- Art pipeline: `scripts/fetch-art.mjs` MAP → `npm run fetch-art` → `public/art/`; hexcodes must be verified at OpenMoji 15.1.0.
- Branches: `v1.X/<kebab-desc>`; verify with `npm run validate`, `npm test`, `npm run test:e2e`, `npm run build`.
