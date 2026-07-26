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
   (the two real browser primitives main.ts reads), driven by localStorage
   flags the test flips across reloads (and, for onLine, live mid-page — see
   below). This exercises the EXACT same main.ts code path a real iOS
   eviction would hit — only the inputs to checkPrecacheIntegrity() are
   synthetic; the decision logic itself (isPrecacheComplete) is covered
   directly and unconditionally by tests/unit/integrity.test.ts.

   The caches stub has three modes (a `cachesMode` flag, not just the
   boolean `cacheComplete`), because gatherPresentUrls (main.ts) has three
   distinct code paths worth exercising independently: the ordinary
   present/absent probe ('stub'), the Cache API being genuinely unavailable
   ('absent' — a real WebIDL prototype deletion, not just an empty stub, so
   `'caches' in window` is actually false), and every probe throwing
   ('throw' — the private-mode-quirk catch branch). Each new test asserts
   its precondition directly (`'caches' in window` / a probe actually
   throwing) so a broken stub can't let a test pass through the ordinary
   incomplete-precache path and prove nothing about the branch it targets.
   ========================================================================= */

import { test, expect, type Page } from '@playwright/test';

const OFFLINE_KEY = 'e2e-restore-offline';
const CACHE_COMPLETE_KEY = 'e2e-restore-cache-complete';
const CACHES_MODE_KEY = 'e2e-restore-caches-mode';

type CachesMode = 'stub' | 'absent' | 'throw';

// Installed before EVERY navigation on this page (including the reloads
// main.ts itself triggers), so it re-reads the flags fresh each time.
async function installStub(page: Page): Promise<void> {
  await page.addInitScript(
    ({ offlineKey, cacheCompleteKey, cachesModeKey }) => {
      // Read LIVE on every access (not captured once at init): the
      // visibilitychange-recovery test flips this flag mid-page, with no
      // reload, and expects main.ts's live `navigator.onLine` read inside
      // the visibilitychange handler to see the new value immediately.
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => localStorage.getItem(offlineKey) !== '1',
      });

      const cachesMode = (localStorage.getItem(cachesModeKey) as 'stub' | 'absent' | 'throw' | null) ?? 'stub';

      if (cachesMode === 'absent') {
        // Spiked against both engines this suite runs under (webkit and
        // chromium, via a throwaway script launching each against this app's
        // preview server): on a secure-context origin (localhost or https —
        // the Cache API is unavailable at all on insecure origins, which is
        // NOT the "absent" case this models), `caches` turns out to be a
        // configurable OWN property of the `window` instance here, not a
        // shared WebIDL prototype accessor — so a plain `delete` actually
        // works, verified via `Object.getOwnPropertyDescriptor(window,
        // 'caches').configurable === true` and `'caches' in window === false`
        // afterward in that spike. (A prototype-chain deletion — e.g.
        // `Reflect.deleteProperty(Object.getPrototypeOf(window), 'caches')`
        // — does NOT work here: `caches` isn't on the prototype at all, so
        // that call is a silent no-op and `'caches' in window` stays true.)
        // The test itself still asserts the precondition rather than trust
        // this comment, in case that ever drifts with a browser update.
        delete (window as unknown as { caches?: unknown }).caches;
        return;
      }

      // Only main.ts's `caches.match(url)` calls are stubbed; real cache
      // methods pass through untouched in case anything else needs them.
      const cacheComplete = localStorage.getItem(cacheCompleteKey) === '1';
      const realCaches = window.caches;
      Object.defineProperty(window, 'caches', {
        configurable: true,
        value: {
          match: async (_req: RequestInfo | URL, opts?: CacheQueryOptions) => {
            if (cachesMode === 'throw') {
              // Models a private-mode-style quirk where Cache Storage reads
              // reject instead of resolving. gatherPresentUrls' try/catch
              // around this call must leave the URL unmarked rather than
              // propagate, so the precache correctly reads as incomplete.
              throw new Error('e2e-restore stub: caches.match throws');
            }
            // Models Workbox faithfully: every precached font/art SVG is
            // stored under a cache key carrying a `?__WB_REVISION__=<hash>`
            // query param the app's requested URL lacks. So an intact
            // precache is only discoverable with { ignoreSearch: true } — a
            // query-exact `caches.match(url)` (the pre-fix bug) misses those
            // entries and reports the precache incomplete even when it's
            // whole. This guards the fix: drop ignoreSearch and the "intact
            // precache" case regresses to the restore card.
            return cacheComplete && opts?.ignoreSearch ? new Response('') : undefined;
          },
          keys: realCaches.keys.bind(realCaches),
          open: realCaches.open.bind(realCaches),
          has: realCaches.has.bind(realCaches),
          delete: realCaches.delete.bind(realCaches),
        },
      });
    },
    { offlineKey: OFFLINE_KEY, cacheCompleteKey: CACHE_COMPLETE_KEY, cachesModeKey: CACHES_MODE_KEY },
  );
}

