/* =========================================================================
   flows.spec.ts — browser-behavior flows (Eng Decision #5). These exercise
   real DOM/pointer/touch behavior that machine.ts's pure unit tests cannot:
   the 1000ms lockout under real rapid taps, the orientation-driven rotate
   overlay, a real tap dispatching through gestures.ts + main.ts, and
   localStorage-backed resume across a reload.

   Config: playwright.config.ts's single project ("mobile-landscape") uses
   devices['iPhone 13 landscape'], which is a real touch-capable mobile
   emulation profile (hasTouch: true) — so `locator.tap()` / `page.touchscreen`
   drive genuine touch/pointer events through main.ts's pointerdown/up
   listeners, exactly like a parent's finger would.

   #stage's `data-state` attribute is the ground truth for screen/beat:
     deck_pick | word | image | end | rotate | about
   (see docs/ARCHITECTURE.md's `main.ts` section / computeDataState()).
   ========================================================================= */

import { test, expect, type Page } from '@playwright/test';
import { LOCKOUT_MS } from '../../src/machine';
// Always wait strictly longer than the lockout window before an intended
// second advance, to absorb clock/scheduling jitter in CI.
const SAFE_WAIT_MS = LOCKOUT_MS + 200;

async function waitForBoot(page: Page): Promise<void> {
  // main.ts sets data-state="boot" in the HTML shell, then flips it to
  // 'deck_pick' (or a rehydrated 'word') once fonts are ready and the
  // first render happens. Never assert against the literal 'boot' value.
  await expect(page.locator('#stage')).not.toHaveAttribute('data-state', 'boot');
}

async function openFirstDeck(page: Page): Promise<void> {
  // Open the "sh" deck by its stable data hook (the picker now groups decks
  // under category headers, so row position is no longer fixed). sh's first
  // card ("ship") has an image (two-beat reveal).
  await page.locator('#stage .row[data-deck-id="sh"]').tap();
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'word');
}

test.describe('rapid-tap defense', () => {
  test('many fast taps on the first WORD do not skip past the 1000ms lockout', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);

    // Landing on the card just set lockUntil = now + 1000ms. Hammer taps
    // immediately and fast — every one of them should be a silent no-op
    // per machine.ts's `handleAdvance` -> `locked()` guard. Bound the
    // hammering by ELAPSED TIME, not tap count: on a slow CI runner a
    // count-based loop can leak a tap past the lockout window, making the
    // test flaky rather than proving the defense. Stop well short of the
    // window's edge so every tap provably lands inside it.
    const stage = page.locator('#stage');
    const t0 = Date.now();
    let taps = 0;
    while (Date.now() - t0 < LOCKOUT_MS - 250) {
      await stage.tap({ position: { x: 50, y: 50 } });
      taps++;
    }
    expect(taps).toBeGreaterThan(2); // sanity: we actually hammered

    // Still the very first card, still on its WORD beat — never advanced to
    // the image beat, and never skipped to card 2.
    await expect(stage).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .word')).toHaveText('ship');
    await expect(page.locator('#stage .corner')).toHaveText('sh · 1 of 10');
  });

  test('a tap AFTER the lockout clears does advance normally', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);

    await page.waitForTimeout(SAFE_WAIT_MS);
    await page.locator('#stage').tap();

    // "ship" has an image, so the first post-lockout tap reveals it.
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'image');
  });
});

test.describe('rotate card', () => {
  test('portrait shows the rotate card; returning to landscape resumes the underlying state unchanged', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);

    // Confirm we're mid-flow before rotating, so we can prove resume-unchanged.
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .corner')).toHaveText('sh · 1 of 10');

    const landscapeSize = page.viewportSize();
    expect(landscapeSize).not.toBeNull();

    // Flip to a portrait viewport (width < height) to trigger the
    // `(orientation: portrait)` media query main.ts listens on.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'rotate');
    await expect(page.locator('#stage')).toContainText('turn the phone sideways');

    // Rotating back to landscape must resume the SAME state — same card,
    // same beat — per success criterion 6 (rotate never resets progress).
    // (Restore the captured landscape size as-is — swapping ITS dimensions
    // would produce a portrait viewport again.)
    await page.setViewportSize(landscapeSize!);
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .corner')).toHaveText('sh · 1 of 10');
    await expect(page.locator('#stage .word')).toHaveText('ship');
  });

  test('input is suppressed while the rotate overlay is showing', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);

    const landscapeSize = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'rotate');

    // Wait out the lockout, then tap repeatedly while portrait — per
    // main.ts's `handleRecognized`, `isPortrait` suppresses all dispatch.
    await page.waitForTimeout(SAFE_WAIT_MS);
    await page.locator('#stage').tap();
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'rotate');

    await page.setViewportSize(landscapeSize!);
    // Taps while rotated never reached the reducer, so we're still on the
    // original word beat, not advanced to the image beat.
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'word');
  });
});

