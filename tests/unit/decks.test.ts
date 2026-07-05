/* =========================================================================
   decks.test.ts — deck loader + category grouping contract.

   APPROACH (documented per the test brief):
   decks.ts uses `import.meta.glob('/decks/*.json', { eager: true })`, which
   is a Vite build-time transform, not a runtime API. vitest's default
   transform pipeline IS Vite (vite.config.ts's `test` block lives right
   alongside the app config), so importing '../../src/decks' here goes
   through the same glob-import plugin the real app uses — no mocking
   needed. We verify this actually resolves below and, if it does, exercise
   the REAL loadDecks()/groupByCategory() against the real decks/*.json.

   Card ORDER is meaningful WITHIN a category, so ordering is asserted through
   groupByCategory() (which sorts per category), not loadDecks() (whose global
   `order` sort is now cosmetic — the same `order` value recurs across
   categories).

   The real decks/*.json fixtures contain ZERO `sentence` cards, so the
   "sentence cards get stripped" behavior is tested against the REAL exported
   renderableCards() with a synthetic in-memory deck that DOES include one.
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import type { CategoryMeta } from '../../src/categories';
import type { Deck } from '../../src/types';
import { buildShuffledDeck, groupByCategory, loadDecks, renderableCards } from '../../src/decks';

describe('loadDecks() against the real decks/*.json fixtures', () => {
  const decks = loadDecks();

  it('resolves import.meta.glob and returns all six decks', () => {
    expect(decks).toHaveLength(6);
    expect(new Set(decks.map((d) => d.id))).toEqual(
      new Set(['cvc', 'sh', 'ch', 'th', 'wh', 'blends']),
    );
  });

  it('has the documented per-deck renderable-card counts', () => {
    const counts = Object.fromEntries(decks.map((d) => [d.id, d.cards.length]));
    expect(counts).toEqual({ cvc: 20, sh: 10, ch: 9, th: 9, wh: 4, blends: 18 });
  });

  it('every returned card is renderable (no sentence cards survive)', () => {
    for (const deck of decks) {
      for (const card of deck.cards) {
        expect(card.type).not.toBe('sentence');
      }
    }
  });

  it('every deck carries a known category', () => {
    for (const deck of decks) {
      expect(['cvc', 'digraphs', 'blends']).toContain(deck.category);
    }
  });
});

describe('groupByCategory() against the real fixtures', () => {
  const groups = groupByCategory(loadDecks());

  it('returns the three categories in display order: CVC, Digraphs, Blends', () => {
    expect(groups.map((g) => g.id)).toEqual(['cvc', 'digraphs', 'blends']);
    expect(groups.map((g) => g.title)).toEqual(['CVC', 'Digraphs', 'Blends']);
  });

  it('orders the digraph decks by their intra-category `order`: sh, ch, th, wh', () => {
    const digraphs = groups.find((g) => g.id === 'digraphs');
    expect(digraphs?.decks.map((d) => d.id)).toEqual(['sh', 'ch', 'th', 'wh']);
  });

  it('puts the single-deck categories on their own', () => {
    expect(groups.find((g) => g.id === 'cvc')?.decks.map((d) => d.id)).toEqual(['cvc']);
    expect(groups.find((g) => g.id === 'blends')?.decks.map((d) => d.id)).toEqual(['blends']);
  });
});

describe('groupByCategory() — pure behavior with synthetic input', () => {
  const cats: CategoryMeta[] = [
    { id: 'beta', title: 'Beta', order: 1 },
    { id: 'alpha', title: 'Alpha', order: 0 },
    { id: 'empty', title: 'Empty', order: 2 },
  ];
  const decks: Deck[] = [
    { id: 'b2', title: 'b2', kind: 'phonics', category: 'beta', order: 2, cards: [{ type: 'word', text: 'x' }] },
    { id: 'b1', title: 'b1', kind: 'phonics', category: 'beta', order: 1, cards: [{ type: 'word', text: 'y' }] },
    { id: 'a1', title: 'a1', kind: 'phonics', category: 'alpha', order: 1, cards: [{ type: 'word', text: 'z' }] },
  ];

  it('sorts categories by their order and decks by intra-category order', () => {
    const groups = groupByCategory(decks, cats);
    expect(groups.map((g) => g.id)).toEqual(['alpha', 'beta']); // 'empty' dropped
    expect(groups.find((g) => g.id === 'beta')?.decks.map((d) => d.id)).toEqual(['b1', 'b2']);
  });

  it('drops categories that have no decks (no empty picker headers)', () => {
    const groups = groupByCategory(decks, cats);
    expect(groups.some((g) => g.id === 'empty')).toBe(false);
  });
});

describe('buildShuffledDeck()', () => {
  const group = {
    id: 'digraphs',
    title: 'Digraphs',
    decks: [
      { id: 'sh', title: 'sh', kind: 'phonics', category: 'digraphs', order: 1, cards: [
        { type: 'word' as const, text: 'ship', img: 'art/ship.svg' },
        { type: 'word' as const, text: 'shin' },
      ] },
      { id: 'ch', title: 'ch', kind: 'phonics', category: 'digraphs', order: 2, cards: [
        { type: 'word' as const, text: 'chip', img: 'art/chip.svg' },
      ] },
    ],
  };

  it('produces a synthetic deck: reserved id, category title, pooled card count', () => {
    const deck = buildShuffledDeck(group, () => 0.5);
    expect(deck.id).toBe('shuffle:digraphs');
    expect(deck.title).toBe('Digraphs');
    expect(deck.category).toBe('digraphs');
    expect(deck.cards).toHaveLength(3); // 2 + 1 pooled across the group's decks
  });

  it('the pooled cards are a permutation of every card in the group (imgs preserved)', () => {
    const deck = buildShuffledDeck(group, () => 0.0);
    expect(deck.cards.map((c) => c.text).sort()).toEqual(['chip', 'shin', 'ship']);
    // a card that had art still has it after pooling/shuffling
    expect(deck.cards.find((c) => c.text === 'ship')?.img).toBe('art/ship.svg');
    expect(deck.cards.find((c) => c.text === 'shin')?.img).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------
   Sentence-card stripping — synthetic fixture against the REAL exported
   renderableCards() (see comment block above for why fixtures can't).
   ------------------------------------------------------------------------- */

describe('sentence-card stripping (real renderableCards)', () => {
  const synthetic: Deck[] = [
    {
      id: 'sh',
      title: 'sh',
      kind: 'phonics',
      category: 'digraphs',
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

  it('an all-sentence deck yields zero renderable cards (loadDecks drops such decks)', () => {
    const allSentence = renderableCards([
      { type: 'sentence', text: 'The fish is on the ship.' },
      { type: 'sentence', text: 'The chick is in the shed.' },
    ]);
    expect(allSentence).toEqual([]);
  });
});
