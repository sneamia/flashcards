# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
