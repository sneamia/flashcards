/* =========================================================================
   integrity.test.ts — boundary cases for the one pure precache-completeness
   check.

   isPrecacheComplete(required, present) === every required URL is in
   present. Duplicates/order in `required` must not matter (it's a coverage
   check, not a multiset comparison), and an empty requirement list is
   vacuously complete (nothing to be missing).
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import { isPrecacheComplete } from '../../src/integrity';

describe('isPrecacheComplete', () => {
  it('is complete when every required URL is present (extras in present are fine)', () => {
    const required = ['/a.js', '/b.css'];
    const present = new Set(['/a.js', '/b.css', '/extra-art.svg']);
    expect(isPrecacheComplete(required, present)).toBe(true);
  });

  it('is incomplete when even one required URL is missing', () => {
    const required = ['/a.js', '/b.css', '/font.woff2'];
    const present = new Set(['/a.js', '/b.css']);
    expect(isPrecacheComplete(required, present)).toBe(false);
  });

  it('is incomplete when the present set is empty (fully evicted cache)', () => {
    expect(isPrecacheComplete(['/a.js'], new Set())).toBe(false);
  });

  it('an empty required list is vacuously complete', () => {
    expect(isPrecacheComplete([], new Set())).toBe(true);
    expect(isPrecacheComplete([], new Set(['/whatever.js']))).toBe(true);
  });

  it('duplicate entries in required do not affect the result', () => {
    const required = ['/a.js', '/a.js', '/b.css'];
    expect(isPrecacheComplete(required, new Set(['/a.js', '/b.css']))).toBe(true);
    expect(isPrecacheComplete(required, new Set(['/a.js']))).toBe(false);
  });
});
