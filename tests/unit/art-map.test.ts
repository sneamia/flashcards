/* =========================================================================
   art-map.test.ts — scripts/fetch-art.mjs MAP + MULBERRY ↔ decks/*.json consistency.

   fetch-art.mjs is a dev-time tool (never executed in build/CI), so its MAP
   has no runtime consumer to fail on drift: a stale key silently fetches an
   orphan SVG into public/ (dead weight in the precache manifest), and a key
   that no card references means `npm run fetch-art` maintains art nothing
   displays. Exactly this class of drift occurred in v1.4 — "spider" and
   "grapes" MAP entries had to be hand-removed/renamed when the cards
   changed. This test pins the invariant so the next deck edit can't leave
   the MAP stale.

   APPROACH: fetch-art.mjs can't be imported (its top level runs network
   fetches), so the MAP/MULBERRY keys (both tables) are regex-parsed out of the source — the same
   anti-drift technique scripts/validate-decks.mjs already uses to derive
   PALETTE and KEEP_COLORS from this file. The source is pulled in via
   Vite's `?raw` import, not node:fs — tests/ is part of the tsc --noEmit
   build gate, whose types are vite/client only (no node types). The parse
   is guarded against returning zero keys, so a refactor that moves MAP or MULBERRY
   fails loudly here rather than vacuously passing.
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import FETCH_ART_SRC from '../../scripts/fetch-art.mjs?raw';
import { groupByCategory, loadDecks } from '../../src/decks';

// The two source tables. Real entries are two-space-indented `name: 'CODE',`
// lines; commented-out non-entries (`// whisk: no glyph…`) don't match the
// ^\s{2}[a-z] shape.
const MAP_BLOCK = FETCH_ART_SRC.match(/const MAP = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const MULBERRY_BLOCK = FETCH_ART_SRC.match(/const MULBERRY = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const parseKeys = (block: string): string[] =>
  [...block.matchAll(/^\s{2}([a-z0-9_]+):\s*'/gm)].map((m) => m[1]);
const parseValues = (block: string): Map<string, string> =>
  new Map([...block.matchAll(/^\s{2}([a-z0-9_]+):\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]));
const MAP_KEYS = parseKeys(MAP_BLOCK);
const MULBERRY_KEYS = parseKeys(MULBERRY_BLOCK);
const ALL_KEYS = [...MAP_KEYS, ...MULBERRY_KEYS];

// Every art basename any deck card actually references ("art/grape.svg" -> "grape").
const REFERENCED_ART = new Set(
  loadDecks()
    .flatMap((d) => d.cards)
    .filter((c) => c.img != null)
    .map((c) => String(c.img).replace(/^art\//, '').replace(/\.svg$/, '')),
);

describe('fetch-art MAP/MULBERRY ↔ deck img consistency', () => {
  it('parses a non-trivial MAP and MULBERRY out of scripts/fetch-art.mjs (anti-drift guard)', () => {
    // 156 OpenMoji entries at v1.7; a collapsed parse means the regex or the
    // table moved — fail loudly instead of passing on an empty key list.
    expect(MAP_KEYS.length).toBeGreaterThan(100);
    expect(new Set(MAP_KEYS).size).toBe(MAP_KEYS.length); // no duplicate keys
    // Mulberry landed in v1.8 with 7 entries — the OpenMoji-less tail (kick,
    // neck, back, pet, bib, glue, tape). Same anti-vacuous reasoning.
    expect(MULBERRY_KEYS.length).toBeGreaterThanOrEqual(7);
    expect(new Set(MULBERRY_KEYS).size).toBe(MULBERRY_KEYS.length);
  });

  it('no word is mapped in both MAP and MULBERRY — exactly one source per word', () => {
    // fetch-art.mjs exits non-zero on overlap, but it is a dev-time tool that
    // nothing runs automatically; pin it here so the suite sees it too.
    const mulberry = new Set(MULBERRY_KEYS);
    expect(MAP_KEYS.filter((k) => mulberry.has(k))).toEqual([]);
  });

  it('every MAP/MULBERRY key is art some deck card references — no stale entries', () => {
    // A key with no referencing card is drift: fetch-art would (re)write an
    // orphan public/art SVG that ships in the PWA precache but never renders.
    // (The reverse is NOT asserted: hand-drawn placeholders like whip/chip/gate
    // are deliberately unmapped so fetch-art never clobbers them.)
    const stale = ALL_KEYS.filter((k) => !REFERENCED_ART.has(k));
    expect(stale).toEqual([]);
  });

  it('no upstream glyph is shared by two cards in the SAME category (v1.6 P1.1)', () => {
    // The jog/run collision v1.6 fixed, guarded at its source. Two keys
    // pointing at ONE upstream file produce two byte-identical SVGs, so a
    // single "shuffle all" run over their category shows the child the
    // identical picture for two different words — indistinguishable from the
    // app having lost its place. Scoped per category, matching the real
    // exposure: a shuffle pool never spans categories, and five cross-category
    // pairs (jet/plane, dish/plate, bath/tub, hut/shed, drip/wet) ship
    // deliberately. Source-prefixed so an OpenMoji hex and a Mulberry file
    // name can never be mistaken for one another.
    //
    // SCOPE — this covers exactly ONE of the two ways the collision comes
    // back: through the tables (two keys, one upstream). It joins card text ->
    // key, so it is structurally blind to pointing a card's img straight at
    // another word's existing file (`{"text": "jog", "img": "art/run.svg"}`).
    // That path is guarded in scripts/validate-decks.mjs (cardImgsByCategory),
    // which checks the rendered artifact instead. Both are needed; neither
    // subsumes the other, so don't "simplify" by deleting one.
    const sourceByKey = new Map<string, string>([
      ...[...parseValues(MAP_BLOCK)].map(([k, hex]) => [k, `openmoji:${hex}`] as const),
      ...[...parseValues(MULBERRY_BLOCK)].map(([k, file]) => [k, `mulberry:${file}`] as const),
    ]);
    const collisions: string[] = [];
    let mapped = 0;
    for (const group of groupByCategory(loadDecks())) {
      const seen = new Map<string, string>(); // upstream -> the first card that used it
      for (const deck of group.decks) {
        for (const card of deck.cards) {
          const source = sourceByKey.get(card.text);
          if (source === undefined) continue; // hand-drawn/unmapped — nothing to collide
          mapped++;
          const first = seen.get(source);
          if (first === undefined) seen.set(source, card.text);
          else collisions.push(`${group.id}: "${card.text}" reuses "${first}"'s ${source}`);
        }
      }
    }
    expect(collisions).toEqual([]);
    // Anti-vacuous: a key/card-text mismatch (or a collapsed parse) would
    // leave `mapped` at 0 and the assertion above trivially satisfied.
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
