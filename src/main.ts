/* =========================================================================
   main.ts — the ONLY impure module. Wires the pure machine/gestures/lockout
   modules to the DOM: rendering, Date.now(), timers, wake lock, persistence,
   font/image pre-warm, word measurement, orientation, and the a11y baseline.
   See docs/ARCHITECTURE.md for the module contract this file implements.
   ========================================================================= */

import './styles.css';

import type { Deck } from './types';
import {
  type Action,
  type AppState,
  type Beat,
  type Ctx,
  type Screen,
  LOCKOUT_MS,
  initialState,
  reduce,
} from './machine';
import {
  type GestureAction,
  type Recognizer,
  LONG_PRESS_MS,
  createRecognizer,
} from './gestures';
import { isLocked } from './lockout';
import { loadDecks } from './decks';
import { isPrecacheComplete } from './integrity';
import { registerSW } from 'virtual:pwa-register';

/* --- DOM root -------------------------------------------------------- */

const stageEl = document.getElementById('stage');
if (!(stageEl instanceof HTMLElement)) {
  throw new Error('main.ts: #stage element not found');
}
const stage: HTMLElement = stageEl;

/* --- Module state ------------------------------------------------------ */

const decks: Deck[] = loadDecks();
let state: AppState = initialState();

// Runtime image-decode-failure set, keyed by the card's `img` path. Ctx.hasImage
// treats any path in here as "no image" for the rest of this launch (Design D2)
// — never a permanent downgrade, just for this render/session.
const failedImages = new Set<string>();
const decodeCache = new Map<string, Promise<boolean>>();
const wordSizeCache = new Map<string, number>();

const recognizer: Recognizer = createRecognizer();

const portraitQuery = window.matchMedia('(orientation: portrait)');
// Always read live — a snapshot taken at module eval goes stale if the phone
// rotates during boot's font await (before the change listener attaches),
// which would render the wrong screen AND swallow all input.
function isPortraitNow(): boolean {
  return portraitQuery.matches;
}

let wakeLockSentinel: WakeLockSentinel | null = null;
let noSleepVideo: HTMLVideoElement | null = null;

// Set once at boot by the precache integrity check (see that section below).
// Never flips back mid-session: the only way out of the restore card is the
// `online` recovery reload, which re-evaluates everything from scratch.
let restoreNeeded = false;

/* --- Constants ----------------------------------------------------------- */

const STORAGE_KEY = 'potty-flashcards:position';
const FONT_TIMEOUT_MS = 1500;
const DECODE_TIMEOUT_MS = 2000;
// setTimeout is only guaranteed to fire AT OR AFTER its delay, never before —
// but a hair of slack absorbs any sub-ms scheduling jitter so the armed timer
// never wakes a tick early and misses poll()'s `now >= down.time + LONG_PRESS_MS`
// boundary (which would silently swallow a legitimate long-press EXIT).
const LONG_PRESS_TIMER_PAD_MS = 20;
const MIN_WORD_PX = 48;
const MAX_WORD_PX = 420;
const WORD_MARGIN = 0.88; // fraction of viewport width available to the word
const ATTRIBUTION = 'Illustrations: OpenMoji — CC BY-SA 4.0, colors modified';
const AUTO_LOCK_NOTE =
  'If the screen dims mid-session, set Auto-Lock to 5 minutes or longer (Settings → Display & Brightness).';
const GESTURE_LINES = ['tap: next card', 'two-finger tap: back', 'hold: exit'];

/* --- Small DOM helpers -------------------------------------------------- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function cornerEl(text: string): HTMLElement {
  const c = el('div', 'corner');
  c.textContent = text;
  return c;
}

function artUrl(path: string): string {
  // Public assets referenced by a runtime-computed path must be prefixed
  // with the configured base ('/flashcards/') per Vite's public-dir rules.
  return `${import.meta.env.BASE_URL}${path}`;
}

/* --- Deck / Ctx helpers -------------------------------------------------- */

function findDeck(deckId: string | null): Deck | null {
  if (!deckId) return null;
  return decks.find((d) => d.id === deckId) ?? null;
}

function hasImage(deckId: string | null, cardIndex: number): boolean {
  const deck = findDeck(deckId);
  if (!deck) return false;
  const card = deck.cards[cardIndex];
  if (!card || !card.img) return false;
  return !failedImages.has(card.img);
}