test.describe('gesture-on-touch', () => {
  test('a normal tap advances one beat', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);

    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'word');
    await page.waitForTimeout(SAFE_WAIT_MS);

    await page.locator('#stage').tap();

    // word -> image (ship has an img), a single beat forward, not two.
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'image');
    await expect(page.locator('#stage .word')).toHaveText('ship');
  });

  test('two-finger tap goes BACK one beat, bypassing the lockout', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);
    await page.waitForTimeout(SAFE_WAIT_MS);

    const stage = page.locator('#stage');
    await stage.tap();
    await expect(stage).toHaveAttribute('data-state', 'image');

    // Two overlapping pointers, then both lift — immediately after the
    // transition, i.e. INSIDE the fresh lockout window BACK must bypass.
    await stage.dispatchEvent('pointerdown', { pointerId: 51, isPrimary: true });
    await stage.dispatchEvent('pointerdown', { pointerId: 52 });
    await stage.dispatchEvent('pointerup', { pointerId: 51 });
    await stage.dispatchEvent('pointerup', { pointerId: 52 });

    await expect(stage).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .corner')).toHaveText('sh · 1 of 10');
  });

  test('long-press inside a deck exits to the picker', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);

    const stage = page.locator('#stage');
    await stage.dispatchEvent('pointerdown', { pointerId: 61, isPrimary: true });
    // EXIT fires from the poll timer once the hold crosses LONG_PRESS_MS.
    await expect(stage).toHaveAttribute('data-state', 'deck_pick', { timeout: 3000 });
    await stage.dispatchEvent('pointerup', { pointerId: 61 }); // suppressed post-EXIT
    await expect(stage).toHaveAttribute('data-state', 'deck_pick');
  });

  test('long-press on the picker opens the about overlay; a tap dismisses it', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);

    const stage = page.locator('#stage');
    await stage.dispatchEvent('pointerdown', { pointerId: 71, isPrimary: true });
    await expect(stage).toHaveAttribute('data-state', 'about', { timeout: 3000 });
    await stage.dispatchEvent('pointerup', { pointerId: 71 });

    // The overlay carries the full gesture list AND the CC BY-SA attribution.
    await expect(stage).toContainText('two-finger tap: back');
    await expect(stage).toContainText('OpenMoji');

    // DISMISS is a parent gesture — it bypasses the lockout, so an immediate
    // tap closes the overlay.
    await stage.tap();
    await expect(stage).toHaveAttribute('data-state', 'deck_pick');
  });
});

test.describe('pointer-cancel release path (iOS pointer-steal)', () => {
  test('a pointercancel releases main\'s pointer bookkeeping: the next tap advances AND long-press EXIT still arms', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);
    await page.waitForTimeout(SAFE_WAIT_MS);

    const stage = page.locator('#stage');
    // iOS can steal an in-progress touch for a system gesture (e.g. Control
    // Center) and deliver pointercancel instead of pointerup. onPointerCancel
    // (main.ts) must feed the recognizer a 'cancel' AND call
    // releasePointer(), which clears main.ts's OWN downPointerIds/exit-timer
    // bookkeeping. Nothing will ever complete that pointer — its real
    // up/cancel already happened — so without the release it sits in
    // downPointerIds for the full STALE_POINTER_MS (10s, gestures.ts).
    //
    // What that stale entry actually breaks is EXIT ARMING, not ADVANCE:
    // gestures.ts is the sole source of gesture actions, so main's own map
    // can never block an ADVANCE. But onPointerDown sees
    // downPointerIds.size >= 2 for the next 10s, latches sessionBlocked and
    // calls clearExitTimer() instead of armExitTimer() — so the parent's
    // long-press-to-exit is DEAD for 10 seconds and the child is stuck in the
    // deck with no way out. That is the failure mode the EXIT assertion at
    // the bottom of this test guards; the ADVANCE assertions document the
    // happy path but cannot detect the regression on their own.
    //
    // Dispatch the cancel PROMPTLY: LONG_PRESS_MS is 800ms (gestures.ts) — a
    // bare pointerdown held that long fires EXIT to the picker regardless of
    // what happens next.
    await stage.dispatchEvent('pointerdown', { pointerId: 111, isPrimary: true });
    await stage.dispatchEvent('pointercancel', { pointerId: 111 });

    // Still mid-deck, still on the word beat — the cancel itself must not
    // have been misread as ADVANCE, BACK, or a (stale-timer) EXIT.
    await expect(stage).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .corner')).toHaveText('sh · 1 of 10');

    // A fresh, ordinary tap afterward reads as a clean single-pointer gesture
    // and advances exactly one beat.
    await stage.tap();
    await expect(stage).toHaveAttribute('data-state', 'image');
    await expect(page.locator('#stage .word')).toHaveText('ship');

    // The discriminator: a long press must still reach the picker. With the
    // cancelled pointer left in downPointerIds, this down is main's SECOND
    // pointer — no EXIT timer is armed, nothing polls the recognizer, and the
    // hold never resolves. (Same shape as 'long-press inside a deck exits to
    // the picker' above, including releasing the pointer afterward so no
    // dangling pointer is left for later tests/timers.)
    await stage.dispatchEvent('pointerdown', { pointerId: 112, isPrimary: true });
    await expect(stage).toHaveAttribute('data-state', 'deck_pick', { timeout: 3000 });
    await stage.dispatchEvent('pointerup', { pointerId: 112 }); // suppressed post-EXIT
    await expect(stage).toHaveAttribute('data-state', 'deck_pick');
  });
});

