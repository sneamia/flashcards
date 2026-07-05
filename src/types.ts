/* =========================================================================
   Deck schema (v1, forward-compatible). See DESIGN.md + the design doc.

   `sentence` is schema-valid now but the v1 loader SKIPS sentence cards
   (rendering ships in v1.1) — decks may include them ahead of time without
   breaking. `graphemes` and `kind` are cheap forward-compat and cost nothing.
   ========================================================================= */

export type CardType = 'word' | 'sentence';

export interface Card {
  type: CardType;
  /** The word (or, for `sentence`, the decodable sentence) rendered on the card. */
  text: string;
  /** Phonics structure, e.g. ["sh","i","p"]. Documentation + forward-compat; optional. */
  graphemes?: string[];
  /**
   * Art path relative to the built site root, e.g. "art/ship.svg".
   * ABSENT ⇒ this is a one-beat image-free card (function words, or any word
   * with no suitable art). Present ⇒ two-beat word→image reveal.
   */
  img?: string;
}

export interface Deck {
  /** Stable id, also the deck's display digraph, e.g. "sh". */
  id: string;
  /** Display title, usually same as id ("sh"). */
  title: string;
  /** "phonics" in v1. Future kinds (math, patterns) add values without touching v1 code. */
  kind: string;
  /**
   * Pedagogical sort key. import.meta.glob returns paths ALPHABETICALLY
   * (ch, sh, th, wh) which is NOT the intended order (sh, ch, th, wh), so
   * order is explicit in data. decks.ts sorts by it.
   */
  order: number;
  cards: Card[];
}
