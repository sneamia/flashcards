/* =========================================================================
   gestures.ts — PURE pointer-event -> parent-gesture recognizer.

   Recognizes exactly three parent inputs from raw pointer events and maps
   them to actions. No DOM listeners live in here — main.ts owns the actual
   `addEventListener` calls and feeds this module plain event records, which
   is what keeps it a small, synchronous, unit-testable state machine (the
   eng review's preferred path was a maintained gesture library; this stays
   PURE and dependency-free instead, honoring the same underlying goal of
   reliable multi-touch disambiguation — swapping in a library later is a
   drop-in change behind this same `Recognizer` interface).

   Recognition rules:
   - A single pointer that goes down then up, without a second pointer ever
     joining, and without crossing LONG_PRESS_MS   -> ADVANCE (on 'up').
   - Two pointers ever down at the same time during one gesture (regardless
     of the few-ms gap between their individual `down`s — that overlap IS
     the "within a small window" case) then all pointers lifted -> BACK,
     fired exactly once when the LAST pointer of the gesture lifts.
   - A single pointer held down past LONG_PRESS_MS, with no second pointer
     ever joining -> EXIT, fired from poll() (there is no 'up' to key off).
     Once EXIT has fired for a gesture, its eventual 'up' (and any pointers
     that join afterward) resolve to null — one action per gesture.
   ========================================================================= */

export type GestureEvent =
  | { kind: 'down'; pointerId: number; t: number }
  | { kind: 'up'; pointerId: number; t: number }
  | { kind: 'cancel'; pointerId: number };

export type GestureAction = 'ADVANCE' | 'BACK' | 'EXIT' | null;

export const LONG_PRESS_MS = 800;

// A pointer whose 'up'/'cancel' was lost (target removed mid-press, app
// backgrounded mid-hold) must not linger: a stale entry would make every
// later tap read as multi-touch and deadlock ALL input until relaunch.
export const STALE_POINTER_MS = 10_000;

export interface Recognizer {
  handle(e: GestureEvent): GestureAction; // returns an action when a gesture completes, else null
  poll(now: number): GestureAction; // main.ts calls on a timer so long-press fires without an 'up'
  reset(): void; // hard-clear all session state (e.g. when the app is backgrounded)
}

export function createRecognizer(): Recognizer {
  // Pointers currently held down in this gesture session: pointerId -> down timestamp.
  const down = new Map<number, number>();
  // This session ever saw 2+ simultaneous pointers (a two-finger tap in progress/done).
  let multi = false;
  // This session ever saw 3+ simultaneous pointers — that's a palm/slap, not
  // a deliberate parent two-finger tap. BACK bypasses the lockout, so a
  // toddler palm resolving to BACK would walk the deck backward at full
  // speed; a 3+ session resolves to nothing instead.
  let palm = false;
  // poll() already fired EXIT for this session — suppresses the eventual 'up'.
  let exited = false;

  function resetIfIdle(): void {
    if (down.size === 0) {
      multi = false;
      palm = false;
      exited = false;
    }
  }

  // Evict any pointer whose terminating event was lost (see STALE_POINTER_MS).
  // Runs on poll() AND at the start of the next 'down' so recovery no longer
  // depends on a periodic timer: the very next interaction heals a stuck
  // session before a phantom pointer can misread it as multi-touch.
  function sweepStale(now: number): void {
    for (const [id, t] of down) {
      if (now - t >= STALE_POINTER_MS) down.delete(id);
    }
    resetIfIdle();
  }

  function handle(e: GestureEvent): GestureAction {
    if (e.kind === 'down') {
      sweepStale(e.t);
      down.set(e.pointerId, e.t);
      if (down.size >= 2) multi = true;
      if (down.size >= 3) palm = true;
      return null;
    }

    if (e.kind === 'cancel') {
      down.delete(e.pointerId);
      resetIfIdle();
      return null;
    }

    // e.kind === 'up'
    // An 'up' for a pointer this session never saw go down (e.g. a touch that
    // began before listeners attached, or off-stage) is not a gesture — never
    // let it resolve to a phantom ADVANCE/BACK.
    if (!down.has(e.pointerId)) return null;
    down.delete(e.pointerId);
    if (down.size > 0) return null; // wait for every pointer in the gesture to lift

    const result: GestureAction = exited || palm ? null : multi ? 'BACK' : 'ADVANCE';
    multi = false;
    palm = false;
    exited = false;
    return result;
  }

  function reset(): void {
    down.clear();
    multi = false;
    palm = false;
    exited = false;
  }

  function poll(now: number): GestureAction {
    // Expire pointers whose terminating event was lost — see STALE_POINTER_MS.
    // (A legitimately held pointer has long since fired EXIT at 800ms; its
    // entry is inert by now, so dropping it changes nothing for real holds.)
    sweepStale(now);

    // EXIT only applies to a single held pointer that never got a second
    // pointer joining it — a two-finger session is resolving as BACK, not EXIT.
    if (down.size === 1 && !multi && !exited) {
      let downT = 0;
      for (const t of down.values()) {
        downT = t;
        break;
      }
      if (now - downT >= LONG_PRESS_MS) {
        exited = true;
        return 'EXIT';
      }
    }
    return null;
  }

  return { handle, poll, reset };
}