test.describe('visibilitychange resets stale pointer tracking', () => {
  test('going hidden mid-gesture resets main\'s pointer bookkeeping: the next tap advances AND long-press EXIT still arms', async ({
    page,
  }) => {
    // Override document.visibilityState with a configurable getter BEFORE
    // main.ts loads (page.addInitScript runs ahead of any page script), so
    // flipping "hidden" later is a single fast page.evaluate rather than
    // something dependent on a real OS-level backgrounding event (which
    // Playwright cannot simulate) or a slow real timer.
    await page.addInitScript(() => {
      (window as unknown as { __hidden: boolean }).__hidden = false;
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get(): string {
          return (window as unknown as { __hidden: boolean }).__hidden ? 'hidden' : 'visible';
        },
      });
    });

    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);
    await page.waitForTimeout(SAFE_WAIT_MS);

    const stage = page.locator('#stage');
    // A pointer goes down but never lifts — iOS may never deliver the
    // terminating pointerup/pointercancel for a gesture interrupted by the
    // app being backgrounded (see setupWakeLockReacquire's comment in
    // main.ts). Dispatch PROMPTLY: LONG_PRESS_MS is 800ms (gestures.ts) —
    // left down that long it would fire EXIT to the picker regardless of what
    // happens next.
    await stage.dispatchEvent('pointerdown', { pointerId: 211, isPrimary: true });

    // Flip the flag and fire the real event setupWakeLockReacquire is
    // listening for. Its hidden branch does two things: recognizer.reset()
    // (gestures.ts's own bookkeeping) and resetPointerTracking() (main.ts's
    // downPointerIds map + armed exit timer). This test targets the SECOND
    // one: pointerId 211's terminating pointerup/cancel never arrives in this
    // scenario, exactly like a real backgrounded gesture, so without
    // resetPointerTracking() it sits in downPointerIds for the full
    // STALE_POINTER_MS (10s, gestures.ts).
    await page.evaluate(() => {
      (window as unknown as { __hidden: boolean }).__hidden = true;
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // The visibilitychange handling itself dispatches nothing to the
    // reducer — still mid-deck, still on the word beat.
    await expect(stage).toHaveAttribute('data-state', 'word');

    // A fresh, ordinary tap reads as a clean single-pointer gesture and
    // advances one beat. (This alone does NOT prove resetPointerTracking()
    // ran: gestures.ts is the sole source of gesture actions, so a stale
    // entry in main's own map can never block an ADVANCE.)
    await stage.tap();
    await expect(stage).toHaveAttribute('data-state', 'image');
    await expect(page.locator('#stage .word')).toHaveText('ship');

    // The discriminator — what a stale downPointerIds entry actually breaks is
    // EXIT ARMING. onPointerDown would see downPointerIds.size >= 2 for the
    // next 10s, latch sessionBlocked and clearExitTimer() instead of
    // armExitTimer(), so the parent's long-press-to-exit is dead for 10
    // seconds after any backgrounded gesture — a child stuck in a deck with no
    // way out. (Same shape as 'long-press inside a deck exits to the picker'
    // above, including releasing the pointer afterward.)
    await stage.dispatchEvent('pointerdown', { pointerId: 212, isPrimary: true });
    await expect(stage).toHaveAttribute('data-state', 'deck_pick', { timeout: 3000 });
    await stage.dispatchEvent('pointerup', { pointerId: 212 }); // suppressed post-EXIT
    await expect(stage).toHaveAttribute('data-state', 'deck_pick');
  });
});

