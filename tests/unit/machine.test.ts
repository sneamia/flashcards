/* =========================================================================
   machine.test.ts — the WHOLE transition table from docs/ARCHITECTURE.md /
   the ASCII table atop src/machine.ts. Uses a fake Ctx (stub `hasImage`,
   small fake deck) so this stays pure/synchronous, no DOM.

   Conventions used below:
   - `withNow(state, now)` clones a state but overrides lockUntil so a test
     can freely put the reducer into/out of the lockout window.
   - No-op transitions are asserted with `toBe(state)` (same reference) —
     the reducer is documented as returning `state` unchanged, not an
     equivalent copy, for every no-op branch.
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import type { Deck } from '../../src/types';
import {
  type AppState,
  type Ctx,
  LOCKOUT_MS,
  initialState,
  reduce,
} from '../../src/machine';

// Fake deck: 3 cards. hasImage is supplied per-test via a map so the same
// deck shape can exercise both "word has an image beat" and "one-beat,
// image-free word" branches, including at the last card.
const fakeDeck: Deck = {
  id: 'fake',
  title: 'fake',
  kind: 'phonics',
  category: 'digraphs',
  order: 1,
  cards: [
    { type: 'word', text: 'aaa' },
    { type: 'word', text: 'bbb' },
    { type: 'word', text: 'ccc' },
  ],
};

function makeCtx(now: number, hasImageMap: Record<number, boolean>, deck: Deck | null = fakeDeck): Ctx {
  return {
    now,
    deck,
    hasImage: (i: number) => !!hasImageMap[i],
  };
}

function stateAt(overrides: Partial<AppState>): AppState {
  return { ...initialState(), ...overrides };
}

describe('initialState', () => {
  it('starts on the picker, unlocked', () => {
    expect(initialState()).toEqual({
      screen: 'deck_pick',
      deckId: null,
      cardIndex: 0,
      beat: 'word',
      lockUntil: 0,
    });
  });
});

describe('{start: deckId} — deck picked from the picker', () => {
  it('goes to card/word/cardIndex=0 and sets the lock', () => {
    const ctx = makeCtx(1000, {});
    const next = reduce(initialState(), { start: 'fake' }, ctx);
    expect(next).toEqual({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 0,
      beat: 'word',
      lockUntil: 1000 + LOCKOUT_MS,
    });
  });

  it('BYPASSES the lockout — a deliberate picker selection always applies', () => {
    // Simulate a state that is still deep in some earlier lockout window.
    const locked = stateAt({ screen: 'deck_pick', lockUntil: 999_999 });
    const ctx = makeCtx(1000, {});
    const next = reduce(locked, { start: 'fake' }, ctx);
    expect(next.screen).toBe('card');
    expect(next.deckId).toBe('fake');
    expect(next.lockUntil).toBe(1000 + LOCKOUT_MS);
  });
});

describe('ADVANCE on card', () => {
  it('word -> image when hasImage(cardIndex) is true, and locks', () => {
    const state = stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0, beat: 'word', lockUntil: 0 });
    const ctx = makeCtx(500, { 0: true });
    const next = reduce(state, 'ADVANCE', ctx);
    expect(next).toEqual({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 0,
      beat: 'image',
      lockUntil: 500 + LOCKOUT_MS,
    });
  });

  it('word -> next card when NOT hasImage (image-free one-beat card), and locks', () => {
    const state = stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0, beat: 'word', lockUntil: 0 });
    const ctx = makeCtx(500, { 0: false });
    const next = reduce(state, 'ADVANCE', ctx);
    expect(next).toEqual({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 1,
      beat: 'word',
      lockUntil: 500 + LOCKOUT_MS,
    });
  });

  it('image -> next card (regardless of hasImage), and locks', () => {
    const state = stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0, beat: 'image', lockUntil: 0 });
    const ctx = makeCtx(500, { 0: true, 1: true });
    const next = reduce(state, 'ADVANCE', ctx);
    expect(next).toEqual({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 1,
      beat: 'word',
      lockUntil: 500 + LOCKOUT_MS,
    });
  });

  it('last card, word beat, hasImage -> image, then ADVANCE again -> end', () => {
    // cardIndex 2 is the last of 3 cards.
    const atLastWord = stateAt({ screen: 'card', deckId: 'fake', cardIndex: 2, beat: 'word', lockUntil: 0 });
    const ctx1 = makeCtx(0, { 2: true });
    const atLastImage = reduce(atLastWord, 'ADVANCE', ctx1);
    expect(atLastImage).toMatchObject({ screen: 'card', cardIndex: 2, beat: 'image' });

    const ctx2 = makeCtx(atLastImage.lockUntil, { 2: true }); // now === lockUntil: unlocked
    const atEnd = reduce(atLastImage, 'ADVANCE', ctx2);
    expect(atEnd).toEqual({
      screen: 'end',
      deckId: 'fake',
      cardIndex: 0,
      beat: 'word',
      lockUntil: atLastImage.lockUntil + LOCKOUT_MS,
    });
  });

  it('last card, word beat, NOT hasImage -> end directly (skips the image beat)', () => {
    const atLastWord = stateAt({ screen: 'card', deckId: 'fake', cardIndex: 2, beat: 'word', lockUntil: 0 });
    const ctx = makeCtx(700, { 2: false });
    const next = reduce(atLastWord, 'ADVANCE', ctx);
    expect(next).toEqual({
      screen: 'end',
      deckId: 'fake',
      cardIndex: 0,
      beat: 'word',
      lockUntil: 700 + LOCKOUT_MS,
    });
  });
});

describe('ADVANCE respects the lockout (CRITICAL)', () => {
  it('is a silent no-op when now < lockUntil, returning the exact same state reference', () => {
    const state = stateAt({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 0,
      beat: 'word',
      lockUntil: 10_000,
    });
    const ctx = makeCtx(9_999, { 0: true }); // now < lockUntil
    const next = reduce(state, 'ADVANCE', ctx);
    expect(next).toBe(state); // same reference, not merely equal
  });

  it('unlocks and applies at exactly now === lockUntil', () => {
    const state = stateAt({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 0,
      beat: 'word',
      lockUntil: 10_000,
    });
    const ctx = makeCtx(10_000, { 0: true }); // now === lockUntil: unlocked
    const next = reduce(state, 'ADVANCE', ctx);
    expect(next).not.toBe(state);
    expect(next.beat).toBe('image');
  });

  it('applies normally once now > lockUntil', () => {
    const state = stateAt({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 0,
      beat: 'word',
      lockUntil: 10_000,
    });
    const ctx = makeCtx(10_001, { 0: true });
    const next = reduce(state, 'ADVANCE', ctx);
    expect(next.beat).toBe('image');
  });

  it('ADVANCE on deck_pick / about has no defined effect (no-op)', () => {
    const picker = stateAt({ screen: 'deck_pick', lockUntil: 0 });
    const about = stateAt({ screen: 'about', lockUntil: 0 });
    const ctx = makeCtx(0, {});
    expect(reduce(picker, 'ADVANCE', ctx)).toBe(picker);
    expect(reduce(about, 'ADVANCE', ctx)).toBe(about);
  });
});

describe('ADVANCE on end -> picker', () => {
  it('goes to deck_pick, clears deckId, and locks', () => {
    const state = stateAt({ screen: 'end', deckId: 'fake', cardIndex: 0, beat: 'word', lockUntil: 0 });
    const ctx = makeCtx(300, {});
    const next = reduce(state, 'ADVANCE', ctx);
    expect(next).toEqual({
      screen: 'deck_pick',
      deckId: null,
      cardIndex: 0,
      beat: 'word',
      lockUntil: 300 + LOCKOUT_MS,
    });
  });

  it('entering end always sets deckId to null on the eventual ADVANCE->picker transition', () => {
    // Also double-check the `end` state itself carries the deckId (per the
    // nextCard() branch in machine.ts) but the FOLLOWING ADVANCE clears it.
    const midDeck = stateAt({ screen: 'card', deckId: 'fake', cardIndex: 2, beat: 'word', lockUntil: 0 });
    const ctx1 = makeCtx(0, { 2: false }); // image-free last card -> straight to end
    const atEnd = reduce(midDeck, 'ADVANCE', ctx1);
    expect(atEnd.screen).toBe('end');

    const ctx2 = makeCtx(atEnd.lockUntil, {});
    const atPicker = reduce(atEnd, 'ADVANCE', ctx2);
    expect(atPicker.screen).toBe('deck_pick');
    expect(atPicker.deckId).toBeNull();
  });

  it('BACK / ABOUT / DISMISS on end are no-ops', () => {
    const state = stateAt({ screen: 'end', deckId: 'fake', cardIndex: 0, beat: 'word', lockUntil: 0 });
    const ctx = makeCtx(0, {});
    expect(reduce(state, 'BACK', ctx)).toBe(state);
    expect(reduce(state, 'ABOUT', ctx)).toBe(state);
    expect(reduce(state, 'DISMISS', ctx)).toBe(state);
  });
});

describe('BACK (bypasses lockout)', () => {
  it('image -> word on the SAME card, and locks', () => {
    const state = stateAt({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 1,
      beat: 'image',
      lockUntil: 999_999, // deep in lockout — BACK must bypass this
    });
    const ctx = makeCtx(50, { 1: true });
    const next = reduce(state, 'BACK', ctx);
    expect(next).toEqual({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 1,
      beat: 'word',
      lockUntil: 50 + LOCKOUT_MS,
    });
  });

  it('word, cardIndex>0 -> previous card, beat = image if hasImage(prev) else word, locks', () => {
    const state = stateAt({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 2,
      beat: 'word',
      lockUntil: 999_999,
    });
    const ctxImagePrev = makeCtx(50, { 1: true });
    const nextImage = reduce(state, 'BACK', ctxImagePrev);
    expect(nextImage).toEqual({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 1,
      beat: 'image',
      lockUntil: 50 + LOCKOUT_MS,
    });

    const ctxWordPrev = makeCtx(50, { 1: false });
    const nextWord = reduce(state, 'BACK', ctxWordPrev);
    expect(nextWord).toEqual({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 1,
      beat: 'word',
      lockUntil: 50 + LOCKOUT_MS,
    });
  });

  it('word, cardIndex===0 -> no-op (same reference), even though lockout is bypassed', () => {
    const state = stateAt({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 0,
      beat: 'word',
      lockUntil: 999_999,
    });
    const ctx = makeCtx(50, { 0: true });
    const next = reduce(state, 'BACK', ctx);
    expect(next).toBe(state);
  });

  it('BACK bypasses the lockout entirely (unlike ADVANCE)', () => {
    const state = stateAt({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 1,
      beat: 'image',
      lockUntil: 999_999,
    });
    const ctx = makeCtx(1, { 1: true }); // now (1) << lockUntil (999999)
    const next = reduce(state, 'BACK', ctx);
    expect(next.beat).toBe('word');
    expect(next.lockUntil).toBe(1 + LOCKOUT_MS);
  });

  it('BACK on other screens (deck_pick, end, about) is a no-op', () => {
    const ctx = makeCtx(0, {});
    const picker = stateAt({ screen: 'deck_pick' });
    const end = stateAt({ screen: 'end', deckId: 'fake' });
    const about = stateAt({ screen: 'about' });
    expect(reduce(picker, 'BACK', ctx)).toBe(picker);
    expect(reduce(end, 'BACK', ctx)).toBe(end);
    expect(reduce(about, 'BACK', ctx)).toBe(about);
  });
});

describe('EXIT (bypasses lockout)', () => {
  it('from card -> deck_pick, clears deckId, locks', () => {
    const state = stateAt({
      screen: 'card',
      deckId: 'fake',
      cardIndex: 2,
      beat: 'image',
      lockUntil: 999_999,
    });
    const ctx = makeCtx(20, {});
    const next = reduce(state, 'EXIT', ctx);
    expect(next).toEqual({
      screen: 'deck_pick',
      deckId: null,
      cardIndex: 0,
      beat: 'word',
      lockUntil: 20 + LOCKOUT_MS,
    });
  });

  it('from end -> deck_pick, locks', () => {
    const state = stateAt({ screen: 'end', deckId: 'fake', cardIndex: 0, beat: 'word', lockUntil: 999_999 });
    const ctx = makeCtx(20, {});
    const next = reduce(state, 'EXIT', ctx);
    expect(next.screen).toBe('deck_pick');
    expect(next.deckId).toBeNull();
    expect(next.lockUntil).toBe(20 + LOCKOUT_MS);
  });

  it('from about -> deck_pick, locks', () => {
    const state = stateAt({ screen: 'about', lockUntil: 999_999 });
    const ctx = makeCtx(20, {});
    const next = reduce(state, 'EXIT', ctx);
    expect(next.screen).toBe('deck_pick');
    expect(next.lockUntil).toBe(20 + LOCKOUT_MS);
  });

  it('is a no-op when already on deck_pick (same reference)', () => {
    const state = stateAt({ screen: 'deck_pick', lockUntil: 999_999 });
    const ctx = makeCtx(20, {});
    const next = reduce(state, 'EXIT', ctx);
    expect(next).toBe(state);
  });

  it('bypasses the lockout entirely', () => {
    const state = stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0, beat: 'word', lockUntil: 999_999 });
    const ctx = makeCtx(5, {}); // now (5) << lockUntil (999999)
    const next = reduce(state, 'EXIT', ctx);
    expect(next.screen).toBe('deck_pick');
  });
});

describe('ABOUT (only reachable from deck_pick, bypasses lockout)', () => {
  it('from deck_pick -> about, locks', () => {
    const state = stateAt({ screen: 'deck_pick', lockUntil: 999_999 });
    const ctx = makeCtx(10, {});
    const next = reduce(state, 'ABOUT', ctx);
    expect(next).toEqual({
      screen: 'about',
      deckId: null,
      cardIndex: 0,
      beat: 'word',
      lockUntil: 10 + LOCKOUT_MS,
    });
  });

  it('is a no-op from every other screen (card, end, about itself)', () => {
    const ctx = makeCtx(0, {});
    const card = stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0 });
    const end = stateAt({ screen: 'end', deckId: 'fake' });
    const about = stateAt({ screen: 'about' });
    expect(reduce(card, 'ABOUT', ctx)).toBe(card);
    expect(reduce(end, 'ABOUT', ctx)).toBe(end);
    expect(reduce(about, 'ABOUT', ctx)).toBe(about);
  });
});

describe('DISMISS (only reachable from about, bypasses lockout)', () => {
  it('from about -> deck_pick, locks', () => {
    const state = stateAt({ screen: 'about', lockUntil: 999_999 });
    const ctx = makeCtx(30, {});
    const next = reduce(state, 'DISMISS', ctx);
    expect(next).toEqual({
      screen: 'deck_pick',
      deckId: null,
      cardIndex: 0,
      beat: 'word',
      lockUntil: 30 + LOCKOUT_MS,
    });
  });

  it('is a no-op from every other screen (deck_pick, card, end)', () => {
    const ctx = makeCtx(0, {});
    const picker = stateAt({ screen: 'deck_pick' });
    const card = stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0 });
    const end = stateAt({ screen: 'end', deckId: 'fake' });
    expect(reduce(picker, 'DISMISS', ctx)).toBe(picker);
    expect(reduce(card, 'DISMISS', ctx)).toBe(card);
    expect(reduce(end, 'DISMISS', ctx)).toBe(end);
  });
});

describe('every landing sets lockUntil = now + LOCKOUT_MS', () => {
  it('across a representative sample of transitions', () => {
    const now = 123_456;
    const samples: Array<[AppState, Parameters<typeof reduce>[1], Record<number, boolean>]> = [
      [initialState(), { start: 'fake' }, {}],
      [stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0, beat: 'word' }), 'ADVANCE', { 0: true }],
      [stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0, beat: 'word' }), 'ADVANCE', { 0: false }],
      [stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0, beat: 'image' }), 'ADVANCE', {}],
      [stateAt({ screen: 'end', deckId: 'fake' }), 'ADVANCE', {}],
      [stateAt({ screen: 'card', deckId: 'fake', cardIndex: 1, beat: 'image' }), 'BACK', {}],
      [stateAt({ screen: 'card', deckId: 'fake', cardIndex: 1, beat: 'word' }), 'BACK', { 0: true }],
      [stateAt({ screen: 'card', deckId: 'fake', cardIndex: 0, beat: 'word' }), 'EXIT', {}],
      [stateAt({ screen: 'deck_pick' }), 'ABOUT', {}],
      [stateAt({ screen: 'about' }), 'DISMISS', {}],
    ];

    for (const [state, action, hasImageMap] of samples) {
      const ctx = makeCtx(now, hasImageMap);
      const next = reduce(state, action, ctx);
      expect(next).not.toBe(state); // sanity: this sample must actually transition
      expect(next.lockUntil).toBe(now + LOCKOUT_MS);
    }
  });
});

describe('defensive guards', () => {
  it('ADVANCE on card with a null ctx.deck is a same-reference no-op', () => {
    const s = stateAt({ screen: 'card', deckId: 'gone', cardIndex: 0, beat: 'word', lockUntil: 0 });
    expect(reduce(s, 'ADVANCE', makeCtx(5000, {}, null))).toBe(s);
  });
});

describe('synthetic shuffle deck is walked by index identically (pure boundary held)', () => {
  // A "shuffle all" run reaches the reducer as a {start:'shuffle:...'} action
  // and an ordinary Ctx.deck. The reducer neither knows nor cares that the deck
  // is synthetic — proving no randomness/id-awareness leaked into machine.ts.
  const shuffled: Deck = {
    id: 'shuffle:digraphs',
    title: 'Digraphs',
    kind: 'phonics',
    category: 'digraphs',
    order: 0,
    cards: [
      { type: 'word', text: 'one' },
      { type: 'word', text: 'two' },
    ],
  };

  it('start -> card 0, ADVANCE walks to the end, BACK steps back — all by index', () => {
    const started = reduce(initialState(), { start: shuffled.id }, makeCtx(0, {}, shuffled));
    expect(started).toMatchObject({ screen: 'card', deckId: 'shuffle:digraphs', cardIndex: 0, beat: 'word' });

    // card 0 is image-free here -> ADVANCE goes straight to card 1.
    const atOne = reduce(started, 'ADVANCE', makeCtx(started.lockUntil, { 0: false }, shuffled));
    expect(atOne).toMatchObject({ screen: 'card', cardIndex: 1, beat: 'word' });

    // BACK from card 1 -> card 0 (prev is image-free -> word beat).
    const back = reduce(atOne, 'BACK', makeCtx(atOne.lockUntil, { 0: false }, shuffled));
    expect(back).toMatchObject({ screen: 'card', cardIndex: 0, beat: 'word' });

    // ADVANCE off the last card -> end, carrying the synthetic deckId.
    const atEnd = reduce(atOne, 'ADVANCE', makeCtx(atOne.lockUntil, { 1: false }, shuffled));
    expect(atEnd).toMatchObject({ screen: 'end', deckId: 'shuffle:digraphs' });
  });
});
