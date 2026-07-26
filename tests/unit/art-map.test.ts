/* =========================================================================
   art-map.test.ts — scripts/fetch-art.mjs MAP ↔ decks/*.json consistency.

   fetch-art.mjs is a dev-time tool (never executed in build/CI), so its MAP
   has no runtime consumer to fail on drift: a stale key silently fetches an
   orphan SVG into public/ (dead weight in the precache manifest), and a key
   that no card references means `npm run fetch-art` maintains art nothing
   displays. Exactly this class of drift occurred in v1.4 — "spider" and
   "grapes" MAP entries had to be hand-removed/renamed when the cards
   changed. This test pins the invariant so the next deck edit can't leave
   the MAP stale.

   APPROACH: fetch-art.mjs can't be imported (its top level runs network
   fetches), so the MAP keys are regex-parsed out of the source — the same
   anti-drift technique scripts/validate-decks.mjs already uses to derive
   PALETTE and KEEP_COLORS from this file. The source is pulled in via
   Vite's `?raw` import, not node:fs — tests/ is part of the tsc --noEmit
   build gate, whose types are vite/client only (no node types). The parse
   is guarded against returning zero keys, so a refactor that moves MAP
   fails loudly here rather than vacuously passing.
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import FETCH_ART_SRC from '../../scripts/fetch-art.mjs?raw';
import { groupByCategory, loadDecks } from '../../src/decks';

// The MAP object literal body. Real entries are two-space-indented
// `name: 'CODE',` lines; commented-out non-entries (`// whisk: no glyph…`)
// don't match the ^\s{2}[a-z] shape.
const MAP_BLOCK = FETCH_ART_SRC.match(/const MAP = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const MAP_KEYS = [...MAP_BLOCK.matchAll(/^\s{2}([a-z]+):\s*'/gm)].map((m) => m[1]);

// Every art basename any deck card actually references ("art/grape.svg" -> "grape").
const REFERENCED_ART = new Set(
  loadDecks()
    .flatMap((d) => d.cards)
    .filter((c) => c.img != null)
    .map((c) => String(c.img).replace(/^art\//, '').replace(/\.svg$/, '')),
);

describe('fetch-art MAP ↔ deck img consistency', () => {
  it('parses a non-trivial MAP out of scripts/fetch-art.mjs (anti-drift guard)', () => {
    // ~145 entries at v1.4; a collapsed parse means the regex or the MAP
    // moved — fail loudly instead of passing on an empty key list.
    expect(MAP_KEYS.length).toBeGreaterThan(100);
    expect(new Set(MAP_KEYS).size).toBe(MAP_KEYS.length); // no duplicate keys
  });

  it('every MAP key is art some deck card references — no stale entries', () => {
    // A key with no referencing card is drift: fetch-art would (re)write an
    // orphan public/art SVG that ships in the PWA precache but never renders.
    // (The reverse is NOT asserted: hand-drawn placeholders like whip/chip
    // are deliberately unmapped so fetch-art never clobbers them.)
    const stale = MAP_KEYS.filter((k) => !REFERENCED_ART.has(k));
    expect(stale).toEqual([]);
  });

  it('no MAP glyph is shared by two cards in the SAME category (v1.6 P1.1)', () => {
    // The jog/run collision this branch fixed, guarded at its source. Two MAP
    // keys pointing at the ONE OpenMoji hex produce two byte-identical SVGs, so
    // a single "shuffle all" run over their category shows the child the
    // identical picture for two different words — indistinguishable from the app
    // having lost its place. fetch-art.mjs's comment says jog was left unmapped
    // for exactly this reason, but nothing enforced it: re-adding
    // `jog: '1F3C3'` (already `run`'s hex, also CVC) would have sailed through
    // every other test here. Scoped per category, matching the real exposure:
    // a shuffle pool never spans categories, and five cross-category pairs
    // (jet/plane, dish/plate, bath/tub, hut/shed, drip/wet) ship deliberately.
    const hexByKey = new Map(
      [...MAP_BLOCK.matchAll(/^\s{2}([a-z]+):\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]),
    );
    const collisions: string[] = [];
    let mapped = 0;
    for (const group of groupByCategory(loadDecks())) {
      const seen = new Map<string, string>(); // hex -> the first card that used it
      for (const deck of group.decks) {
        for (const card of deck.cards) {
          const hex = hexByKey.get(card.text);
          if (hex === undefined) continue; // hand-drawn/unmapped — nothing to collide
          mapped++;
          const first = seen.get(hex);
          if (first === undefined) seen.set(hex, card.text);
          else collisions.push(`${group.id}: "${card.text}" reuses "${first}"'s glyph ${hex}`);
        }
      }
    }
    expect(collisions).toEqual([]);
    // Anti-vacuous: a MAP-key/card-text mismatch (or a collapsed parse) would
    // leave `mapped` at 0 and the assertion above trivially satisfied. ~145
    // mapped cards ship today.
    expect(mapped).toBeGreaterThan(100);
  });

  it('v1.4 taxonomy changes are reflected in the MAP', () => {
    // Added wh cards with art gained entries; whisk stayed image-free (no
    // OpenMoji whisk glyph) so it must NOT be mapped; the dropped spider
    // card and the grapes -> grape rename left no stale key behind.
    expect(MAP_KEYS).toContain('wheel');
    expect(MAP_KEYS).toContain('whale');
    expect(MAP_KEYS).toContain('grape');
    expect(MAP_KEYS).not.toContain('whisk');
    expect(MAP_KEYS).not.toContain('spider');
    expect(MAP_KEYS).not.toContain('grapes');
  });
});
