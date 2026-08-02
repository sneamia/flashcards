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
import {
  buildShuffledDeck,
  groupByCategory,
  loadDecks,
  renderableCards,
  resolveShuffleDeck,
} from '../../src/decks';

describe('loadDecks() against the real decks/*.json fixtures', () => {
  const decks = loadDecks();

  it('resolves import.meta.glob and returns all eighteen decks', () => {
    expect(decks).toHaveLength(18);
    expect(new Set(decks.map((d) => d.id))).toEqual(
      new Set([
        'cvc', 'cvc-a', 'cvc-e', 'cvc-i', 'cvc-o', 'cvc-u',
        'sh', 'ch', 'th', 'wh', 'ng', 'ck',
        'blends', 'l-blends', 'r-blends', 's-blends', 'end-blends',
        'magic-e',
      ]),
    );
  });

  it('has the documented per-deck renderable-card counts', () => {
    const counts = Object.fromEntries(decks.map((d) => [d.id, d.cards.length]));
    expect(counts).toEqual({
      cvc: 20, 'cvc-a': 10, 'cvc-e': 10, 'cvc-i': 10, 'cvc-o': 10, 'cvc-u': 10,
      sh: 10, ch: 9, th: 9, wh: 7, ng: 10, ck: 10,
      blends: 18, 'l-blends': 10, 'r-blends': 10, 's-blends': 9, 'end-blends': 10,
      'magic-e': 28,
    });
  });

  it('has the documented per-deck display titles (picker rows + run corner text)', () => {
    // deck.title flows verbatim into the picker row and the in-run corner
    // (`${deck.title} · 1 of N`, src/main.ts). v1.4 retitled four decks —
    // digraph decks are lowercase like their sound (ck, ng), and the two
    // starter decks no longer collide with their category headers
    // (CVC Mix ≠ CVC, Mixed Blends ≠ Blends). Pin all eighteen so a retitle
    // is always a deliberate, test-visible change.
    const titles = Object.fromEntries(decks.map((d) => [d.id, d.title]));
    expect(titles).toEqual({
      cvc: 'CVC Mix', 'cvc-a': 'Short A', 'cvc-e': 'Short E', 'cvc-i': 'Short I',
      'cvc-o': 'Short O', 'cvc-u': 'Short U',
      sh: 'sh', ch: 'ch', th: 'th', wh: 'wh', ng: 'ng', ck: 'ck',
      blends: 'Mixed Blends', 'l-blends': 'L-Blends', 'r-blends': 'R-Blends',
      's-blends': 'S-Blends', 'end-blends': 'Ending Blends',
      'magic-e': 'Magic E',
    });
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
      expect(['cvc', 'digraphs', 'blends', 'magic-e']).toContain(deck.category);
    }
  });

  // Magic E ships with NO `graphemes` key on any of its 28 cards — the only
  // deck of 18 without one (see TODOS.md's split-digraph convention item).
  // This is a deliberate, still-undecided gap: 8 of these cards are the SAME
  // words as in blends/wh, and those originals DO carry a consonant+e split
  // (e.g. s-blends' snake is ["sn","a","ke"]). Pinning 0/28 here means a
  // future automated edit can't "helpfully" fill the field in with a value
  // that would read the wrong vowel sound — this test must be updated
  // deliberately, alongside whichever option TODOS.md's convention item
  // eventually picks, not by a tool acting on its own.
  it('the Magic E deck intentionally carries no graphemes key on any card', () => {
    const magicE = decks.find((d) => d.id === 'magic-e');
    expect(magicE?.cards).toHaveLength(28);
    for (const card of magicE?.cards ?? []) {
      expect(card.graphemes).toBeUndefined();
    }
  });
});

