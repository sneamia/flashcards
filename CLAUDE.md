# potty-flashcards

## Current state

- **v1.3.0 SHIPPED** (PR #3, merged 2026-07-07, deployed + verified): 17 decks / 180 words live, art coverage 93/110 (~85%) on the new words, red-card `KEEP_COLORS` exception, palette + graphemes build gates, SHA-pinned art pipeline. No active feature branch; backlog in `TODOS.md`.
- **Design spec:** `~/.gstack/projects/flashcards/james-none-design-20260704-193000.md` (approved 2026-07-04) + repo `DESIGN.md` (absolute: zero animation/sound/gamification, six-hex warm palette).

## Reference docs

| Doc | What |
|---|---|
| `handoff.md` | Working state for the v1.3 deck expansion |
| `DESIGN.md` | Visual/interaction rules (Big Ink, palette, no motion) |
| `TODOS.md` | Backlog |
| `.claude/skills/add-deck/SKILL.md` | Process for adding/extending decks + art |

## Conventions

- New decks are pure data (`decks/*.json`) — never touch `src/machine.ts` (Eng Decision #11).
- Art pipeline: `scripts/fetch-art.mjs` MAP → `npm run fetch-art` → `public/art/`; hexcodes must be verified at OpenMoji 15.1.0.
- Branches: `v1.X/<kebab-desc>`; verify with `npm run validate`, `npm test`, `npm run test:e2e`, `npm run build`.