async function setFlags(
  page: Page,
  offline: boolean,
  cacheComplete: boolean,
  cachesMode: CachesMode = 'stub',
): Promise<void> {
  await page.evaluate(
    ({ offlineKey, cacheCompleteKey, cachesModeKey, offline, cacheComplete, cachesMode }) => {
      localStorage.setItem(offlineKey, offline ? '1' : '0');
      localStorage.setItem(cacheCompleteKey, cacheComplete ? '1' : '0');
      localStorage.setItem(cachesModeKey, cachesMode);
    },
    {
      offlineKey: OFFLINE_KEY,
      cacheCompleteKey: CACHE_COMPLETE_KEY,
      cachesModeKey: CACHES_MODE_KEY,
      offline,
      cacheComplete,
      cachesMode,
    },
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

  test('offline + intact (revisioned) precache boots normally, not to the restore card', async ({
    page,
  }) => {
    await installStub(page);
    await page.goto('/');
    await expect(page.locator('#stage')).not.toHaveAttribute('data-state', 'boot');

    // Offline AND a fully intact precache — but the stub only surfaces its
    // entries via { ignoreSearch: true } (the revisioned-cache-key reality).
    // gatherPresentUrls must probe with ignoreSearch, or the fonts/art read
    // as absent and this regresses to 'restore' on a healthy offline launch.
    await setFlags(page, /* offline */ true, /* cacheComplete */ true);
    await page.reload();

    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'deck_pick');
  });

  test('backgrounded reconnect recovers via visibilitychange even when the online event never fires (P1.2(a))', async ({
    page,
  }) => {
    await installStub(page);
    await page.goto('/');
    await expect(page.locator('#stage')).not.toHaveAttribute('data-state', 'boot');

    await setFlags(page, /* offline */ true, /* cacheComplete */ false);
    await page.reload();

    const stage = page.locator('#stage');
    await expect(stage).toHaveAttribute('data-state', 'restore');
    await expect(stage).toContainText('reconnect once to restore');

    // Model the family's real fix action: background the PWA, toggle Wi-Fi,
    // come back. A thawed/backgrounded page can coalesce or drop the `online`
    // event entirely, so recovery can't depend on it alone. Flip connectivity
    // LIVE (no reload — the onLine stub now reads its flag fresh on every
    // access) and fire ONLY `visibilitychange`, deliberately withholding
    // `online`, to prove main.ts's visibilitychange re-check is what recovers
    // here, not a coincidental online event.
    await setFlags(page, /* offline */ false, /* cacheComplete */ true);

    // document.visibilityState is already 'visible' in a fresh Playwright
    // page (the tab is never actually backgrounded by the test) — verify
    // that rather than assume it, since a hidden state would make this
    // firing a correct no-op instead of the recovery this test wants.
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible');

    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    // The reload lands back on the picker — proving visibilitychange alone
    // (with online never firing) recovers the restore card.
    await expect(stage).toHaveAttribute('data-state', 'deck_pick', { timeout: 10_000 });
  });

  test("offline boot with the Cache API genuinely absent shows the restore card (P4.14, gatherPresentUrls' !('caches' in window) branch)", async ({
    page,
  }) => {
    await installStub(page);
    await page.goto('/');
    await expect(page.locator('#stage')).not.toHaveAttribute('data-state', 'boot');

    await setFlags(page, /* offline */ true, /* cacheComplete */ false, 'absent');
    await page.reload();

    // Precondition: prove the Cache API is actually gone, not merely a stub
    // reporting nothing present. Without this, a broken 'absent' stub could
    // fall through to the ordinary incomplete-precache path and this test
    // would pass without ever exercising gatherPresentUrls' early-return
    // branch.
    expect(await page.evaluate(() => 'caches' in window)).toBe(false);

    const stage = page.locator('#stage');
    await expect(stage).toHaveAttribute('data-state', 'restore');
    await expect(stage).toContainText('reconnect once to restore');
  });

  test('offline boot where caches.match throws on every probe shows the restore card (P4.14, the private-mode-quirk catch branch)', async ({
    page,
  }) => {
    await installStub(page);
    await page.goto('/');
    await expect(page.locator('#stage')).not.toHaveAttribute('data-state', 'boot');

    // cacheComplete=true deliberately: if the throw/catch in gatherPresentUrls
    // ever regressed to swallowing the throw AND reporting present, this
    // would be the combination that would let it slip through unnoticed.
    await setFlags(page, /* offline */ true, /* cacheComplete */ true, 'throw');
    await page.reload();

    // Precondition: prove the probe actually throws rather than assuming the
    // stub wiring did what it claims — otherwise this test could pass
    // vacuously through some other path.
    const probeThrew = await page.evaluate(async () => {
      try {
        await caches.match('/');
        return false;
      } catch {
        return true;
      }
    });
    expect(probeThrew).toBe(true);

    const stage = page.locator('#stage');
    await expect(stage).toHaveAttribute('data-state', 'restore');
    await expect(stage).toContainText('reconnect once to restore');
  });
});
