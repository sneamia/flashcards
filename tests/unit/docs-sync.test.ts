/* =========================================================================
   docs-sync.test.ts — README.md / DESIGN.md prose counts ↔ decks/*.json.

   The per-category deck/word counts in README.md ("six decks, 70 words")
   and the digraph example in DESIGN.md ("e.g. digraphs = 55 words") are
   hand-written prose with no runtime consumer, so nothing fails when a
   deck edit changes the real totals. Exactly this drift occurred twice in
   v1.4: the README needed a follow-up sync commit (7f93836), and
   DESIGN.md's example was still on the v1.3 count (52). This test derives
   the real totals through the same loadDecks()/groupByCategory() the app
   uses and pins the prose to them, so the next deck edit fails here
   instead of shipping stale docs.

   The docs are pulled in via Vite `?raw` imports, not node:fs — tests/ is
   part of the tsc --noEmit build gate, whose types are vite/client only
   (no node types).
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import DESIGN from '../../DESIGN.md?raw';
import README from '../../README.md?raw';
import { groupByCategory, loadDecks } from '../../src/decks';

// Display-ordered real totals, derived exactly the way the picker derives
// them (CVC, Digraphs, Blends at v1.4).
const real = groupByCategory(loadDecks()).map((g) => ({
  id: g.id,
  decks: g.decks.length,
  words: g.decks.reduce((n, d) => n + d.cards.length, 0),
}));

const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

describe('README.md category counts stay in sync with decks/*.json', () => {
  // One "<word> decks, <M> words" phrase per category bullet, in the
  // README's (= picker's) display order. \s+ tolerates the wrapped lines
  // ("six\n  decks, 55 words").
  const documented = [...README.matchAll(/(\w+)\s+decks,\s+(\d+)\s+words/g)]
    .map((m) => ({ decks: NUMBER_WORDS[m[1]], words: Number(m[2]) }));

  it('finds exactly one "N decks, M words" phrase per category', () => {
    expect(documented).toHaveLength(real.length);
  });

  it('deck and word counts match the loaded deck data, in display order', () => {
    expect(documented).toEqual(real.map(({ decks, words }) => ({ decks, words })));
  });
});

describe('DESIGN.md digraph example count stays in sync', () => {
  it('the "e.g. digraphs = N words" example matches the real digraph total', () => {
    const m = DESIGN.match(/digraphs = (\d+) words/);
    expect(m).not.toBeNull();
    const digraphs = real.find((r) => r.id === 'digraphs');
    expect(Number(m![1])).toBe(digraphs?.words);
  });
});
