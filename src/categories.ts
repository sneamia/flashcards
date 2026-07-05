/* =========================================================================
   categories.ts — the category manifest (display title + order).

   Decks carry only a `category` id (in the deck JSON); the human title and
   the picker display order live HERE, once, rather than being repeated on
   every deck file — the 4 digraph decks would otherwise duplicate identical
   strings, the exact drift risk the codebase already guards against for the
   deck `order` field. Pure data, no DOM.

   The `order` field is the PICKER display order of the categories themselves
   (CVC first, then Digraphs, then Blends) — distinct from a deck's `order`,
   which sorts decks WITHIN a category.

   validate-decks.mjs can't import this .ts, so it derives the id set by
   regex-parsing the `id:` literals out of this file at runtime — the two
   stay in sync automatically, no manual step.
   ========================================================================= */

export interface CategoryMeta {
  /** Stable id, matched against each deck's `category`. */
  id: string;
  /** Display title shown as the picker section header. */
  title: string;
  /** Picker display order of the category (ascending). */
  order: number;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'cvc', title: 'CVC', order: 0 },
  { id: 'digraphs', title: 'Digraphs', order: 1 },
  { id: 'blends', title: 'Blends', order: 2 },
];
