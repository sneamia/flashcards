/* =========================================================================
   machine.ts — the PURE state reducer (Eng Decision #10: full ASCII
   transition table, kept here as the single source of truth alongside the
   code it describes; see docs/ARCHITECTURE.md for the prose version).

   No DOM. No Date.now(). No timers. `ctx.now` / `ctx.deck` / `ctx.hasImage`
   are threaded in by main.ts so this file stays 100% pure and unit-testable.

   -------------------------------------------------------------------------
   TRANSITION TABLE (authoritative)
   -------------------------------------------------------------------------

   screen     beat    action                    -> result
   ---------  ------  ------------------------  --------------------------------------------
   deck_pick  -       {start:id}                -> card   word  cardIndex=0            [lock]
   deck_pick  -       ADVANCE                    -> no-op
   deck_pick  -       BACK                       -> no-op
   deck_pick  -       EXIT                       -> no-op (already on picker)
   deck_pick  -       ABOUT                      -> about                               [lock]
   deck_pick  -       DISMISS                    -> no-op

   card       word    ADVANCE   hasImage(i)      -> card   image cardIndex=i            [lock]
   card       word    ADVANCE   !hasImage(i)     -> nextCard(i)                         [lock]
   card       image   ADVANCE                    -> nextCard(i)                         [lock]
     nextCard(i):  i+1 < deck.cards.length  -> card word  cardIndex=i+1        [lock]
                   else                     -> end  word  cardIndex=0         [lock]

   card       word    BACK      i===0            -> no-op
   card       word    BACK      i>0              -> card  beat=hasImage(i-1)?image:word
                                                       cardIndex=i-1                     [lock]
   card       image   BACK                        -> card  word  cardIndex=i (same card) [lock]

   card       any     EXIT                        -> deck_pick  word  cardIndex=0        [lock]
   card       any     ABOUT                       -> no-op (not on picker)
   card       any     DISMISS                     -> no-op (not on about)

   end        word    ADVANCE                     -> deck_pick  word  cardIndex=0        [lock]
   end        word    BACK / ABOUT / DISMISS       -> no-op
   end        word    EXIT                         -> deck_pick  word  cardIndex=0        [lock]

   about      -       ADVANCE / BACK               -> no-op
   about      -       EXIT                         -> deck_pick  word  cardIndex=0        [lock]
   about      -       ABOUT                        -> no-op (only reachable from deck_pick)
   about      -       DISMISS                      -> deck_pick  word  cardIndex=0        [lock]

   [lock] means lockUntil = ctx.now + LOCKOUT_MS on the returned state.

   ADVANCE respects the lockout: if ctx.now < state.lockUntil, ADVANCE is a
   silent no-op (returns `state` unchanged, same reference).
   BACK / EXIT / ABOUT / DISMISS / {start} ALWAYS bypass the lockout — these
   are parent recovery/navigation gestures; the child never performs them.
   ========================================================================= */

import type { Deck } from './types';
import { isLocked } from './lockout';

export type Screen = 'deck_pick' | 'card' | 'end' | 'about';
export type Beat = 'word' | 'image';
export type Action = 'ADVANCE' | 'BACK' | 'EXIT' | 'ABOUT' | 'DISMISS' | { start: string };

export interface AppState {
  screen: Screen;
  deckId: string | null; // null on deck_pick
  cardIndex: number; // index into the deck's RENDERABLE cards
  beat: Beat; // meaningful only when screen === 'card'
  lockUntil: number; // epoch ms; taps with now < lockUntil are ignored (ADVANCE only)
}

// Context the reducer needs without reaching into the DOM/globals.
export interface Ctx {
  now: number; // caller passes Date.now()
  deck: Deck | null; // the active deck (renderable cards only), or null
  hasImage: (cardIndex: number) => boolean; // true if that card shows an image beat
  // (card.img present AND not a runtime decode-failure)
}

export const LOCKOUT_MS = 1000;

export function initialState(): AppState {
  return { screen: 'deck_pick', deckId: null, cardIndex: 0, beat: 'word', lockUntil: 0 };
}

