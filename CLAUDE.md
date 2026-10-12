# potty-flashcards

## Current state

- **In flight: v1.8.0** on branch `v1.8/vowel-teams-mulberry-art` — see `handoff.md` for review/PR status. Adds five **vowel-team decks** (`ai`, `ee`, `igh`, `oa`, `ea`) to the Long Vowels category (now 6 decks / 75 words) and **Mulberry Symbols** as a SHA-pinned second art source (`MULBERRY` table in `scripts/fetch-art.mjs`: 7 formerly image-free words + 14 vowel-team words), plus nine hand-drawn pictures (gate, rug, top, tube, whisk, gong, peg, hit, tail). App totals: **23 decks / 257 cards / 249 distinct words**, pools 70/55/57/75, **art 223/257 (87%)**, 215 art SVGs, 178 MAP + 21 MULBERRY entries, **107 unit / 37 e2e**. All four gates green. Deliberate: Magic E still carries **no `graphemes` key**; the five vowel-team decks DO, with the team as one chunk (both pinned in `tests/unit/decks.test.ts`). The plain single-deck `shuffle` label branch is dormant again (no single-deck category ships).
- **Last shipped: v1.7.0** (PR #11, merged + deployed 2026-08-02): the **Long Vowels** category (id `magic-e`, title differs from the id on purpose) with the 28-card **Magic E** deck; 8 cross-category duplicate words (allowlist-guarded); first single-deck category; guards for deck-vs-category title collisions and accidental cross-category duplicates. 18 decks / 210 cards / art 171 (81%), 105 unit / 36 e2e.
- **Earlier releases** (all merged + deployed — see `CHANGELOG.md`): v1.6.0 backlog sweep (PR #9, 2026-07-26), v1.5.0 reveal-art sizing (PR #6, 2026-07-22), v1.4.0 taxonomy consistency + wh extension (PR #5, 2026-07-09), v1.3.0 deck expansion (PR #3, 2026-07-07).
- **Active branch:** `v1.8/vowel-teams-mulberry-art`. The v1.7 handoff it replaced lives at git `6090513:handoff.md`; v1.6 at `1783040:handoff.md`; v1.3 at `2985084:handoff.md`.
- **Backlog:** `TODOS.md` triaged 2026-07-25 (PR #7) into a prioritized backlog (P1–P5 + ideas/parked/proposed-drops); every actionable item carries a **Path** label — `direct` (straight to TDD implementation) or `plan first` (short spec / design decision before code). The direct-path items are now exhausted — **everything remaining is `plan first` / `decision only` / waiting on a real device or child session**, so the next PR needs James's input before code (leading candidates: the P1.2(b)+(d) offline spec, or the Other Vowels / Bossy R categories researched in v1.8's TODOS ideas).
- **Design spec:** `~/.gstack/projects/flashcards/james-none-design-20260704-193000.md` (approved 2026-07-04) + repo `DESIGN.md` (absolute: zero animation/sound/gamification, six-hex warm palette).

## Reference docs

| Doc | What |
|---|---|
| `handoff.md` | LIVE handoff for the in-flight v1.8 vowel-teams + Mulberry release (predecessors: v1.7 at git `6090513:handoff.md`, v1.6 at `1783040:handoff.md`) |
| `DESIGN.md` | Visual/interaction rules (Big Ink, palette, no motion) |
| `TODOS.md` | Prioritized backlog (P1–P5; Path labels: direct / plan first) |
| `CHANGELOG.md` | Release history (Keep a Changelog format) |
| `.claude/skills/add-deck/SKILL.md` | Process for adding/extending decks + art |

## Conventions

- New decks are pure data (`decks/*.json`) — never touch `src/machine.ts` (Eng Decision #11).
- Art pipeline: `scripts/fetch-art.mjs` MAP (OpenMoji, hexcodes verified at 15.1.0 = `005bf5b`) or MULBERRY (Mulberry Symbols file names, verified at `9cbab9f`) → `npm run fetch-art -- <words>` (never with no arguments) → `public/art/`; hand-drawn SVGs are listed in the placeholders comment, never in a table.
- Branches: `v1.X/<kebab-desc>`; verify with `npm run validate`, `npm test`, `npm run test:e2e`, `npm run build`.