test.describe('long-press timer scoping (battery)', () => {
  test('no always-on poll interval, and the long-press timer is cleared once a quick tap releases', async ({
    page,
  }) => {
    // Instrument the timer globals BEFORE main.ts loads (page.addInitScript
    // runs ahead of any page script) so we can observe its actual timer
    // usage rather than just its externally-visible behavior:
    //   (a) it must never fall back to setInterval — the old always-on
    //       100ms poll this change removes — and
    //   (b) the ~800ms setTimeout it arms on pointerdown for long-press EXIT
    //       must be cleared once the pointer releases, not merely left
    //       pending until it naturally expires (that leftover wakeup is
    //       exactly what "zero idle wakeups" rules out).
    await page.addInitScript(() => {
      const w = window as unknown as {
        __intervalCalls: number;
        __pendingLongPressTimers: Set<number>;
      };
      w.__intervalCalls = 0;
      const realSetInterval = window.setInterval.bind(window);
      window.setInterval = ((...args: Parameters<typeof window.setInterval>) => {
        w.__intervalCalls++;
        return realSetInterval(...args);
      }) as typeof window.setInterval;

      // Only the long-press EXIT timer's delay falls in this narrow band —
      // the app's other timeouts (font-ready ~1500ms, image-decode ~2000ms)
      // sit well outside it, so this isolates the timer under test without
      // hardcoding its exact internal pad.
      w.__pendingLongPressTimers = new Set<number>();
      const realSetTimeout = window.setTimeout.bind(window);
      const realClearTimeout = window.clearTimeout.bind(window);
      window.setTimeout = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) => {
        const id = realSetTimeout(handler, timeout, ...rest) as unknown as number;
        if (typeof timeout === 'number' && timeout >= 800 && timeout <= 900) {
          w.__pendingLongPressTimers.add(id);
        }
        return id;
      }) as typeof window.setTimeout;
      window.clearTimeout = ((id?: number) => {
        if (id !== undefined) w.__pendingLongPressTimers.delete(id);
        return realClearTimeout(id);
      }) as typeof window.clearTimeout;
    });

    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);
    await page.waitForTimeout(SAFE_WAIT_MS);

    const stage = page.locator('#stage');
    // An ordinary quick tap — a single pointer straight down then back up.
    await stage.dispatchEvent('pointerdown', { pointerId: 91, isPrimary: true });
    await stage.dispatchEvent('pointerup', { pointerId: 91 });
    await expect(stage).toHaveAttribute('data-state', 'image');

    const pendingAfterRelease = await page.evaluate(
      () =>
        (window as unknown as { __pendingLongPressTimers: Set<number> }).__pendingLongPressTimers
          .size,
    );
    expect(pendingAfterRelease).toBe(0); // the released pointer left no dangling timer

    const intervalCalls = await page.evaluate(
      () => (window as unknown as { __intervalCalls: number }).__intervalCalls,
    );
    expect(intervalCalls).toBe(0); // no always-on poll interval anywhere
  });
});

test.describe('image-failure fallback', () => {
  test('a card whose art fails to load degrades to a one-beat word card', async ({ page }) => {
    // Abort the first card's art request — decode() rejects, and the card
    // must render image-free (word -> next card's word), never a broken frame.
    await page.route('**/art/ship.svg', (route) => route.abort());
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);
    await page.waitForTimeout(SAFE_WAIT_MS);

    const stage = page.locator('#stage');
    await stage.tap();
    await expect(stage).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .corner')).toHaveText('sh · 2 of 10');
  });
});

test.describe('end card', () => {
  test('finishing a deck shows "the end", clears the resume position, and returns to the picker', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForBoot(page);

    // wh is the shortest deck (7 cards): whip(img), whiz, wham, when,
    // wheel(img), whale(img), whisk — 4 image cards x 2 taps + 3 no-image
    // cards x 1 tap = 11 taps to reach 'end'.
    await page.locator('#stage .row[data-deck-id="wh"]').tap();
    const stage = page.locator('#stage');
    await expect(stage).toHaveAttribute('data-state', 'word');

    for (let i = 0; i < 15 && (await stage.getAttribute('data-state')) !== 'end'; i++) {
      await page.waitForTimeout(SAFE_WAIT_MS);
      await stage.tap();
    }
    await expect(stage).toHaveAttribute('data-state', 'end');
    await expect(stage).toContainText('the end');
    await expect(page.locator('#stage .corner')).toHaveCount(0); // no counter on the end card

    // The session is closed: the persisted position is cleared, so a
    // relaunch lands on the picker, not inside the finished deck.
    const persisted = await page.evaluate(() => localStorage.getItem('potty-flashcards:position'));
    expect(persisted).toBeNull();

    await page.waitForTimeout(SAFE_WAIT_MS);
    await stage.tap();
    await expect(stage).toHaveAttribute('data-state', 'deck_pick');

    await page.reload();
    await waitForBoot(page);
    await expect(stage).toHaveAttribute('data-state', 'deck_pick');
  });
});

