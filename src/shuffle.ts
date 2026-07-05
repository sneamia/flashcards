/* =========================================================================
   shuffle.ts — a single pure helper: a non-mutating Fisher–Yates shuffle.

   The RNG is INJECTED (not `Math.random` inline) so the function is pure and
   deterministically unit-testable: main.ts calls it with `Math.random`; tests
   pass a stubbed sequence. This keeps randomness out of machine.ts entirely —
   the shuffled deck is built here and handed to the reducer as an ordinary,
   already-ordered card list it walks by index like any other deck.
   ========================================================================= */

/**
 * Return a new array that is a random permutation of `items`.
 * Does NOT mutate the input. `rng` must return a float in [0, 1) (the
 * `Math.random` contract).
 */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
