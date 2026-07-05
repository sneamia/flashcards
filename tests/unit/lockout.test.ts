/* =========================================================================
   lockout.test.ts — boundary cases for the one pure timestamp guard.

   isLocked(lockUntil, now) === now < lockUntil (strict). The boundary at
   now === lockUntil matters: the lockout window is half-open, so the exact
   millisecond the lock expires must already read as UNLOCKED (a caller
   dispatching again at exactly `lockUntil` must succeed, not still block).
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import { isLocked } from '../../src/lockout';

describe('isLocked', () => {
  it('is locked when now < lockUntil', () => {
    expect(isLocked(1000, 999)).toBe(true);
    expect(isLocked(1000, 0)).toBe(true);
  });

  it('is NOT locked when now === lockUntil (half-open boundary)', () => {
    expect(isLocked(1000, 1000)).toBe(false);
  });

  it('is NOT locked when now > lockUntil', () => {
    expect(isLocked(1000, 1001)).toBe(false);
    expect(isLocked(1000, 5000)).toBe(false);
  });

  it('treats lockUntil = 0 (initialState) as already unlocked for any now >= 0', () => {
    expect(isLocked(0, 0)).toBe(false);
    expect(isLocked(0, 1)).toBe(false);
  });
});