function buildCtx(now: number): Ctx {
  return {
    now,
    deck: findDeck(state.deckId),
    hasImage: (cardIndex: number) => hasImage(state.deckId, cardIndex),
  };
}

/* --- Image decode pre-warm (Eng #6 + #10) --------------------------------
   ensureDecoded() is called (a) fire-and-forget whenever a WORD beat with
   an image renders, so the decode has the whole 1000ms lockout to finish,
   and (b) awaited by preResolveForAction() immediately before any dispatch
   that might reveal/land-on an image, so ctx.hasImage() is always accurate
   at the moment the reducer decides the next beat — forward AND reverse. */

function ensureDecoded(path: string): Promise<boolean> {
  const cached = decodeCache.get(path);
  if (cached) return cached;

  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.src = artUrl(path);
    // decode() rejects on a FAILED fetch but never settles on a STALLED one
    // (first online run before the SW precache, captive portal). Without a
    // deadline, every ADVANCE would await the same cached hung promise and
    // forward navigation would freeze for the session. Timing out resolves
    // false, routing the card through the designed image-free fallback (D2).
    const deadline = setTimeout(() => resolve(false), DECODE_TIMEOUT_MS);
    img
      .decode()
      .then(() => {
        clearTimeout(deadline);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(deadline);
        resolve(false);
      });
  });
  decodeCache.set(path, promise);
  void promise.then((ok) => {
    if (!ok) failedImages.add(path);
  });
  return promise;
}

async function preResolveForAction(action: Action): Promise<void> {
  if (action !== 'ADVANCE' && action !== 'BACK') return;
  if (state.screen !== 'card' || state.beat !== 'word') return;

  let candidateIndex: number | null = null;
  if (action === 'ADVANCE') {
    candidateIndex = state.cardIndex;
  } else if (state.cardIndex > 0) {
    candidateIndex = state.cardIndex - 1;
  }
  if (candidateIndex === null) return;

  const deck = findDeck(state.deckId);
  const card = deck?.cards[candidateIndex];
  if (!card?.img || failedImages.has(card.img)) return;

  await ensureDecoded(card.img);
}

/* --- Word measurement (Eng #8) — measured, not clamp() -------------------
   On deck load, measure the longest renderable word at a sample font size
   with a canvas (font metrics scale linearly with px size), then compute
   the largest --word-size that fits the viewport width with margin. */

function measureWordSize(deck: Deck): number {
  const words = deck.cards.map((c) => c.text).filter((t) => t.length > 0);
  if (words.length === 0) return MIN_WORD_PX;

  const canvas = document.createElement('canvas');
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return MIN_WORD_PX;

  const sampleSize = 100;
  ctx2d.font = `700 ${sampleSize}px Andika, system-ui, sans-serif`;
  let widest = 0;
  for (const word of words) {
    const w = ctx2d.measureText(word).width;
    if (w > widest) widest = w;
  }
  if (widest <= 0) return MIN_WORD_PX;

  const available = window.innerWidth * WORD_MARGIN;
  const fitted = Math.floor(sampleSize * (available / widest));
  return Math.max(MIN_WORD_PX, Math.min(MAX_WORD_PX, fitted));
}

function applyWordSize(deck: Deck): void {
  let px = wordSizeCache.get(deck.id);
  if (px === undefined) {
    px = measureWordSize(deck);
    // Never cache a portrait measurement: the app boots portrait more often
    // than not (phone upright when the icon is tapped), and a size measured
    // against the ~390px portrait width would undersize every word for the
    // whole session. The orientation-change handler re-measures on rotate.
    if (!isPortraitNow()) wordSizeCache.set(deck.id, px);
  }
  document.documentElement.style.setProperty('--word-size', `${px}px`);
}

/* --- Rendering ------------------------------------------------------------
   Zero motion: every call below is a full, instant DOM swap. No screen ever
   partially updates and no CSS transition exists to animate the swap. */

function rowEl(deck: Deck): HTMLButtonElement {
  const btn = el('button', 'row');
  btn.type = 'button';
  btn.setAttribute('aria-label', `${deck.title}, ${deck.cards.length} words`);
  const dg = el('span', 'dg');
  dg.textContent = deck.title;
  const ct = el('span', 'ct');
  ct.textContent = `${deck.cards.length} words`;
  btn.append(dg, ct);
  btn.addEventListener('click', (e) => {
    if (state.screen !== 'deck_pick') return;
    // A pointer-derived click (detail > 0) must belong to a tap that STARTED
    // on the picker: the click synthesized from the tap that dismissed the
    // about overlay fires AFTER the picker re-renders, lands on a fresh row,
    // and would silently start that deck. Keyboard/AT activation has
    // detail === 0 and passes through.
    if (e.detail > 0 && screenAtPointerDown !== 'deck_pick') return;
    void dispatch({ start: deck.id });
  });
  return btn;
}

