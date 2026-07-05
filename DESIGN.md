# DESIGN.md — Potty Flashcards

Canonical design system. `src/styles.css` implements this; when they disagree,
this file is the intent and `styles.css` is fixed to match. Approved via
/design-consultation + /plan-design-review (2026-07-04).

The product is a **calm, parent-operated phonics teleprompter** — not a kids'
app. Every rule below serves that: parent holds the device, child reads, nothing
competes for the child's attention.

## Non-negotiable constraints

These are hard requirements, not preferences:

- **Zero gamification** — no points, streaks, stars, sounds, mascots, celebrations.
- **Zero ambient movement** — no animations, transitions, spinners, cursors.
  State changes are instant swaps. (`cursor:none`, no CSS transitions anywhere.)
- **Zero decoration** — nothing on screen that isn't functional. Subtraction is
  the default: if an element doesn't earn its pixels, cut it. (This is why the
  rotate card is text-only and has no phone glyph.)
- **One warm world** — warm cream, warm ink, no blues (blue-light reduction).
  The product surface is **not themed** light/dark; it deliberately commits to a
  single warm palette. `theme-color` matches the cream.
- **Silent** — no audio in v1; the parent is the pronunciation model.

## Color tokens

| Token | Value | Use |
|---|---|---|
| `--cream` | `#f7f1e3` | Background, everywhere. Warm, not white. |
| `--ink` | `#3d3833` | All letters, single ink. ~10.3:1 on cream (WCAG AAA). No digraph color-cueing. |
| `--label-readable` | ~`#756b58` (confirm ≥4.5:1 on cream at build) | **Must-read** parent chrome: deck-picker gesture hint, "N words" counts. |
| `--label` | `#a89f8d` | **Ignorable** chrome only: the barely-there card/picker corner label (~1.9:1 — intentional, do not use for anything that must be read). |

Muted flat-art palette (illustrations, palette-remapped from OpenMoji at build):
low-saturation warm tones only. Examples in use: clay `#a6785a`, sand `#c9b48f`,
sail `#e0cba8` / `#cbb287`, mast `#8a6a4a`. No blues, ever.

## Typography

- **Andika** (SIL OFL, bundled), all reading text. Chosen for early literacy:
  single-story a/g, clear b/d, generous letterspacing. **Never squeeze the
  letterspacing** — a beginning reader needs letters clearly separated
  (`letter-spacing:0`, Andika's own spacing).
- **Word size is measured, not clamped.** On deck load, JS measures the longest
  renderable word and sets one `--word-size` for the whole deck, so cards never
  jump size within a deck. `clamp()` is only the pre-JS fallback.
- **Reveal word** is deliberately much smaller than the WORD-beat word (the
  hierarchy inverts on reveal: illustration dominant, word small, bottom-right).
- **End card** "the end" is rendered *smaller* than a flashcard word (~60px) so
  it reads as a close, not a word to decode.

## Screens

| Screen | Layout |
|---|---|
| **WORD beat** | Word centered, dominant, at `--word-size`. Whole screen is one tap target. Corner label top-left (`--label`). |
| **IMAGE reveal** | Illustration large & centered up top; word small bottom-right (`--reveal-word-size`). Confirms the read. |
| **Image-free / one-beat** | Word only (function words + any card whose art failed to load — see fallback below). One beat, tap → next. |
| **Deck picker** (only screen the parent navigates) | Rows in **pedagogical order** (sh→ch→th→wh), each = digraph in Andika left + `--label-readable` "N words" right; whole row a **≥44px** tap target with hairline dividers. Corner label "flashcards" top-left. Footer: one `--label-readable` gesture-hint line only. |
| **About overlay** | Long-press the deck picker → calm overlay (`.syscard`) with full gesture list + CC BY-SA attribution; tap to dismiss. Keeps legal text off the home screen. |
| **End card** | Centered "the end", `.syscard`, no counter, no celebration. Tap → picker (after lockout). |
| **Rotate card** | Text-only "turn the phone sideways", `.syscard`. Shown in portrait (iOS can't lock PWA orientation). No glyph. |

## Interaction

- **1000ms lockout** after every state transition; taps during lockout are
  silently ignored (no error feedback, nothing moves).
- **Parent gestures bypass the lockout** (the child never performs them):
  two-finger tap = back one beat; long-press (800ms) inside a deck = exit to
  picker; long-press on the picker = about overlay.
- **Image-failure fallback:** if a card's art fails to load/decode, render it as
  the image-free one-beat card for that render — never a broken-image frame.

## Accessibility

- Ink-on-cream body/reading text is AAA. Functional chrome uses
  `--label-readable` (≥4.5:1); only truly ignorable chrome uses `--label`.
- Touch targets ≥44px (deck rows).
- v1 semantic baseline: `<html lang="en">`, deck rows as labelled controls,
  card word exposed as text, decorative art `aria-hidden`, accessible name on the
  tap stage. (Live-region beat announcements are a tracked TODO, not in v1.)

## What this system is NOT

No cards-as-decoration, no icon-in-circle rows, no gradients, no centered-
everything, no emoji, no system-ui as a display face. If a screen starts to look
like a generic app, it has drifted from this doc.
