# potty-flashcards

## Current state

- **v1.4.0 IN FLIGHT** (branch `v1.4/taxonomy-consistency`, PR being created 2026-07-08, not yet merged): taxonomy fixes — ng/ck titles lowercased, starter decks renamed CVC Mix / Mixed Blends, grapes→grape (magic-e split), two-syllable spider dropped, wh extended with wheel/whale/whisk. 17 decks / 182 words, category pools 70/55/57, art coverage 152/182. New drift-guard tests pin deck titles (`decks.test.ts`), README/DESIGN.md counts (`docs-sync.test.ts`), and the fetch-art MAP (`art-map.test.ts`).
- **Last shipped: v1.3.0** (PR #3, merged 2026-07-07, deployed + verified): 17 decks / 180 words, red-card `KEEP_COLORS` exception, palette + graphemes build gates, SHA-pinned art pipeline. Backlog in `TODOS.md`.
- **Design spec:** `~/.gstack/projects/flashcards/james-none-design-20260704-193000.md` (approved 2026-07-04) + repo `DESIGN.md` (absolute: zero animation/sound/gamification, six-hex warm palette).

## Reference docs

| Doc | What |
|---|---|
| `handoff.md` | Historical record of the v1.3 deck expansion (shipped; do not update) |
| `DESIGN.md` | Visual/interaction rules (Big Ink, palette, no motion) |
| `TODOS.md` | Backlog |
| `CHANGELOG.md` | Release history (Keep a Changelog format) |
| `.claude/skills/add-deck/SKILL.md` | Process for adding/extending decks + art |

## Conventions

- New decks are pure data (`decks/*.json`) — never touch `src/machine.ts` (Eng Decision #11).
- Art pipeline: `scripts/fetch-art.mjs` MAP → `npm run fetch-art` → `public/art/`; hexcodes must be verified at OpenMoji 15.1.0.
- Branches: `v1.X/<kebab-desc>`; verify with `npm run validate`, `npm test`, `npm run test:e2e`, `npm run build`.
