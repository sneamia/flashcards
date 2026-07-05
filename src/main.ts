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
import { type GestureAction, type Recognizer, createRecognizer } from './gestures';
import { isLocked } from './lockout';
import { loadDecks } from './decks';
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

/* --- Constants ----------------------------------------------------------- */

const STORAGE_KEY = 'potty-flashcards:position';
const FONT_TIMEOUT_MS = 1500;
const DECODE_TIMEOUT_MS = 2000;
const POLL_MS = 100;
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

function computeDataState(s: AppState, portrait: boolean): string {
  if (portrait) return 'rotate';
  if (s.screen === 'card') return s.beat;
  return s.screen;
}

function render(): void {
  const dataState = computeDataState(state, isPortraitNow());
  stage.setAttribute('data-state', dataState);
  stage.replaceChildren();

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
}
function onPointerUp(e: PointerEvent): void {
  handleRecognized(recognizer.handle({ kind: 'up', pointerId: e.pointerId, t: e.timeStamp }));
}
function onPointerCancel(e: PointerEvent): void {
  handleRecognized(recognizer.handle({ kind: 'cancel', pointerId: e.pointerId }));
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

function startPollTimer(): void {
  // Drives long-press EXIT detection (no 'up' event fires it) — uses
  // performance.now() to match PointerEvent.timeStamp's clock, independent
  // of the Date.now()-based lockUntil epoch used by the machine.
  setInterval(() => {
    handleRecognized(recognizer.poll(performance.now()));
  }, POLL_MS);
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
  await fontsReadyOrTimeout(FONT_TIMEOUT_MS);

  state = rehydrate();
  const deck = findDeck(state.deckId);
  if (deck) applyWordSize(deck);

  render();
  persist();

  attachPointerListeners();
  startPollTimer();
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
