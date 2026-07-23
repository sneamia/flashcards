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
    // Category headers (CVC, Digraphs, Blends).
    await expect(stage.locator('.cat')).toHaveText(['CVC', 'Digraphs', 'Blends']);
    // One shuffle-all row per category.
    await expect(stage.locator('.row.shuffle')).toHaveCount(3);
    await expect(stage.locator('.row.shuffle[data-shuffle="digraphs"]')).toHaveCount(1);
    // The digraphs shuffle pools all 55 digraph words (wh grew from 4 to 7
    // cards in v1.4 — added wheel, whale, whisk).
    await expect(stage.locator('.row.shuffle[data-shuffle="digraphs"]')).toContainText('55 words');
    // CVC and Blends became multi-deck categories in v1.3 — pin their pooled
    // counts too (cvc 20+5x10, blends 18+10+10+9+10 — s-blends dropped to 9
    // cards in v1.4 when the two-syllable "spider" card was removed).
    await expect(stage.locator('.row.shuffle[data-shuffle="cvc"]')).toContainText('70 words');
    await expect(stage.locator('.row.shuffle[data-shuffle="blends"]')).toContainText('57 words');
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