describe('groupByCategory() against the real fixtures', () => {
  const groups = groupByCategory(loadDecks());

  it('returns the four categories in display order: CVC, Digraphs, Blends, Long Vowels', () => {
    expect(groups.map((g) => g.id)).toEqual(['cvc', 'digraphs', 'blends', 'magic-e']);
    expect(groups.map((g) => g.title)).toEqual(['CVC', 'Digraphs', 'Blends', 'Long Vowels']);
  });

  it('orders the digraph decks by their intra-category `order`: sh, ch, th, wh, ng, ck', () => {
    const digraphs = groups.find((g) => g.id === 'digraphs');
    expect(digraphs?.decks.map((d) => d.id)).toEqual(['sh', 'ch', 'th', 'wh', 'ng', 'ck']);
  });

  it('orders the CVC and Blends decks by their intra-category `order`', () => {
    expect(groups.find((g) => g.id === 'cvc')?.decks.map((d) => d.id)).toEqual([
      'cvc', 'cvc-a', 'cvc-e', 'cvc-i', 'cvc-o', 'cvc-u',
    ]);
    expect(groups.find((g) => g.id === 'blends')?.decks.map((d) => d.id)).toEqual([
      'blends', 'l-blends', 'r-blends', 's-blends', 'end-blends',
    ]);
  });

  it('the Magic E category contains exactly its one deck', () => {
    expect(groups.find((g) => g.id === 'magic-e')?.decks.map((d) => d.id)).toEqual(['magic-e']);
  });

  // GUARD A — a deck's title must never equal its own category's title.
  // v1.4 deliberately retitled two starter decks for exactly this reason
  // (`CVC Mix` for the `cvc` deck under the `CVC` header, `Mixed Blends` for
  // the `blends` deck under the `Blends` header) — but the convention was
  // never encoded as a test, which is exactly how this v1.7 branch shipped a
  // `Magic E` DECK under a `Magic E` CATEGORY header and nobody caught it
  // until an adversarial review renamed the category to `Long Vowels`. A
  // collision is worse than a cosmetic echo: the picker renders
  // `HEADER -> identical-text row` right under itself, AND — more
  // dangerously — a deck run and that category's shuffle-all run produce the
  // EXACT SAME in-run corner text (`${deck.title} · 1 of N` for the deck run,
  // `${category.title} · 1 of N` for the shuffle run, src/main.ts), even
  // though only the deck run is resumable across a reload (the shuffle run
  // is deliberately not — see the e2e 'a shuffle run is NOT resumable'
  // test). A parent glancing at the corner mid-session has no way to tell
  // which one they're in if the two titles match. Assert over every real
  // category/deck pair so a future retitle of either side that reintroduces
  // the collision fails here immediately, not in a live user's hands.
  // The same corner-text ambiguity applies to two DECKS sharing a title, and
  // nothing else in the repo forbids it: validate-decks.mjs checks that a
  // `title` exists, never that it is unique. The exhaustive title map above is
  // a value pin, not an invariant — it is the thing you edit when adding a
  // deck, which is exactly how the Magic E / Magic E collision shipped green.
  // So assert the invariant on both axes: against every category title (not
  // just its own), and against every other deck.
  it('no deck title collides with any category title or with another deck title', () => {
    const categoryTitles = new Set(groups.map((g) => g.title));
    const deckTitles = groups.flatMap((g) => g.decks).map((d) => d.title);
    for (const title of deckTitles) {
      expect(categoryTitles.has(title)).toBe(false);
    }
    expect(new Set(deckTitles).size).toBe(deckTitles.length);
  });

  // GUARD B — cross-category duplicate words are restricted to a pinned
  // allowlist.
  // Before v1.7 the app had 182 cards and 182 distinct words: no word
  // appeared in more than one category. The Long Vowels deck deliberately
  // reuses 8 words that already live in a blends deck or in `wh` — each word
  // teaches its ORIGINAL pattern (a blend, or the `wh` digraph) in its first
  // deck, and the silent-e pattern in Long Vowels — so the app is now 210
  // cards / 202 distinct words. scripts/validate-decks.mjs's duplicate-word
  // guard is deliberately scoped PER CATEGORY (a word repeated within one
  // category's shuffle pool is the bug that guards against), so an
  // ACCIDENTAL cross-category duplicate — e.g. a future deck copy-pasting a
  // word that already lives in some other category, with nobody noticing —
  // is completely invisible to every existing gate. This test computes every
  // word that appears in more than one category and pins the result to
  // EXACTLY these 8 intentional duplicates.
  // Pin the full word -> categories MAPPING, not just the set of words. An
  // earlier version of this guard collected only the word list, which threw
  // `categoryIds` away — so a word escalating from two categories to three
  // produced a byte-identical array and passed green. The 8 pinned words are
  // precisely the ones a future long-vowel or blends expansion would
  // copy-paste again, so that was the likeliest way to breach it. Pinning the
  // span makes the assertion exact in BOTH directions: a new accidental
  // duplicate, a removed/renamed pinned word, OR an existing duplicate
  // spreading to a third category each require a deliberate update here.
  it('cross-category duplicate words are restricted to the pinned allowlist', () => {
    const categoriesByWord = new Map<string, Set<string>>();
    for (const group of groups) {
      for (const deck of group.decks) {
        for (const card of deck.cards) {
          if (!categoriesByWord.has(card.text)) categoriesByWord.set(card.text, new Set());
          categoriesByWord.get(card.text)!.add(group.id);
        }
      }
    }
    const spans = Object.fromEntries(
      [...categoriesByWord.entries()]
        .filter(([, categoryIds]) => categoryIds.size > 1)
        .map(([word, categoryIds]) => [word, [...categoryIds].sort()]),
    );
    expect(spans).toEqual({
      flute: ['blends', 'magic-e'],
      grape: ['blends', 'magic-e'],
      plane: ['blends', 'magic-e'],
      plate: ['blends', 'magic-e'],
      skate: ['blends', 'magic-e'],
      slide: ['blends', 'magic-e'],
      snake: ['blends', 'magic-e'],
      whale: ['digraphs', 'magic-e'],
    });
  });

  // GUARD C — the same allowlist discipline for `img` PATHS across categories.
  // validate-decks.mjs's duplicate-`img` guard is scoped per category, exactly
  // like the duplicate-word one, and art-map.test.ts keys on category + MAP
  // hexcode. So an accidental cross-category shared drawing slips all three
  // gates, each for a different reason. Demonstrated during the v1.7 review:
  // pointing `jog` (cvc, deliberately image-free) at `art/globe.svg`
  // (magic-e) passed `npm run validate`, the full unit suite AND `npm run
  // build`, all green.
  // Sharing a path across categories is legal by convention — a shuffle pool
  // never spans categories, so the identical picture can't surface twice in
  // one run — and today it happens only for the 8 duplicated words, which are
  // the SAME word and so genuinely want the same drawing. Pinning the map
  // keeps that true by construction: a future deck reusing another category's
  // drawing for a DIFFERENT word has to come here and say so.
  it('cross-category shared art paths are restricted to the duplicated words', () => {
    const categoriesByImg = new Map<string, Set<string>>();
    for (const group of groups) {
      for (const deck of group.decks) {
        for (const card of deck.cards) {
          if (card.img == null) continue;
          if (!categoriesByImg.has(card.img)) categoriesByImg.set(card.img, new Set());
          categoriesByImg.get(card.img)!.add(group.id);
        }
      }
    }
    const shared = Object.fromEntries(
      [...categoriesByImg.entries()]
        .filter(([, categoryIds]) => categoryIds.size > 1)
        .map(([img, categoryIds]) => [img, [...categoryIds].sort()]),
    );
    expect(shared).toEqual({
      'art/flute.svg': ['blends', 'magic-e'],
      'art/grape.svg': ['blends', 'magic-e'],
      'art/plane.svg': ['blends', 'magic-e'],
      'art/plate.svg': ['blends', 'magic-e'],
      'art/skate.svg': ['blends', 'magic-e'],
      'art/slide.svg': ['blends', 'magic-e'],
      'art/snake.svg': ['blends', 'magic-e'],
      'art/whale.svg': ['digraphs', 'magic-e'],
    });
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

  it('drops a deck whose category is not in the manifest (never surfaces under any header)', () => {
    // A deck tagged with a category absent from CATEGORIES matches no cat.id, so
    // the per-category filter excludes it from every group — it silently
    // disappears from the picker rather than crashing. (validate-decks.mjs is
    // the build-time guard against this; here we pin the runtime behavior.)
    const withOrphan: Deck[] = [
      ...decks,
      { id: 'orphan', title: 'orphan', kind: 'phonics', category: 'nope', order: 0, cards: [{ type: 'word', text: 'q' }] },
    ];
    const groups = groupByCategory(withOrphan, cats);
    expect(groups.flatMap((g) => g.decks).some((d) => d.id === 'orphan')).toBe(false);
    expect(groups.map((g) => g.id)).toEqual(['alpha', 'beta']);
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

  it('concatenates every deck\'s cards in group order before shuffling (identity rng)', () => {
    // rng ~1 makes Fisher–Yates a no-op (see shuffle.test.ts), so the output is
    // exactly the pooled list: flatMap must walk the group's decks in order and
    // include every card from each. A sorted permutation check can't prove this.
    const deck = buildShuffledDeck(group, () => 0.999);
    expect(deck.cards.map((c) => c.text)).toEqual(['ship', 'shin', 'chip']);
  });

  it('carries the synthetic-deck shape: reserved kind/order/category for the reducer', () => {
    const deck = buildShuffledDeck(group, () => 0.5);
    expect(deck.kind).toBe('phonics');
    expect(deck.order).toBe(0);
    expect(deck.category).toBe('digraphs');
  });
});

describe('buildShuffledDeck() — single-deck category', () => {
  // The Long Vowels category (id 'magic-e') IS single-deck in production as
  // of v1.7 — it holds exactly the one 'magic-e' deck. This synthetic
  // fixture still pins the one-deck pooling path directly (rather than
  // depending on that production category's exact contents staying
  // single-deck forever): the pool is just that deck's cards, under the
  // reserved shuffle id.
  const group = {
    id: 'cvc',
    title: 'CVC',
    decks: [
      { id: 'cvc', title: 'cvc', kind: 'phonics', category: 'cvc', order: 1, cards: [
        { type: 'word' as const, text: 'cat', img: 'art/cat.svg' },
        { type: 'word' as const, text: 'dog', img: 'art/dog.svg' },
        { type: 'word' as const, text: 'sun', img: 'art/sun.svg' },
      ] },
    ],
  };

  it('pools the single deck under the reserved id + category title', () => {
    const deck = buildShuffledDeck(group, () => 0.999);
    expect(deck.id).toBe('shuffle:cvc');
    expect(deck.title).toBe('CVC');
    expect(deck.cards).toHaveLength(3);
    expect(deck.cards.map((c) => c.text)).toEqual(['cat', 'dog', 'sun']); // identity rng
  });
});

describe('resolveShuffleDeck()', () => {
  // Mirrors the multi-deck `group` fixture above but wrapped in a `groups`
  // array, since resolveShuffleDeck (unlike buildShuffledDeck) does its own
  // category lookup — that's the whole point of extracting it (P4.13): the
  // unknown-category branch used to be buried in main.ts's async, DOM-coupled
  // dispatch(), unreachable from a unit test.
  const groups = [
    {
      id: 'digraphs',
      title: 'Digraphs',
      decks: [
        { id: 'sh', title: 'sh', kind: 'phonics' as const, category: 'digraphs', order: 1, cards: [
          { type: 'word' as const, text: 'ship', img: 'art/ship.svg' },
          { type: 'word' as const, text: 'shin' },
        ] },
        { id: 'ch', title: 'ch', kind: 'phonics' as const, category: 'digraphs', order: 2, cards: [
          { type: 'word' as const, text: 'chip', img: 'art/chip.svg' },
        ] },
      ],
    },
  ];

  it('a known category resolves to a freshly shuffled synthetic deck', () => {
    const deck = resolveShuffleDeck(groups, 'shuffle:digraphs', () => 0.999);
    expect(deck?.id).toBe('shuffle:digraphs');
    expect(deck?.cards.map((c) => c.text)).toEqual(['ship', 'shin', 'chip']); // identity rng
  });

  it('an unknown category (no matching group id) resolves to null', () => {
    // e.g. a stale/persisted shuffle id for a category dropped since — must
    // recover to null, not throw or fall through to some other deck.
    expect(resolveShuffleDeck(groups, 'shuffle:nope', () => 0.5)).toBeNull();
  });

  it('a start id lacking the shuffle prefix resolves to null without touching groups', () => {
    expect(resolveShuffleDeck(groups, 'sh', () => 0.5)).toBeNull();
    expect(resolveShuffleDeck(groups, '', () => 0.5)).toBeNull();
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
