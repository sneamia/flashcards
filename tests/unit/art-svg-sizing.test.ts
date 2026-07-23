/* =========================================================================
   art-svg-sizing.test.ts — pins that no shipped art SVG declares a root
   width/height attribute.

   Drift guard for the v1.5 reveal-sizing fix. `.reveal .art` now sizes every
   illustration to a definite --art-max-h (64vh), so a file's declared pixel
   size no longer affects layout. But a stray width/height on a future
   hand-drawn placeholder would be dead, misleading metadata — and back when
   the CSS still deferred to intrinsic size, it was the EXACT cause of the
   "images sometimes come out really small" bug (six hand-drawn SVGs declared
   width="100" and rendered at a tiny 100px, whip at 200px, while the
   dimensionless OpenMoji SVGs sat at the ~150px browser default). Keep every
   art file dimensionless: viewBox-only, ratio-defining, size-agnostic — the
   same shape SVGO emits for the OpenMoji pipeline.

   APPROACH: mirrors art-map.test.ts — pull the SVG bytes in via Vite's ?raw
   glob (tests/ typecheck against vite/client only, no node:fs types), and
   guard against a vacuous pass if the glob ever matches nothing.
   ========================================================================= */

import { describe, expect, it } from 'vitest';

const ART = import.meta.glob('../../public/art/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('art SVG root dimensions', () => {
  it('loads the full art set (anti-vacuous guard)', () => {
    // ~152 files at v1.5; a collapsed glob means the path moved — fail loudly
    // rather than pass on an empty set.
    expect(Object.keys(ART).length).toBeGreaterThan(100);
  });

  it('no art SVG declares a root width/height — viewBox only', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(ART)) {
      const openTag = src.match(/<svg\b[^>]*>/i)?.[0] ?? '';
      // Only the ROOT <svg> tag is checked; inner <rect width=…> etc. are
      // legitimate geometry and live past the first '>'. Anchor the attribute
      // name to a tag/whitespace boundary (not \b) so a presentation attribute
      // like `stroke-width` on the root — a legitimate SVG idiom — isn't
      // mis-flagged as a root dimension (\b treats the hyphen as a boundary).
      if (/(?:^|\s)(?:width|height)\s*=/.test(openTag)) {
        offenders.push(path.replace(/^.*\/art\//, 'art/'));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every art SVG declares a viewBox — the ratio width:auto needs', () => {
    // The dimensionless invariant above is only half the story: `.reveal .art`
    // sets `height:64vh; width:auto`, so the browser derives width from the
    // viewBox ratio. An SVG with NEITHER root dimensions NOR a viewBox has no
    // intrinsic ratio, `width:auto` can't resolve, and the illustration
    // collapses to nothing — passing the no-root-dimensions test while
    // rendering invisibly. Pin the other half so the guard protects the whole
    // sizing contract.
    const missing: string[] = [];
    for (const [path, src] of Object.entries(ART)) {
      const openTag = src.match(/<svg\b[^>]*>/i)?.[0] ?? '';
      if (!/(?:^|\s)viewBox\s*=/i.test(openTag)) {
        missing.push(path.replace(/^.*\/art\//, 'art/'));
      }
    }
    expect(missing).toEqual([]);
  });
});
