# ARCHITECTURE — module contract

This is the **shared interface contract** every module must honor. It exists so
independently-built modules compose without drift. If you change a signature
here, you break someone else — don't.

Design intent lives in `/DESIGN.md` and the design doc
(`~/.gstack/projects/flashcards/james-none-design-20260704-193000.md`). This
file is only the *code seams*.

## File map

```
src/
  types.ts       # Deck, Card (DONE — do not edit the exported shapes)
  styles.css     # design tokens + all screen CSS (DONE — extend, don't rewrite)
  machine.ts     # PURE state reducer (no DOM, no timers) — Core-logic agent
  gestures.ts    # PURE pointer-event → Action recognizer — Core-logic agent
  lockout.ts     # PURE timestamp lockout guard — Core-logic agent
  integrity.ts   # PURE precache-completeness check (offline eviction) — Core-logic agent
  decks.ts       # deck loader (import.meta.glob, sort, skip sentence) — Core-logic agent
  main.ts        # DOM wiring: renders screens, owns timers/wakelock/persistence — Core-logic agent
decks/
  sh.json ch.json th.json wh.json   # Deck-data agent
public/
  art/*.svg      # placeholder + pipeline art — Build-scripts agent
  fonts/*.woff2  # Andika — PWA/fonts agent
  icons/*.png    # PWA icons — PWA/fonts agent
scripts/
  fetch-art.mjs        # OpenMoji fetch + palette-remap + SVGO — Build-scripts agent
  validate-decks.mjs   # build-time deck validation — Build-scripts agent
  check-contrast.mjs   # --label-readable >=4.5:1 on cream — Build-scripts agent
  gen-icons.mjs        # one-off PWA icon generator (manual; needs `npm i --no-save sharp opentype.js wawoff2` — outlines the Andika "a" glyph to a path so librsvg can't fall back to a double-story system font)
tests/
  unit/*.test.ts # vitest, pure logic — Tests agent
  e2e/*.spec.ts  # playwright — Tests agent
playwright.config.ts   # e2e config (mobile-landscape profile; hardcodes the /flashcards/ base)
```

## State model (machine.ts) — PURE, the heart of the product

```ts
export type Screen = 'deck_pick' | 'card' | 'end' | 'about';
export type Beat = 'word' | 'image';
export type Action = 'ADVANCE' | 'BACK' | 'EXIT' | 'ABOUT' | 'DISMISS' | { start: string };

export interface AppState {
  screen: Screen;
  deckId: string | null;   // null on deck_pick
  cardIndex: number;       // index into the deck's RENDERABLE cards
  beat: Beat;              // meaningful only when screen === 'card'
  lockUntil: number;       // epoch ms; taps with now < lockUntil are ignored (ADVANCE only)
}

// Context the reducer needs without reaching into the DOM/globals.
export interface Ctx {
  now: number;                       // caller passes Date.now()
  deck: Deck | null;                 // the active deck (renderable cards only), or null
  hasImage: (cardIndex: number) => boolean; // true if that card shows an image beat
                                     // (card.img present AND not a runtime decode-failure)
}

export const LOCKOUT_MS = 1000;

// Pure. Returns the NEXT state. Never mutates `state`. Never reads Date/DOM.
export function reduce(state: AppState, action: Action, ctx: Ctx): AppState;

export function initialState(): AppState; // { screen:'deck_pick', deckId:null, cardIndex:0, beat:'word', lockUntil:0 }
```

### Transition rules (authoritative)

- **ADVANCE respects the lockout**: if `ctx.now < state.lockUntil`, return state unchanged (silent no-op).
- **BACK / EXIT / ABOUT / DISMISS BYPASS the lockout** (parent recovery gestures; the child never performs them).
- Every transition that lands on a *new* card beat / end / picker sets `lockUntil = now + LOCKOUT_MS`.

**`{ start: deckId }`** (deck picked): → `{ screen:'card', deckId, cardIndex:0, beat:'word', lockUntil: now+1000 }`.

**ADVANCE on `card`:**
- beat `word`, `hasImage(cardIndex)` → beat `image`, lock.
- beat `word`, NOT `hasImage` (image-free one-beat) → next card.
- beat `image` → next card.
- "next card": if `cardIndex+1 < deck.cards.length` → `cardIndex+1`, beat `word`, lock; else → `{ screen:'end', beat:'word', lock }`.

**ADVANCE on `end`** → `{ screen:'deck_pick', deckId:null, cardIndex:0, lock }`.

**BACK** (two-finger, bypasses lock):
- `card` beat `image` → beat `word` (same card), lock.
- `card` beat `word`, `cardIndex>0` → previous card; beat = `hasImage(prev) ? 'image' : 'word'`, lock.
- `card` beat `word`, `cardIndex===0` → no-op (unchanged).
- other screens → no-op.

