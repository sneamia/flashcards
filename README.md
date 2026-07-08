# Potty Flashcards

A calm, **parent-operated** phonics teleprompter — not a kids' app. The
parent holds the phone and taps; the child reads aloud and never touches the
screen. That inversion is the whole point: no menus, no mascots, no reward
loops, nothing competing for the child's attention. Just a word, then an
illustration that confirms the read, then the next word.

Three phonics categories, shown grouped in the deck picker:

- **CVC** — a starter deck of short-vowel three-letter words (cat, hen, pig,
  dog, bus…) plus one deck per short vowel (Short A/E/I/O/U): six decks, 70 words.
- **Digraphs** — sh, ch, th, wh, ng, ck, one deck each, in that order: six
  decks, 52 words.
- **Blends** — a starter deck of initial/final consonant blends (flag, frog,
  star, nest…) plus L-Blends, R-Blends, S-Blends, and Ending Blends: five
  decks, 58 words.

Each category also offers an optional **"shuffle all"** entry that mixes every
card in the category into a random order for review. The authored per-deck order
is the default and stays the primary path — shuffle is an extra, opt-in row, and
a shuffle run is deliberately not resumable across a relaunch.

Words are chosen for high illustration coverage (>75%); where a plain glyph
won't read, the art is figurative — e.g. `chin` is a face with an arrow to the
chin, `shin` a leg with an arrow to the shin. American English throughout
(`chip` is a potato chip, not fries).

## Design constraints (non-negotiable)

- **Zero gamification** — no points, streaks, stars, sounds, mascots, celebrations.
- **Zero ambient movement** — no animations, transitions, or spinners. State
  changes are instant swaps.
- **Zero decoration** — nothing on screen that isn't functional.
- **One warm world** — a single cream/ink palette (`#f7f1e3` / `#3d3833`),
  never themed light/dark, no blues.
- **Silent** — no audio; the parent is the pronunciation model.
- **1000ms lockout** after every state transition so rapid tapping can't skip
  cards. Parent-only recovery gestures (two-finger tap = back one beat,
  long-press = exit to the deck picker / about overlay) bypass the lockout —
  the child never performs them.

See `DESIGN.md` for the full design system and `docs/ARCHITECTURE.md` for the
module contract.

## Develop

```
npm install
npm run dev
```

## Test

```
npm test          # vitest — pure logic (state machine, lockout, gestures, deck loader, precache integrity)
npm run test:e2e  # playwright — browser behavior (rapid-tap defense, rotate, resume-after-reload, offline restore)
```

## Build

```
npm run build
```

Runs deck validation and a contrast check (`prebuild`), then `tsc --noEmit`
and the Vite production build into `dist/`. Deck validation also gates the
art: every shipped SVG must stay within the six-hex warm palette (the
`KEEP_COLORS` color-word exception in `scripts/fetch-art.mjs` is the only
sanctioned deviation), and every card's `graphemes` split must join back to
its word.

## Refresh art

```
npm run fetch-art
```

Pulls the relevant OpenMoji SVGs from an immutable, SHA-pinned upstream
commit, palette-remaps them to the muted warm illustration palette
(color-words like `red` keep their meaningful fill via the scoped
`KEEP_COLORS` exception), sanitizes and optimizes with SVGO into
`public/art/`. Any active-content SVG is refused, and the script exits
non-zero if any fetch fails so a scripted caller can't mistake a partial run
for success.

## Adding a deck

Add a new JSON file to `decks/` following the existing schema (include a
`category` of `cvc`, `digraphs`, or `blends`, and an `order` unique within that
category) and run the art pipeline for any new illustrations. Decks are
auto-discovered, grouped under their category, and sorted by `order` — **no
app-logic changes required.** (Per Eng Decision #11: this is *not* "zero code
changes" in general — a new deck still needs an art-pipeline run and passes
through build-time validation — but it never touches `src/`.) To add a *new
category*, add it to `src/categories.ts` only — `scripts/validate-decks.mjs`
derives the valid category id set from that file at build time, so the two can't
drift.

## Deploy

Push to `main`. A GitHub Actions workflow (`.github/workflows/deploy.yml`)
builds the app and deploys `dist/` to GitHub Pages at `/flashcards/`. The
service worker never force-activates mid-session: a newly deployed version
installs and waits, activating on the next app launch.

## Install on iOS (the ritual)

1. Open the deployed URL in Safari.
2. Share → **Add to Home Screen**.
3. **Launch the installed app once while online** and let it sit for about
   30 seconds so the service worker finishes precaching fonts, art, and deck
   data.
4. Turn on airplane mode and relaunch from the home screen icon to confirm it
   works fully offline.

After that, no network is needed for normal use. (iOS can evict its cache
under storage pressure — if that ever happens, one more online launch
restores it.)

## Credits

- **Andika** font, [SIL Open Font License](public/fonts/OFL.txt).
- Illustrations derived from **OpenMoji** ([CC BY-SA 4.0](public/art/LICENSE)), colors modified.

## License

App code is [MIT](LICENSE). Fonts and illustrations carry their own licenses
(above) and are not covered by the MIT grant.
