# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-07-22

### Fixed
- Reveal illustrations now fill the card at the intended large size — big and
  up top — on every card. Some drawings (the hand-drawn placeholders, and a few
  of the OpenMoji illustrations) were coming out much too small because each
  file's own declared size was deciding how large it drew; the reveal now sizes
  every illustration to the same target height instead, and wide drawings like
  the whip fill the width rather than shrinking.

### Changed
- Art files are now size-agnostic — each defines only its shape, not a pixel
  size — and tests pin both that invariant and the on-screen reveal size (for a
  normal, a hand-drawn, and a wide illustration) so the "tiny illustration" bug
  can't quietly come back.

## [1.4.0] - 2026-07-08

### Added
- Three new **wh** words — wheel, whale, whisk — bringing the digraphs
  "shuffle all" pool to 55 words (182 words in the app). Wheel and whale come
  illustrated; whisk stays a clean word-only card (no OpenMoji glyph reliably
  reads as "whisk" for a preschooler).

### Changed
- Deck titles now read the way they're taught: the **ng** and **ck** decks are
  lowercase like their sibling sounds (sh, ch, th, wh), and the two starter
  decks are **CVC Mix** and **Mixed Blends** so they no longer echo the
  category headers above them.
- **grapes** became **grape** — singular, with a proper magic-e letter split
  (gr·a·pe) — so every card stays a single, directly decodable word.

### Removed
- **spider** left the S-Blends deck: it was the app's only two-syllable word,
  breaking the one-tap-one-syllable decoding promise. S-Blends now holds 9
  words (blends pool 57).

### Fixed
- The README and design-doc word counts were resynced with the real decks and
  are now pinned by tests so they can't silently drift again; the dev-time
  art-fetch list is likewise test-pinned against the decks (the stale
  spider/grapes entries it had accumulated prompted the guard).

## [1.3.0] - 2026-07-07

### Added
- Eleven new decks (110 new words, 180 total): five **short-vowel CVC** decks
  (Short A/E/I/O/U), **NG** and **CK** digraph decks, and four **blend-family**
  decks (L-Blends, R-Blends, S-Blends, Ending Blends). Every category's
  "shuffle all" row now pools its full family — 70 CVC, 52 digraph, and 58
  blend words.
- Illustrations for 93 of the 110 new words (~85% coverage): 25 words were
  swapped for icon-friendly siblings that fit the same phonics pattern (e.g.
  jump→ant, snap→snake, grab→crown), and two catalog finds added art for
  `trap` and `jam`.
- The **red** card now shows an actually-red square — the first sanctioned
  exception to the warm six-color art palette, scoped to just that card's
  fill (its outline stays in the standard ink).

### Changed
- Art pipeline hardening: illustrations are fetched from an immutable upstream
  commit (not a movable tag), pass an active-content denylist after
  sanitization, and the build now fails if any shipped illustration strays
  from the six-color palette or a card's letter-split doesn't spell its word.

## [1.2.0] - 2026-07-05

### Added
- Two new decks: a **CVC** deck (20 short-vowel words) and a **Blends** deck (18
  initial/final consonant blends), joining the digraphs into three categories.
- The deck picker now groups decks under **category headers** (CVC, Digraphs,
  Blends), each with an optional **"shuffle all"** row that plays every card in
  that category in a random order. The authored per-deck order stays the default;
  a shuffle run is not resumable across a relaunch.
- Figurative illustrations for previously image-free digraph words: `chin` (face
  with an arrow to the chin) and `shin` (leg with an arrow to the shin), plus
  `shut`. New art for every CVC and blends word — overall picture coverage now
  ~83% (CVC and Blends ~100%).

### Changed
- `chip` now shows a potato chip instead of french fries (American English).
- The deck picker scrolls when the grouped list is taller than the screen (it was
  a single centered, non-scrolling surface).

## [1.1.0] - 2026-07-05

### Added
- Offline recovery: if the app's saved-for-offline files get evicted (iOS can
  drop them under memory pressure), an offline relaunch now shows a calm
  "reconnect once to restore" card instead of failing silently. Reconnecting
  once repairs it.
- Four more illustrated cards (hush, wish, wham, math), raising picture coverage
  of the figurative words to 53%.

### Changed
- Long-press-to-exit now arms only while a finger is down, instead of a constant
  background timer — the same gesture, with less battery drain when idle.
- App icons now show the single-story "a" that matches the cards, by outlining
  the real font glyph instead of shaping text at export time.
- The offline and rotate system cards keep their content grouped together
  instead of splitting it across the screen.

### Fixed
- Offline boot no longer misfires the restore card: fonts and illustrations
  saved with a cache-busting suffix are now correctly recognized as present.
- A lost touch-release event (which iOS can drop) no longer strands input — the
  next tap clears the stuck state instead of requiring the app to be closed.
- The restore card's explanation text stays legible in portrait and no longer
  flashes in a fallback font before the real font loads.
