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
   * The category this deck belongs to, e.g. "cvc" | "digraphs" | "blends".
   * Must match an id in src/categories.ts CATEGORIES. The picker groups decks
   * under their category header and offers a per-category "shuffle all".
   */
  category: string;
  /**
   * Pedagogical sort key WITHIN its category. import.meta.glob returns paths
   * ALPHABETICALLY (ch, sh, th, wh) which is NOT the intended order
   * (sh, ch, th, wh), so order is explicit in data. Unique per category
   * (validated at build); groupByCategory() sorts by it.
   */
  order: number;
  cards: Card[];
}

/** One category's decks, in intra-category order — the grouped picker unit. */
export interface CategoryGroup {
  /** Category id, e.g. "digraphs". */
  id: string;
  /** Display title, e.g. "Digraphs". */
  title: string;
  decks: Deck[];
}