function renderPicker(): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.append(cornerEl('flashcards'));

  const picker = el('div', 'picker');
  const decksEl = el('div', 'decks');
  for (const deck of decks) decksEl.append(rowEl(deck));

  const pfoot = el('div', 'pfoot');
  const gest = el('div', 'gest');
  // Derived from the same constant the about overlay renders, so the footer
  // hint and the full gesture list can never drift apart.
  gest.textContent = GESTURE_LINES.slice(1).join(' · ');
  pfoot.append(gest);

  picker.append(decksEl, pfoot);
  frag.append(picker);
  return frag;
}

function renderWordBeat(deck: Deck, cardIndex: number): DocumentFragment {
  const frag = document.createDocumentFragment();
  const card = deck.cards[cardIndex];

  frag.append(cornerEl(`${deck.title} · ${cardIndex + 1} of ${deck.cards.length}`));

  const word = el('div', 'word');
  word.textContent = card.text;
  frag.append(word);

  // Pre-warm (fire-and-forget): decode this card's image now, during the
  // WORD beat, so the reveal swap is instant by the time the lockout clears.
  if (card.img && !failedImages.has(card.img)) {
    void ensureDecoded(card.img);
  }
  return frag;
}

function renderImageBeat(deck: Deck, cardIndex: number): DocumentFragment {
  const frag = document.createDocumentFragment();
  const card = deck.cards[cardIndex];

  frag.append(cornerEl(`${deck.title} · ${cardIndex + 1} of ${deck.cards.length}`));

  const reveal = el('div', 'reveal');
  const img = el('img', 'art');
  img.alt = '';
  img.setAttribute('aria-hidden', 'true'); // decorative — the word is the readable content
  // By the time beat === 'image', preResolveForAction() has already
  // guaranteed decode succeeded (a failed decode keeps hasImage() false, so
  // the reducer never lands here) — card.img is reliably present.
  img.src = card.img ? artUrl(card.img) : '';

  const word = el('div', 'word');
  word.textContent = card.text;

  reveal.append(img, word);
  frag.append(reveal);
  return frag;
}

function renderEnd(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const card = el('div', 'syscard endcard');
  const t = el('div', 't');
  t.textContent = 'the end';
  card.append(t);
  frag.append(card);
  return frag;
}

function renderAbout(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const card = el('div', 'syscard about');

  const lines = el('div', 'lines');
  GESTURE_LINES.forEach((line, i) => {
    if (i > 0) lines.append(document.createElement('br'));
    lines.append(document.createTextNode(line));
  });

  const attr = el('div', 'attr');
  attr.textContent = ATTRIBUTION;

  // Auto-Lock fallback note (Eng #9's final fallback tier) lives here, not
  // in the picker footer: DESIGN.md's D1 locks that footer to exactly one
  // gesture-hint line, with everything else moved to this overlay.
  const autoLock = el('div', 'attr');
  autoLock.textContent = AUTO_LOCK_NOTE;

  card.append(lines, attr, autoLock);
  frag.append(card);
  return frag;
}

function renderRotate(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const card = el('div', 'syscard rotate');
  const t = el('div', 't');
  t.textContent = 'turn the phone sideways';
  card.append(t);
  frag.append(card);
  return frag;
}

// Boot-time-only "assets are broken" card — see the Precache integrity
// section below. Not a machine.ts state (same pattern as the rotate card):
// a live boot condition rendered entirely in this impure shell.
function renderRestore(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const card = el('div', 'syscard restore');
  const t = el('div', 't');
  t.textContent = 'reconnect once to restore';
  const sub = el('div', 'sub');
  sub.textContent = 'some parts of the app did not finish saving for offline use.';
  card.append(t, sub);
  frag.append(card);
  return frag;
}

// `restore` and `rotate` are both live boot/runtime overlays, not machine.ts
// states — restore wins: a phone rotated back to landscape with an evicted
// precache would still show broken art, so "assets are broken" must take
// precedence over "wrong orientation".
function computeDataState(s: AppState, portrait: boolean, restore: boolean): string {
  if (restore) return 'restore';
  if (portrait) return 'rotate';
  if (s.screen === 'card') return s.beat;
  return s.screen;
}