test.describe('categories + shuffle-all', () => {
  test('the picker groups decks under category headers, each with a shuffle-all row', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);

    const stage = page.locator('#stage');
    // Category headers (CVC, Digraphs, Blends, Long Vowels).
    await expect(stage.locator('.cat')).toHaveText(['CVC', 'Digraphs', 'Blends', 'Long Vowels']);
    // One shuffle row per category (4 categories as of v1.7's Magic E addition).
    await expect(stage.locator('.row.shuffle')).toHaveCount(4);
    await expect(stage.locator('.row.shuffle[data-shuffle="digraphs"]')).toHaveCount(1);
    // The digraphs shuffle pools all 55 digraph words (wh grew from 4 to 7
    // cards in v1.4 — added wheel, whale, whisk).
    await expect(stage.locator('.row.shuffle[data-shuffle="digraphs"]')).toContainText('55 words');
    // CVC and Blends became multi-deck categories in v1.3 — pin their pooled
    // counts too (cvc 20+5x10, blends 18+10+10+9+10 — s-blends dropped to 9
    // cards in v1.4 when the two-syllable "spider" card was removed).
    await expect(stage.locator('.row.shuffle[data-shuffle="cvc"]')).toContainText('70 words');
    await expect(stage.locator('.row.shuffle[data-shuffle="blends"]')).toContainText('57 words');
    // Magic E landed in v1.7 as the app's first single-deck category — its
    // shuffle row pools its one 28-card deck.
    await expect(stage.locator('.row.shuffle[data-shuffle="magic-e"]')).toContainText('28 words');

    // shuffleRowEl() (src/main.ts) drops the word "all" when a category has
    // exactly one deck, since nothing is being combined. Every category
    // before v1.7 was multi-deck, so that branch has NEVER rendered in
    // production — Magic E is the first single-deck category to ship, and
    // these assertions pin the branch in BOTH directions. `.toHaveText`
    // (exact match) is deliberate: a `.toContainText('shuffle')` substring
    // check would pass for "shuffle all" too and would prove nothing about
    // which label actually rendered.
    await expect(stage.locator('.row.shuffle[data-shuffle="magic-e"] .dg')).toHaveText('shuffle');
    await expect(stage.locator('.row.shuffle[data-shuffle="magic-e"] .ct')).toHaveText('28 words');
    await expect(stage.locator('.row.shuffle[data-shuffle="magic-e"]')).toHaveAttribute(
      'aria-label',
      'Shuffle Long Vowels, 28 words',
    );
    // Contrast case: a multi-deck category still gets the "all" form.
    await expect(stage.locator('.row.shuffle[data-shuffle="digraphs"] .dg')).toHaveText('shuffle all');
  });

  test('a shuffle-all row starts a run with the category title in the corner', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);

    const stage = page.locator('#stage');
    await stage.locator('.row.shuffle[data-shuffle="digraphs"]').tap();
    await expect(stage).toHaveAttribute('data-state', 'word');
    // Corner shows the category title, not a single digraph id.
    await expect(page.locator('#stage .corner')).toContainText('Digraphs · 1 of 55');
  });

  test('the Long Vowels shuffle row starts a run with the CATEGORY title in the corner', async ({
    page,
  }) => {
    // Before the v1.7 rename, the Long Vowels category and its one deck were
    // BOTH titled "Magic E" — so a shuffle-run corner and a deck-run corner
    // would have rendered byte-identical text ("Magic E · 1 of 28" either
    // way), even though the shuffle-run corner is built from the CATEGORY
    // title (buildShuffledDeck(), src/decks.ts) and the deck-run corner from
    // the DECK title (src/main.ts) — two different fields that happened to
    // collide. This pins that, post-rename, the two are visibly distinct:
    // the deck-run corner still reads "Magic E · 1 of 28" (see 'the Magic E
    // deck itself opens and reveals its first card' above, deliberately left
    // unchanged), while THIS shuffle-run corner must read
    // "Long Vowels · 1 of 28".
    await page.goto('/');
    await waitForBoot(page);

    const stage = page.locator('#stage');
    await stage.locator('.row.shuffle[data-shuffle="magic-e"]').tap();
    await expect(stage).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .corner')).toContainText('Long Vowels · 1 of 28');
  });

  test('a shuffle run is NOT resumable: reloading mid-run lands on the picker', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);

    const stage = page.locator('#stage');
    await stage.locator('.row.shuffle[data-shuffle="digraphs"]').tap();
    await expect(stage).toHaveAttribute('data-state', 'word');

    // Nothing was persisted for the shuffle run (unlike a real deck position).
    const persisted = await page.evaluate(() => localStorage.getItem('potty-flashcards:position'));
    expect(persisted).toBeNull();

    await page.reload();
    await waitForBoot(page);
    await expect(stage).toHaveAttribute('data-state', 'deck_pick');
  });

  test('the Magic E deck itself opens and reveals its first card', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);

    const stage = page.locator('#stage');
    // Same selector convention as openFirstDeck()'s sh row: the stable
    // data-deck-id hook, not row position or text.
    await page.locator('#stage .row[data-deck-id="magic-e"]').tap();
    await expect(stage).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .corner')).toHaveText('Magic E · 1 of 28');
    await expect(page.locator('#stage .word')).toHaveText('cake');

    // Advance one beat: word -> image (cake has art at art/cake.svg).
    await page.waitForTimeout(SAFE_WAIT_MS);
    await stage.tap();
    await expect(stage).toHaveAttribute('data-state', 'image');
    await expect(page.locator('#stage .reveal .art')).toHaveAttribute('src', /art\/cake\.svg$/);
  });
});

