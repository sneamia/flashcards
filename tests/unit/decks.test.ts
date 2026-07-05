/* =========================================================================
   decks.test.ts — deck loader contract: sorted by `order` (sh,ch,th,wh),
   sentence cards stripped, per-deck counts sh=10/ch=9/th=9/wh=4.

   APPROACH (documented per the test brief):
   decks.ts uses `import.meta.glob('/decks/*.json', { eager: true })`, which
   is a Vite build-time transform, not a runtime API. vitest's default
   transform pipeline IS Vite (vite.config.ts's `test` block lives right
   alongside the app config), so importing '../../src/decks' here goes
   through the same glob-import plugin the real app uses — no mocking
   needed. We verify this actually resolves below and, if it does, exercise
   the REAL loadDecks() for the sort-order and per-deck-count assertions
   against the real decks/*.json fixtures.

   However: the real decks/*.json fixtures currently contain ZERO `sentence`
   cards (confirmed by reading all four files), so calling the real
   loadDecks() can't actually exercise the "sentence cards get stripped"
   behavior — there's nothing in the fixtures to strip, and we're told not
   to add fixture files under decks/ (tests/ only). So that behavior is
   tested against the REAL exported renderableCards() from src/decks.ts
   with a synthetic in-memory deck that DOES include sentence cards — a
   regression in the shipped filter fails these tests.
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import type { Deck } from '../../src/types';
import { loadDecks, renderableCards } from '../../src/decks';

describe('loadDecks() against the real decks/*.json fixtures', () => {
  const decks = loadDecks();

  it('resolves import.meta.glob and returns all four decks', () => {
    expect(decks).toHaveLength(4);
  });

  it('is sorted by `order`: sh, ch, th, wh (NOT the alphabetical glob order ch,sh,th,wh)', () => {
    expect(decks.map((d) => d.id)).toEqual(['sh', 'ch', 'th', 'wh']);
    expect(decks.map((d) => d.order)).toEqual([1, 2, 3, 4]);
  });

  it('has the documented per-deck renderable-card counts', () => {
    const counts = Object.fromEntries(decks.map((d) => [d.id, d.cards.length]));
    expect(counts).toEqual({ sh: 10, ch: 9, th: 9, wh: 4 });
  });

  it('every returned card is renderable (no sentence cards survive, even though none exist yet in fixtures)', () => {
    for (const deck of decks) {
      for (const card of deck.cards) {
        expect(card.type).not.toBe('sentence');
      }
    }
  });
});

/* -------------------------------------------------------------------------
   Sentence-card stripping — synthetic fixture against the REAL exported
   renderableCards() (see comment block above for why fixtures can't).
   ------------------------------------------------------------------------- */

function sortByOrder(decks: Deck[]): Deck[] {
  return [...decks].sort((a, b) => a.order - b.order);
}

describe('sentence-card stripping (real renderableCards) + order-sort (synthetic fixture)', () => {
  const synthetic: Deck[] = [
    {
      id: 'wh',
      title: 'wh',
      kind: 'phonics',
      order: 4,
      cards: [
        { type: 'word', text: 'whip' },
        { type: 'sentence', text: 'The whip snapped.' },
      ],
    },
    {
      id: 'sh',
      title: 'sh',
      kind: 'phonics',
      order: 1,
      cards: [
        { type: 'word', text: 'ship' },
        { type: 'word', text: 'shop' },
        { type: 'sentence', text: 'The ship is at the shop.' },
      ],
    },
  ];

  it('strips sentence-type cards, keeping only renderable word cards', () => {
    const transformed = synthetic.map((d) => ({ ...d, cards: renderableCards(d.cards) }));
    const sh = transformed.find((d) => d.id === 'sh');
    expect(sh?.cards).toEqual([
      { type: 'word', text: 'ship' },
      { type: 'word', text: 'shop' },
    ]);
    expect(sh?.cards.some((c) => c.type === 'sentence')).toBe(false);
  });

  it('sorts by `order` (sh before wh) independent of input array order', () => {
    const sorted = sortByOrder(synthetic);
    expect(sorted.map((d) => d.id)).toEqual(['sh', 'wh']);
  });

  it('an all-sentence deck yields zero renderable cards (loadDecks drops such decks)', () => {
    // The runtime guard: a deck authored ahead with only sentence cards must
    // never reach the picker as a tappable "0 words" row that would crash
    // the WORD-beat render. loadDecks() filters decks whose renderable card
    // list is empty; validate-decks.mjs fails the build on them too.
    const allSentence = renderableCards([
      { type: 'sentence', text: 'The fish is on the ship.' },
      { type: 'sentence', text: 'The chick is in the shed.' },
    ]);
    expect(allSentence).toEqual([]);
  });
});