function render(): void {
  const dataState = computeDataState(state, isPortraitNow(), restoreNeeded);
  stage.setAttribute('data-state', dataState);
  stage.replaceChildren();

  if (dataState === 'restore') {
    stage.append(renderRestore());
    return;
  }
  if (dataState === 'rotate') {
    stage.append(renderRotate());
    return;
  }

  switch (state.screen) {
    case 'deck_pick':
      stage.append(renderPicker());
      return;
    case 'about':
      stage.append(renderAbout());
      return;
    case 'end':
      stage.append(renderEnd());
      return;
    case 'card': {
      const deck = findDeck(state.deckId);
      if (!deck) {
        // Corrupt/stale deckId — recover to the picker rather than a blank screen.
        stage.setAttribute('data-state', 'deck_pick');
        stage.append(renderPicker());
        return;
      }
      if (state.beat === 'word') stage.append(renderWordBeat(deck, state.cardIndex));
      else stage.append(renderImageBeat(deck, state.cardIndex));
      return;
    }
  }
}

/* --- Persistence (Eng #7) — ephemeral position, NOT stats ---------------- */

interface PersistedPosition {
  deckId: string | null;
  cardIndex: number;
  beat: Beat;
}

function persist(): void {
  try {
    if (state.screen !== 'card') {
      // Only an in-progress card position is worth resuming. The end card
      // means the session CLOSED — a relaunch must land on the picker, not
      // back inside the finished deck — and the picker/about have nothing
      // to restore.
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const data: PersistedPosition = {
      deckId: state.deckId,
      cardIndex: state.cardIndex,
      beat: state.beat,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable/full — position simply won't resume next launch.
  }
}

function rehydrate(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();

    const parsed = JSON.parse(raw) as Partial<PersistedPosition>;
    if (!parsed.deckId || typeof parsed.cardIndex !== 'number') return initialState();

    const deck = findDeck(parsed.deckId);
    if (!deck) return initialState();
    if (parsed.cardIndex < 0 || parsed.cardIndex >= deck.cards.length) return initialState();

    return {
      screen: 'card',
      deckId: deck.id,
      cardIndex: parsed.cardIndex,
      beat: 'word', // never rehydrate mid-reveal
      lockUntil: Date.now() + LOCKOUT_MS,
    };
  } catch {
    return initialState();
  }
}

/* --- Dispatch ------------------------------------------------------------- */

// Bumped on every APPLIED transition. A dispatch that was parked on the
// async pre-resolve compares generations on resume: if another transition
// landed meanwhile, this action was performed against a screen that no
// longer exists and must be dropped, not replayed onto the new one.
let dispatchGeneration = 0;

async function dispatch(action: Action): Promise<void> {
  const now = Date.now();
  // Cheap early-exit: skip the async pre-resolve work entirely for an
  // ADVANCE that the reducer would no-op anyway.
  if (action === 'ADVANCE' && isLocked(state.lockUntil, now)) return;

  const generation = dispatchGeneration;
  await preResolveForAction(action);
  if (generation !== dispatchGeneration) return; // stale — state moved on

  const ctx = buildCtx(Date.now());
  const prevDeckId = state.deckId;
  const next = reduce(state, action, ctx);
  if (next === state) return; // no-op transition — nothing to render/persist

  dispatchGeneration++;
  state = next;
  if (state.deckId && state.deckId !== prevDeckId) {
    const deck = findDeck(state.deckId);
    if (deck) applyWordSize(deck);
  }
  render();
  persist();
}

/* --- Gestures -------------------------------------------------------------
   main.ts owns the DOM listeners; gestures.ts stays a pure recognizer. The
   raw GestureAction is translated to a machine Action here, per screen:
   - ADVANCE means DISMISS while the about overlay is showing.
   - EXIT means ABOUT on the picker, or the picker-exit EXIT everywhere else. */

function mapGesture(g: GestureAction, screen: Screen): Action | null {
  if (g === null) return null;
  if (g === 'ADVANCE') return screen === 'about' ? 'DISMISS' : 'ADVANCE';
  if (g === 'BACK') return 'BACK';
  return screen === 'deck_pick' ? 'ABOUT' : 'EXIT';
}

function handleRecognized(g: GestureAction): void {
  if (g === null) return;
  if (isPortraitNow()) return; // rotate overlay suppresses all input
  const action = mapGesture(g, state.screen);
  if (action) void dispatch(action);
}

// Which screen the most recent pointerdown landed on — used by the deck-row
// click guard to reject clicks synthesized from taps that began elsewhere.
let screenAtPointerDown: Screen = 'deck_pick';

// --- Long-press EXIT timer ------------------------------------------------
// Replaces an always-on poll interval with a setTimeout scoped to the
// lifetime of a held pointer: armed on the down that starts a single-pointer
// gesture, fired once at (just past) LONG_PRESS_MS, cleared on that gesture's
// up/cancel. When nothing is down, no timer is scheduled — zero idle wakeups.
// Two-finger BACK and plain taps never need this: both resolve synchronously
// from recognizer.handle() on 'up', per gestures.ts.

// Pointers currently held down, mirroring the recognizer's own bookkeeping
// closely enough to know when a gesture session starts/ends. Needed (rather
// than a plain counter) only to correctly key each up/cancel's removal.
const downPointerIds = new Set<number>();
// True once this gesture session has ever had 2+ pointers down at once — an
// EXIT can never fire for the rest of that session (gestures.ts's `multi`
// latches for the whole gesture), so no timer needs to be (re-)armed for it.
let sessionBlocked = false;
let exitTimer: ReturnType<typeof setTimeout> | undefined;

function clearExitTimer(): void {
  if (exitTimer !== undefined) {
    clearTimeout(exitTimer);
    exitTimer = undefined;
  }
}

function armExitTimer(): void {
  clearExitTimer();
  // Uses performance.now() to match PointerEvent.timeStamp's clock,
  // independent of the Date.now()-based lockUntil epoch used by the machine.
  exitTimer = setTimeout(() => {
    exitTimer = undefined;
    handleRecognized(recognizer.poll(performance.now()));
  }, LONG_PRESS_MS + LONG_PRESS_TIMER_PAD_MS);
}

// Hard-clears the local pointer/timer bookkeeping above — kept in lockstep
// with recognizer.reset() (app backgrounded mid-gesture) so a pointer whose
// up/cancel never arrives can't leave this module thinking a session is
// still open (which would permanently block re-arming for later holds).
function resetPointerTracking(): void {
  downPointerIds.clear();
  sessionBlocked = false;
  clearExitTimer();
}

function onPointerDown(e: PointerEvent): void {
  screenAtPointerDown = state.screen;
  // A user gesture is the one context where a previously-denied wake lock or
  // autoplay-blocked NoSleep video (Low Power Mode) can succeed — retry here
  // if nothing is currently keeping the screen awake (Eng #9).
  if (
    (!wakeLockSentinel || wakeLockSentinel.released) &&
    (!noSleepVideo || noSleepVideo.paused)
  ) {
    void requestWakeLock();
  }
  handleRecognized(recognizer.handle({ kind: 'down', pointerId: e.pointerId, t: e.timeStamp }));

  downPointerIds.add(e.pointerId);
  if (downPointerIds.size >= 2) {
    // A second pointer joined this gesture — it's resolving as BACK (or a
    // palm), never EXIT. Drop any pending timer from the first pointer.
    sessionBlocked = true;
    clearExitTimer();
  } else if (!sessionBlocked) {
    // The sole pointer of a fresh gesture — arm the one-shot EXIT check.
    armExitTimer();
  }
}
function releasePointer(pointerId: number): void {
  downPointerIds.delete(pointerId);
  if (downPointerIds.size === 0) {
    // Gesture fully resolved (or abandoned) — no pointer left down means no
    // future EXIT is possible until a new pointerdown starts one.
    clearExitTimer();
    sessionBlocked = false;
  }
}
function onPointerUp(e: PointerEvent): void {
  handleRecognized(recognizer.handle({ kind: 'up', pointerId: e.pointerId, t: e.timeStamp }));
  releasePointer(e.pointerId);
}
function onPointerCancel(e: PointerEvent): void {
  handleRecognized(recognizer.handle({ kind: 'cancel', pointerId: e.pointerId }));
  releasePointer(e.pointerId);
}

function attachPointerListeners(): void {
  stage.addEventListener('pointerdown', onPointerDown);
  // up/cancel listen on window, not the stage: a finger that goes down on the
  // stage but lifts elsewhere must still complete its gesture, or a stale
  // entry lingers in the recognizer and the NEXT tap misreads as a two-finger
  // BACK. (An 'up' the recognizer never saw go down resolves to null.)
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
}

/* --- Wake lock (Eng #9) ----------------------------------------------------
   Chain: navigator.wakeLock -> invisible NoSleep-style video -> Auto-Lock
   note on the about overlay (the note is the always-available final fallback
   and costs nothing; the two code fallbacks above it are best-effort). */

async function requestWakeLock(): Promise<void> {
  if (wakeLockSentinel && !wakeLockSentinel.released) return; // already held
  try {
    if ('wakeLock' in navigator) {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      // iOS can silently release a HELD lock (thermal/battery) while the page
      // stays visible — the visibilitychange re-acquire never fires for that.
      wakeLockSentinel.addEventListener('release', () => {
        if (document.visibilityState === 'visible') void requestWakeLock();
      });
      return;
    }
  } catch {
    // Unsupported, denied, or released by the OS — fall through to NoSleep.
  }
  setupNoSleepFallback();
}

function setupWakeLockReacquire(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void requestWakeLock();
    } else {
      // Backgrounded mid-gesture: iOS may never deliver the terminating
      // pointer event, and a stale entry would deadlock later input.
      recognizer.reset();
      resetPointerTracking();
    }
  });
}

