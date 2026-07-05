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

import type { Card, CategoryGroup, Deck } from './types';
import { CATEGORIES, type CategoryMeta } from './categories';
import { shuffle } from './shuffle';

/** Synthetic-deck id prefix for a per-category "shuffle all" run. Reserved:
 *  validate-decks.mjs rejects any real deck id starting with this. */
export const SHUFFLE_PREFIX = 'shuffle:';

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

/**
 * Group decks under their category, in category display order, with each
 * category's decks sorted by their intra-category `order`. Categories with no
 * decks are dropped so the picker never renders an empty header. Pure — takes
 * the deck list and manifest as arguments so it's unit-testable without glob.
 */
export function groupByCategory(
  decks: Deck[],
  categories: CategoryMeta[] = CATEGORIES,
): CategoryGroup[] {
  return [...categories]
    .sort((a, b) => a.order - b.order)
    .map((cat) => ({
      id: cat.id,
      title: cat.title,
      decks: decks.filter((d) => d.category === cat.id).sort((a, b) => a.order - b.order),
    }))
    .filter((group) => group.decks.length > 0);
}

/**
 * Build a synthetic, single-run deck for a category's "shuffle all" entry:
 * every card from every deck in the group, concatenated and shuffled with the
 * injected `rng`. Each card keeps its own `img`, so mixed one-beat/two-beat
 * behavior carries over untouched. The reducer treats this exactly like a real
 * deck — the only thing marking it synthetic is the `shuffle:` id prefix, which
 * main.ts resolves to the live session deck rather than the loaded set.
 */
export function buildShuffledDeck(group: CategoryGroup, rng: () => number): Deck {
  const pool = group.decks.flatMap((d) => d.cards);
  return {
    id: `${SHUFFLE_PREFIX}${group.id}`,
    title: group.title,
    kind: 'phonics',
    category: group.id,
    order: 0,
    cards: shuffle(pool, rng),
  };
}
