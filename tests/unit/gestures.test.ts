/* =========================================================================
   gestures.test.ts — the pure pointer-event recognizer. Feeds synthetic
   GestureEvents with explicit timestamps (no real DOM/pointer events, no
   real clock) per docs/ARCHITECTURE.md's gestures.ts contract:
     - single tap (down then up, no second pointer, under LONG_PRESS_MS) -> ADVANCE
     - two pointers ever overlapping down, then all lifted -> exactly one BACK
     - a single pointer held past LONG_PRESS_MS with no second pointer -> EXIT (via poll)
     - a quick tap must never produce EXIT
   ========================================================================= */

import { describe, expect, it } from 'vitest';
import { LONG_PRESS_MS, STALE_POINTER_MS, createRecognizer } from '../../src/gestures';

describe('single-pointer tap', () => {
  it('down then up (quick, no second pointer) -> ADVANCE on up', () => {
    const r = createRecognizer();
    expect(r.handle({ kind: 'down', pointerId: 1, t: 0 })).toBeNull();
    expect(r.handle({ kind: 'up', pointerId: 1, t: 100 })).toBe('ADVANCE');
  });

  it('a quick tap must NOT produce EXIT, even if poll is called mid-gesture', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    // Polled while held, but well under the long-press threshold.
    expect(r.poll(100)).toBeNull();
    expect(r.poll(500)).toBeNull();
    expect(r.handle({ kind: 'up', pointerId: 1, t: 600 })).toBe('ADVANCE');
  });
});

describe('two-pointer overlap -> BACK (exactly once)', () => {
  it('two pointers down at once, then both lift -> one BACK, never an ADVANCE', () => {
    const r = createRecognizer();
    const results: Array<ReturnType<typeof r.handle>> = [];

    results.push(r.handle({ kind: 'down', pointerId: 1, t: 0 }));
    results.push(r.handle({ kind: 'down', pointerId: 2, t: 10 })); // overlap while p1 still down
    results.push(r.handle({ kind: 'up', pointerId: 1, t: 50 })); // one pointer still down: wait
    results.push(r.handle({ kind: 'up', pointerId: 2, t: 60 })); // last pointer lifts: resolve

    expect(results).toEqual([null, null, null, 'BACK']);
    expect(results).not.toContain('ADVANCE');
  });

  it('fires BACK once regardless of lift order', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    r.handle({ kind: 'down', pointerId: 2, t: 5 });
    // p2 lifts first this time.
    expect(r.handle({ kind: 'up', pointerId: 2, t: 40 })).toBeNull();
    expect(r.handle({ kind: 'up', pointerId: 1, t: 45 })).toBe('BACK');
  });

  it('a two-pointer session never resolves to EXIT via poll, even past LONG_PRESS_MS', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    r.handle({ kind: 'down', pointerId: 2, t: 10 }); // multi = true
    // Well past the long-press threshold, but this is a two-finger session.
    expect(r.poll(2000)).toBeNull();
    r.handle({ kind: 'up', pointerId: 1, t: 2000 });
    // One pointer remains down past the long-press threshold, but `multi`
    // was set for this whole gesture session, so poll must still not EXIT.
    expect(r.poll(3000)).toBeNull();
    expect(r.handle({ kind: 'up', pointerId: 2, t: 3000 })).toBe('BACK');
  });
});

describe('single pointer held past LONG_PRESS_MS -> EXIT (via poll)', () => {
  it('fires EXIT from poll once the hold crosses LONG_PRESS_MS, not before', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });

    expect(r.poll(LONG_PRESS_MS - 1)).toBeNull();
    expect(r.poll(LONG_PRESS_MS)).toBe('EXIT'); // >= threshold fires
  });

  it('the eventual "up" after EXIT already fired resolves to null (one action per gesture)', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    expect(r.poll(LONG_PRESS_MS)).toBe('EXIT');
    expect(r.handle({ kind: 'up', pointerId: 1, t: LONG_PRESS_MS + 50 })).toBeNull();
  });

  it('polling again after EXIT already fired does not re-fire EXIT', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    expect(r.poll(LONG_PRESS_MS)).toBe('EXIT');
    expect(r.poll(LONG_PRESS_MS + 100)).toBeNull();
  });

  it('a second pointer joining after a long hold turns the gesture into BACK, not EXIT', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    // Still under the threshold when the second pointer joins.
    expect(r.poll(500)).toBeNull();
    r.handle({ kind: 'down', pointerId: 2, t: 500 }); // now multi
    expect(r.poll(2000)).toBeNull(); // no EXIT: this session is multi now
    r.handle({ kind: 'up', pointerId: 1, t: 2000 });
    expect(r.handle({ kind: 'up', pointerId: 2, t: 2010 })).toBe('BACK');
  });
});