test.describe('rehydrate validation', () => {
  const seedAndReload = async (page: Page, value: string) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.evaluate((v) => localStorage.setItem('potty-flashcards:position', v), value);
    await page.reload();
    await waitForBoot(page);
  };

  test('an out-of-range persisted cardIndex falls back to the picker', async ({ page }) => {
    await seedAndReload(page, JSON.stringify({ deckId: 'sh', cardIndex: 999, beat: 'word' }));
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'deck_pick');
  });

  test('a persisted deckId that no longer exists falls back to the picker', async ({ page }) => {
    await seedAndReload(page, JSON.stringify({ deckId: 'gone', cardIndex: 0, beat: 'word' }));
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'deck_pick');
  });

  // findDeck()'s SHUFFLE_PREFIX branch: a shuffle run is never persisted, so any
  // persisted shuffle: id is stale by definition and must resolve to null at boot
  // rather than a broken card. Distinct code path from the plain decks.find() guard.
  test('a persisted shuffle deckId falls back to the picker at boot', async ({ page }) => {
    await seedAndReload(page, JSON.stringify({ deckId: 'shuffle:digraphs', cardIndex: 0, beat: 'word' }));
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'deck_pick');
  });
});

test.describe('word sizing', () => {
  test('opening a deck sets a measured, clamped --word-size', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);

    const px = await page.evaluate(() =>
      parseFloat(document.documentElement.style.getPropertyValue('--word-size')),
    );
    // MIN_WORD_PX / MAX_WORD_PX in src/main.ts.
    expect(px).toBeGreaterThanOrEqual(48);
    expect(px).toBeLessThanOrEqual(420);
  });
});