// A well-known tiny (silent, ~3s, looping) H.264 mp4 data URI — the same
// "NoSleep.js" technique many PWAs use as a Wake-Lock-API fallback. Kept
// modular and isolated here so it can be swapped or removed in one place.
const NOSLEEP_MP4_SRC =
  'data:video/mp4;base64,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';

function setupNoSleepFallback(): void {
  if (noSleepVideo) {
    void noSleepVideo.play().catch(() => undefined);
    return;
  }
  const video = el('video');
  video.muted = true;
  video.setAttribute('muted', '');
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.loop = true;
  video.setAttribute('aria-hidden', 'true');
  // Genuinely invisible: 1px, off-screen, transparent, never in the layout
  // flow — if this ever produces a visible frame/flicker, pull it (Eng #9).
  video.style.position = 'fixed';
  video.style.left = '-10px';
  video.style.top = '-10px';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  video.src = NOSLEEP_MP4_SRC;
  document.body.appendChild(video);
  noSleepVideo = video;
  void video.play().catch(() => undefined);
}

/* --- Font pre-warm (Eng #6) ------------------------------------------------
   Block ONLY the first render on document.fonts.ready, with a timeout
   fallback so a font 404 can never hang the app (a beginning reader must
   never see a font swap — that would be visible movement). */

