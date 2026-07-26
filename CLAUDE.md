# potty-flashcards

## Current state

- **Last shipped: v1.5.0** (PR #6, merged + deployed 2026-07-22): reveal illustrations fill the frame (definite `--art-max-h` + `object-fit:contain`), 7 hand-drawn SVGs made viewBox-only, size-agnostic drift guards (`art-svg-sizing.test.ts` + reveal-sizing e2e). App totals: 17 decks / 182 words, category pools 70/55/57, art coverage 152/182.
- **Earlier releases** (all merged + deployed — see `CHANGELOG.md`): v1.4.0 taxonomy consistency + wh extension (PR #5, 2026-07-09), v1.3.0 deck expansion (PR #3, 2026-07-07).
- **Backlog:** `TODOS.md` triaged 2026-07-25 (PR #7) into a prioritized backlog (P1–P5 + ideas/parked/proposed-drops); every actionable item carries a **Path** label — `direct` (straight to TDD implementation) or `plan first` (short spec / design decision before code). Recommended next PR: run/jog art fix (P1.1) + the P3 quick-wins bundle.
- **Design spec:** `~/.gstack/projects/flashcards/james-none-design-20260704-193000.md` (approved 2026-07-04) + repo `DESIGN.md` (absolute: zero animation/sound/gamification, six-hex warm palette).

## Reference docs

| Doc | What |
|---|---|
| `handoff.md` | Historical record of the v1.3 deck expansion (shipped; do not update) |
| `DESIGN.md` | Visual/interaction rules (Big Ink, palette, no motion) |
| `TODOS.md` | Prioritized backlog (P1–P5; Path labels: direct / plan first) |
| `CHANGELOG.md` | Release history (Keep a Changelog format) |
| `.claude/skills/add-deck/SKILL.md` | Process for adding/extending decks + art |

## Conventions

- New decks are pure data (`decks/*.json`) — never touch `src/machine.ts` (Eng Decision #11).
- Art pipeline: `scripts/fetch-art.mjs` MAP → `npm run fetch-art` → `public/art/`; hexcodes must be verified at OpenMoji 15.1.0.
- Branches: `v1.X/<kebab-desc>`; verify with `npm run validate`, `npm test`, `npm run test:e2e`, `npm run build`.
