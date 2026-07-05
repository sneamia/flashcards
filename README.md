# Potty Flashcards

A calm, **parent-operated** phonics teleprompter — not a kids' app. The
parent holds the phone and taps; the child reads aloud and never touches the
screen. That inversion is the whole point: no menus, no mascots, no reward
loops, nothing competing for the child's attention. Just a word, then an
illustration that confirms the read, then the next word.

Built for consonant digraphs (sh, ch, th, wh) on short-vowel words, as a
sequel to plain CVC flashcards.

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
and the Vite production build into `dist/`.

## Refresh art

```
npm run fetch-art
```

Pulls the relevant OpenMoji SVGs, palette-remaps them to the muted warm
illustration palette, and optimizes with SVGO into `public/art/`.

## Adding a deck

Add a new JSON file to `decks/` following the existing schema and run the art
pipeline for any new illustrations. Decks are auto-discovered and sorted by
their `order` field — **no app-logic changes required.** (Per Eng Decision
#11: this is *not* "zero code changes" in general — a new deck still needs an
art-pipeline run and passes through build-time validation — but it never
touches `src/`.)

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