function fontsReadyOrTimeout(timeoutMs: number): Promise<void> {
  // document.fonts.ready alone is NOT enough here: @font-face loads lazily,
  // nothing has rendered Andika yet at boot (#stage is empty), and canvas
  // measureText never triggers a font load — so `ready` would resolve
  // immediately with Andika unloaded and word measurement would silently use
  // fallback-font metrics. fonts.load() forces both faces to actually fetch
  // (they're precached, so this is fast) before the first render/measure.
  const loaded = Promise.all([
    document.fonts.load('700 100px Andika'),
    document.fonts.load('400 16px Andika'),
  ])
    .then(() => undefined)
    .catch(() => undefined);
  return Promise.race([
    loaded,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/* --- Precache integrity (boot-time) ----------------------------------------
   iOS Safari can evict a PWA's Cache API storage under memory pressure or
   long non-use. If that happened, an offline relaunch hits broken images
   with no explanation — a silent failure DESIGN.md's "calm, actionable"
   ethos rules out. The offline guarantee here is strong, not absolute: it
   catches an evicted/partial precache at boot rather than proving every
   byte is present (that's the Workbox precache manifest's job, and it
   isn't cleanly exposed to app/window context) — probing a critical subset
   via the Cache API is the pragmatic, robust equivalent. isPrecacheComplete
   itself (src/integrity.ts) is pure and unit-tested; everything here is
   just gathering its two inputs from the real Cache API. */

// The assets a render literally cannot happen without: this page's own
// built JS/CSS (read off the live DOM so a build-hash change never goes
// stale here), both Andika weights (every screen is text), and a couple of
// representative art SVGs (enough to catch a partially-evicted precache
// without hardcoding the full per-deck asset list this module has no
// business knowing).
function criticalAssetUrls(): string[] {
  const urls = new Set<string>();
  document
    .querySelectorAll<HTMLScriptElement>('script[src]')
    .forEach((s) => urls.add(s.src));
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')
    .forEach((l) => urls.add(l.href));
  urls.add(artUrl('fonts/Andika-Regular.woff2'));
  urls.add(artUrl('fonts/Andika-Bold.woff2'));
  for (const deck of decks) {
    const withArt = deck.cards.find((c) => c.img);
    if (withArt?.img) urls.add(artUrl(withArt.img));
    if (urls.size >= 6) break; // 2 built assets + 2 fonts + up to 2 art samples
  }
  return [...urls];
}

// caches.match() checks every open cache for a match, which is exactly
// "is this URL present anywhere in the precache" — no need to enumerate
// cache names ourselves. ignoreSearch is REQUIRED: Workbox stores every
// non-content-hashed precache entry (the fonts and art SVGs, which have no
// hash in their filename) under a cache key with a `?__WB_REVISION__=<hash>`
// query param appended. A plain `caches.match(url)` is exact-including-query,
// so it would never match those keys — reporting the fonts/art perpetually
// absent and firing the restore card on every offline boot. Matching on path
// alone is the correct "is this asset cached at all" probe here.
async function gatherPresentUrls(urls: string[]): Promise<Set<string>> {
  const present = new Set<string>();
  if (!('caches' in window)) return present; // no Cache API — treat as nothing present
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (await caches.match(url, { ignoreSearch: true })) present.add(url);
      } catch {
        // Threw (e.g. private-mode quirk) — leave unmarked; the pure check
        // below then correctly reports the precache incomplete.
      }
    }),
  );
  return present;
}

