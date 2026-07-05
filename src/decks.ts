/* =========================================================================
   decks.ts — deck loader.

   import.meta.glob eagerly bundles all deck JSON files so the service
   worker precaches them and "new deck = new JSON file" holds. Vite returns
   glob matches ALPHABETICALLY (ch, sh, th, wh) which is NOT the intended
   pedagogical order (sh, ch, th, wh) — so we always sort explicitly by the
   deck's `order` field (Eng Decision #1).

   The v1 loader skips `sentence` cards (rendering ships in v1.1) so the
   corner counter ("3 of 10") counts renderable cards only.
   ========================================================================= */

import type { Card, Deck } from './types';

// Each matched module is typed loosely on purpose: a JSON module eagerly
// imported by Vite normally has a `default` export holding the parsed
// object, but depending on Vite's json.namedExports setting (or a test
// harness mocking import.meta.glob) the deck fields may also/instead sit
// directly on the module object. unwrap() below handles either shape.
type DeckModule = { default: Deck } | Deck;

const modules = import.meta.glob('/decks/*.json', { eager: true }) as Record<string, DeckModule>;

function isWrapped(mod: DeckModule): mod is { default: Deck } {
  return typeof mod === 'object' && mod !== null && 'default' in mod;
}

function unwrap(mod: DeckModule): Deck {
  return isWrapped(mod) ? mod.default : mod;
}

export function renderableCards(cards: Card[]): Card[] {
  return cards.filter((c) => c.type !== 'sentence');
}

export function loadDecks(): Deck[] {
  return Object.values(modules)
    .map(unwrap)
    .map((deck) => ({ ...deck, cards: renderableCards(deck.cards) }))
    // A deck with zero renderable cards (all-sentence, authored ahead for
    // v1.1) must never reach the picker: its "0 words" row would crash the
    // WORD-beat render. validate-decks.mjs fails the build on this too —
    // this filter is the runtime belt to that build-time suspender.
    .filter((deck) => deck.cards.length > 0)
    .sort((a, b) => a.order - b.order);
}