describe('palm rejection (3+ simultaneous pointers)', () => {
  it('a 3-finger contact resolves to nothing — never a lockout-bypassing BACK', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    r.handle({ kind: 'down', pointerId: 2, t: 5 });
    r.handle({ kind: 'down', pointerId: 3, t: 10 }); // palm
    r.handle({ kind: 'up', pointerId: 1, t: 60 });
    r.handle({ kind: 'up', pointerId: 2, t: 65 });
    expect(r.handle({ kind: 'up', pointerId: 3, t: 70 })).toBeNull();
    // The next clean two-finger tap is still a deliberate BACK.
    r.handle({ kind: 'down', pointerId: 4, t: 1000 });
    r.handle({ kind: 'down', pointerId: 5, t: 1005 });
    r.handle({ kind: 'up', pointerId: 4, t: 1050 });
    expect(r.handle({ kind: 'up', pointerId: 5, t: 1055 })).toBe('BACK');
  });

  it('a palm session never fires EXIT from poll either', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    r.handle({ kind: 'down', pointerId: 2, t: 5 });
    r.handle({ kind: 'down', pointerId: 3, t: 10 });
    r.handle({ kind: 'up', pointerId: 1, t: 20 });
    r.handle({ kind: 'up', pointerId: 2, t: 25 });
    // One pointer of the palm still down, held long — still not an EXIT.
    expect(r.poll(2000)).toBeNull();
  });
});

describe('lost-pointerup recovery (deadlock prevention)', () => {
  it('poll() expires a stale down entry so later taps work again', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 }); // its 'up' is never delivered
    expect(r.poll(LONG_PRESS_MS)).toBe('EXIT'); // legit long-press fires first
    // Long past expiry, the stale entry is dropped and the session resets…
    expect(r.poll(STALE_POINTER_MS)).toBeNull();
    // …so a fresh tap is a clean single-pointer ADVANCE, not a multi/BACK.
    r.handle({ kind: 'down', pointerId: 2, t: STALE_POINTER_MS + 100 });
    expect(r.handle({ kind: 'up', pointerId: 2, t: STALE_POINTER_MS + 150 })).toBe('ADVANCE');
  });

  it('reset() hard-clears mid-gesture state (app backgrounded)', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    r.handle({ kind: 'down', pointerId: 2, t: 5 }); // multi in progress
    r.reset();
    r.handle({ kind: 'down', pointerId: 3, t: 1000 });
    expect(r.handle({ kind: 'up', pointerId: 3, t: 1050 })).toBe('ADVANCE');
  });
});

describe("an 'up' the recognizer never saw go down", () => {
  it('is not a gesture — never a phantom ADVANCE', () => {
    const r = createRecognizer();
    expect(r.handle({ kind: 'up', pointerId: 7, t: 100 })).toBeNull();
  });

  it('does not disturb an in-progress gesture from another pointer', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    expect(r.handle({ kind: 'up', pointerId: 99, t: 50 })).toBeNull(); // stray up
    expect(r.handle({ kind: 'up', pointerId: 1, t: 100 })).toBe('ADVANCE');
  });
});

describe('cancel', () => {
  it('cancel after EXIT already fired resets the session for the next tap', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    expect(r.poll(LONG_PRESS_MS)).toBe('EXIT');
    expect(r.handle({ kind: 'cancel', pointerId: 1 })).toBeNull();
    // A fresh tap afterward must read as a clean ADVANCE (exited cleared).
    r.handle({ kind: 'down', pointerId: 2, t: 2000 });
    expect(r.handle({ kind: 'up', pointerId: 2, t: 2050 })).toBe('ADVANCE');
  });

  it('cancelling both pointers of a two-finger session clears multi for the next tap', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    r.handle({ kind: 'down', pointerId: 2, t: 5 }); // multi = true
    r.handle({ kind: 'cancel', pointerId: 1 });
    expect(r.handle({ kind: 'cancel', pointerId: 2 })).toBeNull();
    r.handle({ kind: 'down', pointerId: 3, t: 1000 });
    expect(r.handle({ kind: 'up', pointerId: 3, t: 1050 })).toBe('ADVANCE');
  });

  it('cancelling the only down pointer resets the session with no action', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    expect(r.handle({ kind: 'cancel', pointerId: 1 })).toBeNull();
    // A fresh gesture afterward behaves like a clean single tap.
    r.handle({ kind: 'down', pointerId: 2, t: 10 });
    expect(r.handle({ kind: 'up', pointerId: 2, t: 60 })).toBe('ADVANCE');
  });

  it('cancelling one of two overlapping pointers still lets the other resolve normally', () => {
    const r = createRecognizer();
    r.handle({ kind: 'down', pointerId: 1, t: 0 });
    r.handle({ kind: 'down', pointerId: 2, t: 5 }); // multi = true
    r.handle({ kind: 'cancel', pointerId: 1 }); // one pointer leaves without an 'up'
    // Pointer 2 is still the only one down; multi stays true for this session.
    expect(r.handle({ kind: 'up', pointerId: 2, t: 100 })).toBe('BACK');
  });
});
