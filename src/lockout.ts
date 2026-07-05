/* =========================================================================
   lockout.ts — PURE timestamp lockout guard.

   One DRY guard, used by machine.ts (to no-op ADVANCE during the 1000ms
   post-transition lockout) and by main.ts (to skip dispatch/async work for
   an ADVANCE it already knows will no-op). No per-state duplication.
   ========================================================================= */

/** True when `now` is still inside the lockout window started by a prior
 *  transition that set `lockUntil = someEarlierNow + LOCKOUT_MS`. */
export function isLocked(lockUntil: number, now: number): boolean {
  return now < lockUntil;
}