test.describe('image (reveal) sizing', () => {
  // Regression guard for the "illustrations sometimes come out really small"
  // bug: `.reveal .art` used `width:auto;height:auto` + max-* caps, which
  // renders an <img> at the SVG's INTRINSIC size and only ever shrinks it —
  // so a hand-drawn placeholder that declared width="100" sat at 100px and the
  // dimensionless OpenMoji SVGs at the ~150px browser default, none reaching
  // the "illustration large up top" the design specifies. The fix gives the
  // art a definite height (--art-max-h = 64vh), so every card fills the same
  // large area regardless of what its file declares. We assert the rendered
  // height is a large fraction of the viewport — old behavior (100/150px on a
  // ~390px-tall landscape ≈ 0.26/0.38) fails this; the 64vh fix (≈0.64) passes.
  const MIN_ART_FRACTION = 0.55;
  const MAX_ART_FRACTION = 0.7; // 64vh + tolerance — proves it's CAPPED, not overflowing

  async function artHeightFraction(page: Page): Promise<number> {
    return page.evaluate(() => {
      const img = document.querySelector('#stage .reveal .art');
      if (!img) return -1;
      return img.getBoundingClientRect().height / window.innerHeight;
    });
  }

  async function artWidthFraction(page: Page): Promise<number> {
    return page.evaluate(() => {
      const img = document.querySelector('#stage .reveal .art');
      if (!img) return -1;
      return img.getBoundingClientRect().width / window.innerWidth;
    });
  }

  // Regression guard for a DIFFERENT failure mode than the box-size one
  // above (P4.12, adversarial review of v1.5): getBoundingClientRect() only
  // proves the CSS BOX is sized right — it says nothing about whether the art
  // FILE has any drawn content left in it. An SVG whose viewBox gets edited to
  // crop out the artwork (or one accidentally emptied) would still report a
  // correctly-sized box and pass every assertion above it.
  //
  // Scope of the claim, precisely: drawImage() rasterizes the SOURCE SVG at
  // whatever dimensions it is handed and ignores `object-fit`, CSS `opacity`
  // and `visibility` — so a nonzero fraction proves THE ART FILE ISN'T BLANK,
  // not that ink is visible on screen. That is the regression being guarded
  // (a blanked/over-cropped SVG); on-screen visibility is the box-size
  // assertions' job, and DESIGN.md's zero-motion/zero-decoration rules mean
  // there is no opacity or visibility trickery on `.art` to hide behind.
  //
  // Two candidate fixes were spiked against a deliberately blanked SVG
  // (viewBox-only, zero drawn content — see git history of this file for
  // the spike) before picking one:
  //   (a) canvas alpha sample: draw the rendered <img> into an offscreen
  //       canvas AT ITS RENDERED BOX SIZE (drawImage scales regardless of
  //       the source's intrinsic size, so this works even for the app's
  //       seven viewBox-only hand-drawn SVGs), then count pixels whose
  //       alpha channel is above a small anti-aliasing-noise threshold.
  //       Observed: real ship art -> ~45.5% ink; blanked art -> exactly 0%.
  //       Same-origin img (this app's own /art/*.svg) never taints the
  //       canvas, so getImageData() is safe to read.
  //   (b) img.naturalWidth/naturalHeight > 0: observed TRUE for both the
  //       real ship art AND the blanked SVG — a viewBox-only SVG resolves
  //       to a nonzero intrinsic size purely from the viewBox, regardless
  //       of whether anything is drawn inside it. This cannot distinguish
  //       "painted" from "blank" and would stay green through the exact
  //       regression this test exists to catch.
  // (a) is the one kept below; (b) is dropped as unreliable for this job.
  async function paintedInkFraction(page: Page): Promise<number> {
    // MUST wait for the element to finish loading before rasterizing. Per spec,
    // drawImage() with an image that is not "completely available" is a silent
    // no-op: no throw, the canvas stays fully transparent, and this helper
    // returns 0 — a FALSE RED indistinguishable from the blanked-art regression
    // it exists to catch. renderImageBeat() builds a fresh <img> and assigns
    // .src on every reveal, so even a memory-cached SVG completes
    // asynchronously. Today the intervening CDP round-trips usually cover the
    // gap, but "usually" plus fullyParallel with 8 workers and retries: 0 is a
    // flake waiting for a loaded CI machine.
    await page.waitForFunction(
      () => document.querySelector<HTMLImageElement>('#stage .reveal .art')?.complete === true,
    );
    return page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>('#stage .reveal .art');
      if (!img) return -1;
      const rect = img.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return -1;
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      let ink = 0;
      // Alpha is every 4th byte (R,G,B,A). >10/255 clears any stray
      // decode/antialiasing noise without hiding a real blanking regression
      // (a blanked SVG rasterizes to alpha 0 everywhere, not near-zero).
      for (let i = 3; i < data.length; i += 4) if (data[i] > 10) ink++;
      return ink / (w * h);
    });
  }
  // Well below every asserted card's measured fraction (ship 0.455, shut
  // 0.458, whip 0.276 — whip is lowest because its 4.4:1 art letterboxes
  // inside a box whose height is the same definite 64vh as the square cards)
  // — proves SOME meaningful drawn area without pinning to a fragile exact
  // percentage that would drift with any legitimate art edit.
  const MIN_INK_FRACTION = 0.05;

  test('an OpenMoji card (ship) reveals a large illustration, not its intrinsic size', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page);
    await page.waitForTimeout(SAFE_WAIT_MS);
    await page.locator('#stage').tap(); // word -> image (ship has art)
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'image');

    const frac = await artHeightFraction(page);
    expect(frac).toBeGreaterThanOrEqual(MIN_ART_FRACTION);
    expect(frac).toBeLessThanOrEqual(MAX_ART_FRACTION);

    // The box-size assertion above would stay green even if ship.svg's
    // viewBox were edited to crop out the hull — assert the art file still
    // rasterizes to something, not just that its box is sized right.
    const ink = await paintedInkFraction(page);
    expect(ink).toBeGreaterThanOrEqual(MIN_INK_FRACTION);
  });

  test('the reported hand-drawn card (shut, was pinned at 100px) also reveals large', async ({
    page,
  }) => {
    // Resume straight onto "shut" (sh deck, cardIndex 5) via the persisted
    // position, then reveal its image — avoids tapping through five cards.
    await page.goto('/');
    await waitForBoot(page);
    await page.evaluate(() =>
      localStorage.setItem(
        'potty-flashcards:position',
        JSON.stringify({ deckId: 'sh', cardIndex: 5, beat: 'word' }),
      ),
    );
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('#stage .word')).toHaveText('shut'); // confirm we're on the reported card

    await page.waitForTimeout(SAFE_WAIT_MS);
    await page.locator('#stage').tap(); // word -> image
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'image');

    const frac = await artHeightFraction(page);
    expect(frac).toBeGreaterThanOrEqual(MIN_ART_FRACTION);
    expect(frac).toBeLessThanOrEqual(MAX_ART_FRACTION);

    // Same not-blank guard as the OpenMoji case above, exercised against a
    // hand-drawn (also viewBox-only, per art-svg-sizing.test.ts) SVG.
    const ink = await paintedInkFraction(page);
    expect(ink).toBeGreaterThanOrEqual(MIN_INK_FRACTION);
  });

  test('a wide illustration (whip, ~4.4:1) fills the width via the max-width cap', async ({
    page,
  }) => {
    // whip.svg (wh deck, cardIndex 0) has an extreme aspect ratio — its viewBox
    // was tightened to 6 61 168 38 (~4.42:1) so the lash fills the frame. This
    // is the case the two square-ish cards above can't exercise: at height 64vh
    // a 4.42:1 image would want ~4.42×64vh of width, so the --art-max-w (82vw)
    // cap bites and object-fit:contain letterboxes it. The box height stays a
    // definite 64vh, but the box WIDTH pins to the cap — proving wide art fills
    // the horizontal frame instead of collapsing to its intrinsic size.
    await page.goto('/');
    await waitForBoot(page);
    await page.evaluate(() =>
      localStorage.setItem(
        'potty-flashcards:position',
        JSON.stringify({ deckId: 'wh', cardIndex: 0, beat: 'word' }),
      ),
    );
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator('#stage .word')).toHaveText('whip');

    await page.waitForTimeout(SAFE_WAIT_MS);
    await page.locator('#stage').tap(); // word -> image
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'image');

    // Height: same definite 64vh band as the square cards.
    const hFrac = await artHeightFraction(page);
    expect(hFrac).toBeGreaterThanOrEqual(MIN_ART_FRACTION);
    expect(hFrac).toBeLessThanOrEqual(MAX_ART_FRACTION);
    // Width: pinned to the 82vw cap (allow tolerance). A square card sits near
    // ~0.30 here, so this is the assertion those cards can't make.
    const wFrac = await artWidthFraction(page);
    expect(wFrac).toBeGreaterThanOrEqual(0.78);
    expect(wFrac).toBeLessThanOrEqual(0.86);

    // whip is the card P4.12 named as most at risk: its viewBox was tightened
    // to 6 61 168 38, running close to the ink edge, so a further crop is
    // likeliest to blank THIS art. Measured 0.276 — lower than the two
    // square-ish cards (the letterboxing above) but far above the threshold.
    const ink = await paintedInkFraction(page);
    expect(ink).toBeGreaterThanOrEqual(MIN_INK_FRACTION);
  });
});

