# potty-flashcards

## Current state

- **Last shipped: v1.6.0** (PR #9, merged + deployed 2026-07-26): backlog sweep — `jog`'s colliding art dropped, offline restore recovery re-checks on foreground-return and post-listener, per-category duplicate word/`img` + comment-proof CATEGORIES validator guards, `resolveShuffleDeck` extracted, painted-ink / pointer-release / caches-branch coverage. App totals: 17 decks / 182 words, category pools 70/55/57, **art coverage 151/182** (jog image-free by design), 98 unit / 33 e2e tests. Canary verified live: 200, 0 console errors, 2.42s load.
- **Earlier releases** (all merged + deployed — see `CHANGELOG.md`): v1.5.0 reveal-art sizing (PR #6, 2026-07-22), v1.4.0 taxonomy consistency + wh extension (PR #5, 2026-07-09), v1.3.0 deck expansion (PR #3, 2026-07-07).
- **Active branch:** none — `v1.6/backlog-quick-wins` merged and deleted. The v1.6 record is preserved in `handoff.md` (replace it when the next piece of work starts; the v1.3 predecessor lives at git `2985084:handoff.md`).
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