export function reduce(state: AppState, action: Action, ctx: Ctx): AppState {
  if (typeof action === 'object') {
    // {start: deckId} — deck picked from the picker. Always a deliberate
    // parent menu selection (never the child), so it bypasses the lockout
    // just like the other parent gestures.
    return {
      screen: 'card',
      deckId: action.start,
      cardIndex: 0,
      beat: 'word',
      lockUntil: ctx.now + LOCKOUT_MS,
    };
  }

  switch (action) {
    case 'ADVANCE':
      return handleAdvance(state, ctx);
    case 'BACK':
      return handleBack(state, ctx);
    case 'EXIT':
      return handleExit(state, ctx);
    case 'ABOUT':
      return handleAbout(state, ctx);
    case 'DISMISS':
      return handleDismiss(state, ctx);
    default:
      return state;
  }
}

function locked(state: AppState, now: number): AppState | null {
  return isLocked(state.lockUntil, now) ? state : null;
}

function handleAdvance(state: AppState, ctx: Ctx): AppState {
  const stillLocked = locked(state, ctx.now);
  if (stillLocked) return stillLocked;

  if (state.screen === 'card') {
    const deck = ctx.deck;
    if (!deck) return state; // defensive: shouldn't happen, but stay total/pure
    if (state.beat === 'word' && ctx.hasImage(state.cardIndex)) {
      return { ...state, beat: 'image', lockUntil: ctx.now + LOCKOUT_MS };
    }
    return nextCard(state, ctx, deck);
  }

  if (state.screen === 'end') {
    return {
      screen: 'deck_pick',
      deckId: null,
      cardIndex: 0,
      beat: 'word',
      lockUntil: ctx.now + LOCKOUT_MS,
    };
  }

  // deck_pick / about: ADVANCE has no defined effect here.
  return state;
}

function nextCard(state: AppState, ctx: Ctx, deck: Deck): AppState {
  const nextIndex = state.cardIndex + 1;
  if (nextIndex < deck.cards.length) {
    return { ...state, cardIndex: nextIndex, beat: 'word', lockUntil: ctx.now + LOCKOUT_MS };
  }
  return {
    screen: 'end',
    deckId: state.deckId,
    cardIndex: 0,
    beat: 'word',
    lockUntil: ctx.now + LOCKOUT_MS,
  };
}

function handleBack(state: AppState, ctx: Ctx): AppState {
  // BACK bypasses the lockout — it's a parent recovery gesture.
  if (state.screen !== 'card') return state; // no-op on other screens

  if (state.beat === 'image') {
    return { ...state, beat: 'word', lockUntil: ctx.now + LOCKOUT_MS };
  }

  // beat === 'word'
  if (state.cardIndex === 0) return state; // no-op: nothing before the first card
  const prevIndex = state.cardIndex - 1;
  const beat: Beat = ctx.hasImage(prevIndex) ? 'image' : 'word';
  return { ...state, cardIndex: prevIndex, beat, lockUntil: ctx.now + LOCKOUT_MS };
}

function handleExit(state: AppState, ctx: Ctx): AppState {
  // EXIT bypasses the lockout — it's a parent recovery gesture.
  if (state.screen === 'deck_pick') return state; // no-op if already on picker
  return {
    screen: 'deck_pick',
    deckId: null,
    cardIndex: 0,
    beat: 'word',
    lockUntil: ctx.now + LOCKOUT_MS,
  };
}

function handleAbout(state: AppState, ctx: Ctx): AppState {
  // ABOUT bypasses the lockout — it's a parent gesture, only valid from the picker.
  if (state.screen !== 'deck_pick') return state;
  return { ...state, screen: 'about', lockUntil: ctx.now + LOCKOUT_MS };
}

function handleDismiss(state: AppState, ctx: Ctx): AppState {
  // DISMISS bypasses the lockout — it's the tap that closes the about overlay.
  if (state.screen !== 'about') return state;
  return {
    screen: 'deck_pick',
    deckId: null,
    cardIndex: 0,
    beat: 'word',
    lockUntil: ctx.now + LOCKOUT_MS,
  };
}