test.describe('resume-after-reload', () => {
  test('advancing a couple of beats then reloading resumes at that card\'s WORD beat', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await openFirstDeck(page); // card 1 ("ship"), word beat

    // Beat 1: word -> image (still card 1).
    await page.waitForTimeout(SAFE_WAIT_MS);
    await page.locator('#stage').tap();
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'image');

    // Beat 2: image -> next card (card 2, "shop"), landing back on WORD.
    await page.waitForTimeout(SAFE_WAIT_MS);
    await page.locator('#stage').tap();
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .corner')).toHaveText('sh · 2 of 10');

    // Beat 3: word -> image on card 2, so the persisted position is
    // mid-reveal — rehydrate() must force it back to the WORD beat, never
    // resume mid-reveal.
    await page.waitForTimeout(SAFE_WAIT_MS);
    await page.locator('#stage').tap();
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'image');
    await expect(page.locator('#stage .corner')).toHaveText('sh · 2 of 10');

    await page.reload();
    await waitForBoot(page);

    // Resumes on card 2's WORD beat — not the picker, not mid-reveal (image).
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'word');
    await expect(page.locator('#stage .corner')).toHaveText('sh · 2 of 10');
    await expect(page.locator('#stage .word')).toHaveText('shop');
  });

  test('a corrupt/missing persisted position falls back to the picker, not a blank screen', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForBoot(page);

    await page.evaluate(() => {
      localStorage.setItem('potty-flashcards:position', '{not valid json');
    });
    await page.reload();
    await waitForBoot(page);

    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'deck_pick');
  });
});