async function checkPrecacheIntegrity(): Promise<boolean> {
  const required = criticalAssetUrls();
  const present = await gatherPresentUrls(required);
  return isPrecacheComplete(required, present);
}

// While the restore card is showing, the only way out is connectivity
// returning. Reload (not a live re-check) so the SW's normal install/fetch
// flow re-precaches everything under its own logic — no bespoke recovery
// path to keep in sync with Workbox. No spinner: this is a boot condition,
// not a mid-session change, so an instant full-page swap stays zero-motion.
function recoverFromRestore(): void {
  location.reload();
}

/* --- Boot ------------------------------------------------------------------- */

function registerServiceWorker(): void {
  try {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        // Deliberately no prompt/UI: the new SW installs and WAITS (see
        // vite.config.ts skipWaiting:false) — it activates on the next
        // natural launch so an update can never interrupt a session.
      },
      onOfflineReady() {
        // No banner — the calm surface never announces itself.
      },
    });
  } catch {
    // Service worker unsupported/unavailable — the app still works online.
  }
}

async function boot(): Promise<void> {
  // Takes precedence over the whole normal boot sequence — including the
  // rotate overlay, wake lock, and gesture wiring — because a broken
  // precache means there's nothing renderable to resume into. Only
  // actionable while offline: online, the existing "relaunch with
  // connectivity restores it" path already recovers (the SW re-precaches
  // on its own), so there's nothing special to do here.
  if (!navigator.onLine && !(await checkPrecacheIntegrity())) {
    restoreNeeded = true;
    // Pre-warm the font like every other screen so the calm restore card
    // never paints in fallback and then swaps to Andika (a visible motion the
    // zero-swap principle rules out). If the font itself was evicted, load()
    // rejects and this resolves immediately — no added delay.
    await fontsReadyOrTimeout(FONT_TIMEOUT_MS);
    render();
    window.addEventListener('online', recoverFromRestore, { once: true });
    return;
  }

  await fontsReadyOrTimeout(FONT_TIMEOUT_MS);

  state = rehydrate();
  const deck = findDeck(state.deckId);
  if (deck) applyWordSize(deck);

  render();
  persist();

  attachPointerListeners();
  setupWakeLockReacquire();
  void requestWakeLock();
  registerServiceWorker();

  portraitQuery.addEventListener('change', () => {
    if (!isPortraitNow()) {
      // Viewport width changed — any cached word size is stale. Re-measure
      // against the landscape width before the cards become visible again
      // (the CSS var updates while the rotate overlay is up: zero movement).
      wordSizeCache.clear();
      const deck = findDeck(state.deckId);
      if (deck) applyWordSize(deck);
    }
    render(); // resumes the underlying state unchanged (success criterion 6)
  });
}

void boot();
