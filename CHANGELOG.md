# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