**EXIT** (long-press inside a deck) → `{ screen:'deck_pick', deckId:null, lock }`. No-op if already on picker.

**ABOUT** (long-press on picker) → `{ screen:'about', lock }` (only from `deck_pick`).
**DISMISS** (tap on about) → `{ screen:'deck_pick', lock }`.

> `rotate` is NOT a state here. It's an orientation overlay owned by main.ts:
> when portrait, main renders the rotate card *over* the current state and
> suppresses input; rotating back re-renders the underlying state unchanged
> (success criterion 6). Keeping it out of the reducer keeps resume trivial.

## gestures.ts — PURE pointer recognizer

Recognizes exactly three parent inputs from pointer events and maps to Actions.
No DOM listeners inside — main.ts feeds it events; it's a testable state machine.

```ts
export type GestureEvent =
  | { kind: 'down'; pointerId: number; t: number }
  | { kind: 'up'; pointerId: number; t: number }
  | { kind: 'cancel'; pointerId: number };

export type GestureAction = 'ADVANCE' | 'BACK' | 'EXIT' | null;

export const LONG_PRESS_MS = 800;
export const STALE_POINTER_MS = 10_000; // a pointer whose up/cancel was lost is swept at this age (main.ts mirrors this bookkeeping)

export interface Recognizer {
  handle(e: GestureEvent): GestureAction;   // returns an action when a gesture completes, else null
  poll(now: number): GestureAction;          // main.ts calls on a timer so long-press fires without an 'up'
}
export function createRecognizer(): Recognizer;
```

Rules: single-pointer quick down→up = `ADVANCE`. Two pointers down (within a
small window) then up = `BACK` (one action, not two). A pointer held past
`LONG_PRESS_MS` with no second pointer = `EXIT` (fires from `poll`). These are
the raw gestures; main.ts decides EXIT→ABOUT when on the picker.

## lockout.ts — PURE

```ts
export function isLocked(lockUntil: number, now: number): boolean; // now < lockUntil
```
One timestamp-based guard, DRY — never per-state duplication.

## integrity.ts — PURE precache check

```ts
// True only if every required URL is present. Vacuously true for an empty list.
export function isPrecacheComplete(requiredUrls: string[], presentUrls: Set<string>): boolean;
```
The whole decision, nothing else: given the assets a render can't happen
without and the assets actually found in the Cache API, is the offline
precache whole? No DOM, caches, or `navigator` — main.ts gathers both inputs
(iOS can evict Cache API storage) and renders the restore card off the boolean.

## decks.ts — loader

```ts
import type { Deck } from './types';
// Eagerly bundles /decks/*.json so the SW precaches them and "new deck = new
// JSON file" holds. Sorts by `order`. Strips sentence cards (v1 skip) so the
// corner counter counts renderable cards. Returns renderable decks.
export function loadDecks(): Deck[];
```

## main.ts — the only impure module

Owns: DOM rendering of every screen (into `#stage`, setting `data-state`),
`Date.now()`, the long-press EXIT timer (a `setTimeout` armed per held pointer,
not a periodic poll; self-heals lost pointers by sweeping on the next
interaction), the boot-time precache integrity check (integrity.ts) →
restore card, `navigator.wakeLock` (+ NoSleep fallback +
Auto-Lock note on the about overlay), `document.fonts.ready`-gated first render, `img.decode()`
pre-warm (forward AND reverse) with catch → treat-as-image-free, JS word
measurement → `--word-size`, localStorage persistence `{deckId,cardIndex,beat}`
(rehydrate to that card's WORD beat + fresh lockout; try/catch → picker on
corrupt data), orientation → rotate overlay, and the a11y baseline (labelled
deck rows, word-as-text, `aria-hidden` art, accessible tap-stage name).

`data-state` values on `#stage`: `deck_pick | word | image | end | rotate | restore | about`
(plus `boot`, the pre-first-render shell value in index.html, replaced once
fonts settle — e2e tests key off its disappearance). Like `rotate`, `restore`
is a live boot overlay owned by main.ts, not a machine.ts state; it takes
precedence over `rotate` (evicted art is still broken in landscape).

## Deck JSON shape (Deck-data + Build-scripts + Tests all rely on this)

```json
{ "id": "sh", "title": "sh", "kind": "phonics", "order": 1,
  "cards": [
    { "type": "word", "text": "ship", "graphemes": ["sh","i","p"], "img": "art/ship.svg" },
    { "type": "word", "text": "this", "graphemes": ["th","i","s"] }
  ] }
```
- `order`: sh=1, ch=2, th=3, wh=4.
- A word WITH `img` is a two-beat reveal card; WITHOUT `img` it's a one-beat card.
- `img` paths are relative (`art/xxx.svg`) and MUST resolve to a real file in `public/art/`.
