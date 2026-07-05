/* =========================================================================
   shuffle.test.ts — the pure Fisher–Yates helper (src/shuffle.ts).

   The RNG is injected, so every property below is exercised deterministically
   with a stubbed sequence — no reliance on Math.random.
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import { shuffle } from '../../src/shuffle';

// A stubbed rng that yields the given values in order, then repeats the last.
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('shuffle()', () => {
  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input, seq([0.1, 0.2, 0.3, 0.4]));
    expect(input).toEqual(copy);
  });

  it('returns a permutation (same multiset, same length)', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const out = shuffle(input, seq([0.5, 0.1, 0.9, 0.3, 0.7]));
    expect(out).toHaveLength(input.length);
    expect([...out].sort()).toEqual([...input].sort());
  });

  it('is deterministic under a fixed rng sequence', () => {
    const input = [1, 2, 3, 4];
    const rngValues = [0.99, 0.5, 0.0];
    const a = shuffle(input, seq(rngValues));
    const b = shuffle(input, seq(rngValues));
    expect(a).toEqual(b);
  });

  it('rng returning 0 rotates the last element to the front (Fisher–Yates lower bound)', () => {
    // With j = floor(0 * (i+1)) = 0 at every step, each element is swapped with
    // index 0 in turn — a well-defined, testable permutation.
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });

  it('rng returning ~1 keeps each element in place (upper bound, j === i)', () => {
    // j = floor(0.999 * (i+1)) === i for each i, so nothing moves.
    expect(shuffle([1, 2, 3, 4], () => 0.999)).toEqual([1, 2, 3, 4]);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle([], () => 0.5)).toEqual([]);
    expect(shuffle([42], () => 0.5)).toEqual([42]);
  });
});
