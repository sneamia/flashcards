/* =========================================================================
   restore.spec.ts — boot-time precache-integrity restore card.

   Exercises main.ts's checkPrecacheIntegrity() gate + computeDataState's
   restore precedence end-to-end, WITHOUT depending on real Service Worker
   install/precache timing or evicting a real cache entry — orchestrating
   an actually-evicted Cache Storage entry against the real SW inside a
   fresh Playwright context would be racy (the SW's install/precache and a
   deliberate post-install eviction would need to interleave exactly, on
   every CI run) and is exactly the kind of setup the task calls out as a
   flakiness risk.

   Instead, an addInitScript stubs `navigator.onLine` and `window.caches`
   (the two real browser primitives main.ts reads), driven by two
   localStorage flags the test flips across reloads. This exercises the
   EXACT same main.ts code path a real iOS eviction would hit — only the
   inputs to checkPrecacheIntegrity() are synthetic; the decision logic
   itself (isPrecacheComplete) is covered directly and unconditionally by
   tests/unit/integrity.test.ts.
   ========================================================================= */

import { test, expect, type Page } from '@playwright/test';

const OFFLINE_KEY = 'e2e-restore-offline';
const CACHE_COMPLETE_KEY = 'e2e-restore-cache-complete';

// Installed before EVERY navigation on this page (including the reloads
// main.ts itself triggers), so it re-reads the flags fresh each time.
async function installStub(page: Page): Promise<void> {
  await page.addInitScript(
    ({ offlineKey, cacheCompleteKey }) => {
      const offline = localStorage.getItem(offlineKey) === '1';
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => !offline,
      });

      // Only main.ts's `caches.match(url)` calls are stubbed; real cache
      // methods pass through untouched in case anything else needs them.
      const cacheComplete = localStorage.getItem(cacheCompleteKey) === '1';
      const realCaches = window.caches;
      Object.defineProperty(window, 'caches', {
        configurable: true,
        value: {
          match: async () => (cacheComplete ? new Response('') : undefined),
          keys: realCaches.keys.bind(realCaches),
          open: realCaches.open.bind(realCaches),
          has: realCaches.has.bind(realCaches),
          delete: realCaches.delete.bind(realCaches),
        },
      });
    },
    { offlineKey: OFFLINE_KEY, cacheCompleteKey: CACHE_COMPLETE_KEY },
  );
}

async function setFlags(page: Page, offline: boolean, cacheComplete: boolean): Promise<void> {
  await page.evaluate(
    ({ offlineKey, cacheCompleteKey, offline, cacheComplete }) => {
      localStorage.setItem(offlineKey, offline ? '1' : '0');
      localStorage.setItem(cacheCompleteKey, cacheComplete ? '1' : '0');
    },
    { offlineKey: OFFLINE_KEY, cacheCompleteKey: CACHE_COMPLETE_KEY, offline, cacheComplete },
  );
}

test.describe('restore card (precache integrity)', () => {
  test('offline + incomplete precache shows the restore card; connectivity returning recovers', async ({
    page,
  }) => {
    await installStub(page);

    // First load: flags are unset (read as offline=false, i.e. online) so
    // this is an ordinary boot — purely to get an origin + localStorage to
    // write the real test flags into before the reload that exercises the
    // gate.
    await page.goto('/');
    await expect(page.locator('#stage')).not.toHaveAttribute('data-state', 'boot');

    await setFlags(page, /* offline */ true, /* cacheComplete */ false);
    await page.reload();

    const stage = page.locator('#stage');
    // main.ts's boot() gate: offline AND an incomplete precache -> restore,
    // skipping the normal render entirely (never flashes deck_pick first).
    await expect(stage).toHaveAttribute('data-state', 'restore');
    await expect(stage).toContainText('reconnect once to restore');

    // Connectivity returns. Flip the flags first so the reload main.ts is
    // about to trigger lands on a normal boot, THEN fire the real `online`
    // event main.ts listens for -> recoverFromRestore() -> location.reload().
    await setFlags(page, /* offline */ false, /* cacheComplete */ true);
    await page.evaluate(() => window.dispatchEvent(new Event('online'))).catch(() => undefined);

    // The reload lands back on the picker (no persisted position from this
    // session) — proving the restore card is a one-shot boot condition, not
    // a permanent dead end.
    await expect(stage).toHaveAttribute('data-state', 'deck_pick', { timeout: 10_000 });
  });

  test('online at boot never shows the restore card, even with an incomplete precache', async ({
    page,
  }) => {
    await installStub(page);
    await page.goto('/');
    await expect(page.locator('#stage')).not.toHaveAttribute('data-state', 'boot');

    // Incomplete precache, but online — main.ts's gate requires BOTH, so the
    // existing "relaunch with connectivity restores it" path is trusted and
    // boot proceeds normally straight to the picker.
    await setFlags(page, /* offline */ false, /* cacheComplete */ false);
    await page.reload();

    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'deck_pick');
  });
});
