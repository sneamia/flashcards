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
import { loadDecks } from '../../src/decks';

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
