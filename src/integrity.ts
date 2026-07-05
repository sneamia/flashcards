/* =========================================================================
   integrity.ts — PURE precache-completeness check.

   iOS Safari can evict a PWA's Cache API storage under memory pressure or
   long non-use, leaving a stale launch pointing at assets the service
   worker won't re-fetch until the device is next online. This module is
   ONLY the decision: given a small set of URLs the app cannot render
   without and the set of URLs actually found present, is the precache
   whole? main.ts (impure) gathers both inputs via the Cache API and decides
   what to render from the boolean returned here — this module never
   touches the DOM, caches, or navigator, so it's trivially unit-testable
   and never needs a browser environment.
   ========================================================================= */

/** True only if every required URL is present. Vacuously true for an empty list. */
export function isPrecacheComplete(requiredUrls: string[], presentUrls: Set<string>): boolean {
  return requiredUrls.every((url) => presentUrls.has(url));
}
