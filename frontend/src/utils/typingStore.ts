import { useRef, useSyncExternalStore } from 'react';
import type { Passage, Duration, MistakeWord, TestMode, WordCount, ContentType } from '../types';

/**
 * High-frequency typing state, outside React.
 *
 * A keystroke changes the typed characters, the cursor, the mistake set and the
 * live counters. Holding that in a component's reducer means every one of those
 * commits re-renders the whole typing page. Here the same reducer runs inside a
 * per-test external store: the engine dispatches into it and leaf components
 * subscribe to the single primitive they display, so a keypress commits one
 * character span, one caret move and the readouts — never the container.
 *
 * Low-frequency state (which passage is loaded, settings, modals) stays in React
 * state; this store is only created and reset by `useTypingEngine`.
 */

export interface WordBoundary {
  start: number;
  end: number;
}

export function getWordBoundaries(text: string): WordBoundary[] {
  const words: WordBoundary[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && text[i] === ' ') i++;
    if (i >= text.length) break;
    const start = i;
    while (i < text.length && text[i] !== ' ') i++;
    words.push({ start, end: i });
  }
  return words;
}

/** Word count without allocating the boundary list, for the words-mode readout. */
export function countWords(text: string): number {
  let count = 0;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      inWord = false;
    } else if (!inWord) {
      inWord = true;
      count++;
    }
  }
  return count;
}

function wordIndexAt(charIndex: number, boundaries: WordBoundary[]): number {
  for (let i = 0; i < boundaries.length; i++) {
    if (charIndex >= boundaries[i].start && charIndex < boundaries[i].end) return i;
  }
  return -1;
}

/** Index of the word that ends exactly at `charIndex` (i.e. the word before a space). */
function wordEndingAt(charIndex: number, boundaries: WordBoundary[]): number {
  for (let i = 0; i < boundaries.length; i++) {
    if (boundaries[i].end === charIndex) return i;
  }
  return -1;
}

/**
 * Monkeytype evaluates a word when it is submitted, not while it is being typed:
 * the word is wrong if the letters on screen at that moment differ from the
 * passage, and correcting a typo before pressing space clears it again. Flagging
 * live would leave the underline stuck on a word the typist already fixed.
 */
function withWordOutcome(
  mistakes: Set<number>,
  wordIndex: number,
  word: WordBoundary | undefined,
  text: string,
  typedChars: string[],
  typedEnd: number
): Set<number> {
  if (wordIndex < 0 || !word) return mistakes;
  let isCorrect = true;
  for (let i = word.start; i < word.end; i++) {
    if (i >= typedEnd || typedChars[i] !== text[i]) {
      isCorrect = false;
      break;
    }
  }
  const next = new Set(mistakes);
  if (isCorrect) next.delete(wordIndex);
  else next.add(wordIndex);
  return next;
}

export interface TypingConfig {
  passage: Passage;
  duration: Duration;
  testMode: TestMode;
  wordCount: WordCount;
  contentType: ContentType;
}

export interface TypingSnapshot {
  passage: Passage;
  typedChars: string[];
  extraChars: string[];
  currentIndex: number;
  totalTime: number;
  elapsedSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalKeystrokes: number;
  mistakeWordIndices: Set<number>;
  wordBoundaries: WordBoundary[];
  startTime: number | null;
  lockedIndex: number;
  completedWords: number;
  testMode: TestMode;
  wordCount: WordCount;
  contentType: ContentType;
}

export type TypingAction =
  | { type: 'KEY_PRESS'; key: string }
  | { type: 'BACKSPACE' }
  | { type: 'DELETE_WORD' }
  | { type: 'FINISH' };

function initialState(config: TypingConfig): TypingSnapshot {
  return {
    passage: config.passage,
    typedChars: [],
    extraChars: [],
    currentIndex: 0,
    totalTime: config.duration,
    elapsedSeconds: 0,
    isRunning: false,
    isFinished: false,
    wpm: 0,
    rawWpm: 0,
    accuracy: 100,
    correctChars: 0,
    incorrectChars: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    totalKeystrokes: 0,
    mistakeWordIndices: new Set(),
    wordBoundaries: getWordBoundaries(config.passage.text),
    startTime: null,
    lockedIndex: 0,
    completedWords: 0,
    testMode: config.testMode,
    wordCount: config.wordCount,
    contentType: config.contentType,
  };
}

/**
 * Correct characters that count towards the reported WPM. In timed mode the word
 * being typed is not finished yet, so its progress is discarded until the word is
 * submitted; once the passage is complete there is no in-progress word to discard.
 */
export function netCorrectChars(state: TypingSnapshot): number {
  if (state.testMode !== 'timed') return state.correctChars;
  const currentWord = state.wordBoundaries.find(
    b => state.currentIndex >= b.start && state.currentIndex < b.end
  );
  if (!currentWord) return state.correctChars;
  let deducted = 0;
  for (let i = currentWord.start; i < state.currentIndex; i++) {
    if (state.typedChars[i] === state.passage.text[i]) deducted++;
  }
  return state.correctChars - deducted;
}

export function computeWpm(correctChars: number, elapsedSeconds: number): number {
  const elapsedMinutes = elapsedSeconds / 60;
  return elapsedMinutes > 0 ? Math.round((correctChars / 5) / elapsedMinutes) : 0;
}

export function computeRawWpm(totalKeystrokes: number, elapsedSeconds: number): number {
  const elapsedMinutes = elapsedSeconds / 60;
  return elapsedMinutes > 0 ? Math.round((totalKeystrokes / 5) / elapsedMinutes) : 0;
}

/**
 * Seconds of test time at `now`. The clock only samples every 100 ms, so the
 * final keystroke would otherwise be scored against a value up to 100 ms stale.
 */
export function elapsedSecondsAt(state: TypingSnapshot, now: number): number {
  if (state.startTime === null) return state.elapsedSeconds;
  const measured = (now - state.startTime) / 1000;
  const capped = state.testMode === 'timed' ? Math.min(measured, state.totalTime) : measured;
  return Math.max(state.elapsedSeconds, capped);
}

function finishState(state: TypingSnapshot, elapsedSeconds: number): TypingSnapshot {
  return {
    ...state,
    elapsedSeconds,
    isRunning: false,
    isFinished: true,
    wpm: computeWpm(netCorrectChars(state), elapsedSeconds),
    rawWpm: computeRawWpm(state.totalKeystrokes, elapsedSeconds),
  };
}

/**
 * Ends the test the moment the passage is exhausted, so the last keystroke lands on
 * a finished state instead of leaving the timer running until the next clock sample.
 */
function finishIfComplete(state: TypingSnapshot, now: number): TypingSnapshot {
  if (state.isFinished || state.currentIndex < state.passage.text.length) return state;
  return finishState(state, elapsedSecondsAt(state, now));
}

function reduce(state: TypingSnapshot, action: TypingAction): TypingSnapshot {
  switch (action.type) {
    case 'KEY_PRESS': {
      if (state.isFinished || state.currentIndex >= state.passage.text.length) return state;

      const expected = state.passage.text[state.currentIndex];

      // Case 1: space pressed but expected char is NOT a space
      // (cursor is mid-word)
      if (action.key === ' ' && expected !== ' ') {
        // Do nothing at position 0 — can't skip before typing
        if (state.currentIndex === 0) return state;

        // Find the end of the current word and the space after it
        const text = state.passage.text;
        let skipTo = state.currentIndex;

        // Advance to the end of the current word
        while (skipTo < text.length && text[skipTo] !== ' ') {
          skipTo++;
        }
        // Now skipTo points to the space character (or end of text)
        // Advance past the space to the start of the next word
        if (skipTo < text.length && text[skipTo] === ' ') {
          skipTo++; // skip the space itself
        }

        // A word abandoned mid-way is submitted short, so it is wrong by definition;
        // evaluating it against what is actually on screen keeps the flag honest.
        const wi = wordIndexAt(state.currentIndex, state.wordBoundaries);
        const newMistakes = withWordOutcome(
          state.mistakeWordIndices,
          wi,
          state.wordBoundaries[wi],
          text,
          state.typedChars,
          state.currentIndex
        );

        // Fill typedChars for skipped positions with empty
        // string so indices stay aligned — untyped chars
        // remain undefined, which renders as char-untyped
        // We don't fill them — just advance currentIndex
        // The render will show untyped chars as char-untyped
        // which is the correct Monkeytype behavior

        // Fill all skipped positions with '' so typedChars
        // stays aligned with currentIndex
        const newTypedChars = [...state.typedChars];
        while (newTypedChars.length < skipTo) {
          newTypedChars.push('');
        }

        return finishIfComplete({
          ...state,
          typedChars: newTypedChars,
          currentIndex: skipTo,
          lockedIndex: skipTo,
          completedWords: state.completedWords + 1,
          mistakeWordIndices: newMistakes,
          extraChars: [],
          totalKeystrokes: state.totalKeystrokes + 1,
          isRunning: true,
          startTime: state.startTime ?? Date.now(),
        }, Date.now());
      }

      // Case 2: space pressed at word boundary with no extraChars
      // (correct space)
      if (expected === ' ' && action.key === ' ' && state.extraChars.length === 0) {
        const newIndex = state.currentIndex + 1;
        // Submit the word that just ended: correct letters clear any earlier flag.
        const finishedWord = wordEndingAt(state.currentIndex, state.wordBoundaries);
        return finishIfComplete({
          ...state,
          typedChars: [...state.typedChars, ' '],
          currentIndex: newIndex,
          correctChars: state.correctChars + 1,
          totalCorrect: state.totalCorrect + 1,
          totalKeystrokes: state.totalKeystrokes + 1,
          lockedIndex: newIndex,
          completedWords: state.completedWords + 1,
          mistakeWordIndices: withWordOutcome(
            state.mistakeWordIndices,
            finishedWord,
            state.wordBoundaries[finishedWord],
            state.passage.text,
            state.typedChars,
            state.currentIndex
          ),
          extraChars: [],
          accuracy: Math.round(((state.totalCorrect + 1) / (state.totalCorrect + state.totalIncorrect + 1)) * 100),
          isRunning: true,
          startTime: state.startTime ?? Date.now(),
        }, Date.now());
      }

      // Case 3: space pressed at word boundary WITH extraChars
      // (submit word with errors)
      if (expected === ' ' && action.key === ' ' && state.extraChars.length > 0) {
        const newIndex = state.currentIndex + 1;
        // Overshot the word: the letters may be right, but the extras make it wrong.
        const finishedWord = wordEndingAt(state.currentIndex, state.wordBoundaries);
        const erroredMistakes = new Set(state.mistakeWordIndices);
        if (finishedWord >= 0) erroredMistakes.add(finishedWord);
        return finishIfComplete({
          ...state,
          typedChars: [...state.typedChars, ' '],
          currentIndex: newIndex,
          extraChars: [],
          lockedIndex: newIndex,
          completedWords: state.completedWords + 1,
          mistakeWordIndices: erroredMistakes,
          totalKeystrokes: state.totalKeystrokes + 1,
          isRunning: true,
          startTime: state.startTime ?? Date.now(),
        }, Date.now());
      }

      // Case 4: extra chars when cursor is at a space position
      // (typing non-space when expected is space)
      if (expected === ' ' && action.key !== ' ') {
        if (state.extraChars.length >= 20) return state;
        return {
          ...state,
          extraChars: [...state.extraChars, action.key],
          totalIncorrect: state.totalIncorrect + 1,
          incorrectChars: state.incorrectChars + 1,
          totalKeystrokes: state.totalKeystrokes + 1,
          accuracy: Math.round((state.totalCorrect / (state.totalCorrect + state.totalIncorrect + 1)) * 100),
          isRunning: true,
          startTime: state.startTime ?? Date.now(),
        };
      }

      // Case 5: normal character (not space, not at space position)
      const isCorrect = action.key === expected;
      const newCorrect = state.correctChars + (isCorrect ? 1 : 0);
      const newIncorrect = state.incorrectChars + (isCorrect ? 0 : 1);
      const newTotalCorrect = state.totalCorrect + (isCorrect ? 1 : 0);
      const newTotalIncorrect = state.totalIncorrect + (isCorrect ? 0 : 1);
      const totalAttempted = newTotalCorrect + newTotalIncorrect;
      const newMistakes = new Set(state.mistakeWordIndices);
      if (!isCorrect) {
        const wi = wordIndexAt(state.currentIndex, state.wordBoundaries);
        if (wi >= 0) newMistakes.add(wi);
      }
      const newIndex = state.currentIndex + 1;
      return finishIfComplete({
        ...state,
        typedChars: [...state.typedChars, action.key],
        currentIndex: newIndex,
        correctChars: newCorrect,
        incorrectChars: newIncorrect,
        totalCorrect: newTotalCorrect,
        totalIncorrect: newTotalIncorrect,
        accuracy: totalAttempted > 0
          ? Math.round((newTotalCorrect / totalAttempted) * 100)
          : 100,
        mistakeWordIndices: newMistakes,
        totalKeystrokes: state.totalKeystrokes + 1,
        isRunning: true,
        startTime: state.startTime ?? Date.now(),
        extraChars: [],
      }, Date.now());
    }
    case 'BACKSPACE': {
      if (state.extraChars.length > 0) {
        return {
          ...state,
          extraChars: state.extraChars.slice(0, -1),
          totalIncorrect: state.totalIncorrect - 1,
          incorrectChars: state.incorrectChars - 1,
        };
      }
      if (state.currentIndex <= state.lockedIndex) return state;
      const removed = state.typedChars[state.currentIndex - 1];
      const wasCorrect = removed === state.passage.text[state.currentIndex - 1];
      return {
        ...state,
        typedChars: state.typedChars.slice(0, -1),
        currentIndex: state.currentIndex - 1,
        correctChars: state.correctChars - (wasCorrect ? 1 : 0),
        incorrectChars: state.incorrectChars - (wasCorrect ? 0 : 1),
      };
    }
    case 'DELETE_WORD': {
      if (state.currentIndex <= state.lockedIndex && state.extraChars.length === 0) return state;
      if (state.extraChars.length > 0) {
        return {
          ...state,
          extraChars: [],
          totalIncorrect: state.totalIncorrect - state.extraChars.length,
          incorrectChars: state.incorrectChars - state.extraChars.length,
        };
      }
      let start = state.currentIndex - 1;
      while (start >= 0 && state.passage.text[start] === ' ') start--;
      while (start >= 0 && state.passage.text[start] !== ' ') start--;
      start++;
      if (start < state.lockedIndex) start = state.lockedIndex;
      let correctDeduction = 0;
      let incorrectDeduction = 0;
      for (let i = start; i < state.currentIndex; i++) {
        const typed = state.typedChars[i];
        if (typed === undefined) continue;
        if (typed === state.passage.text[i]) correctDeduction++;
        else incorrectDeduction++;
      }
      return {
        ...state,
        typedChars: state.typedChars.slice(0, start),
        currentIndex: start,
        correctChars: state.correctChars - correctDeduction,
        incorrectChars: state.incorrectChars - incorrectDeduction,
      };
    }
    case 'FINISH': {
      if (state.isFinished) return state;
      return finishState(state, elapsedSecondsAt(state, Date.now()));
    }
  }
}

export function computeMistakeWords(
  passage: Passage,
  typedChars: string[],
  mistakeIndices: Set<number>,
  boundaries: WordBoundary[]
): MistakeWord[] {
  const result: MistakeWord[] = [];
  const sorted = [...mistakeIndices].sort((a, b) => a - b);
  for (const wi of sorted) {
    const { start, end } = boundaries[wi];
    const expected = passage.text.slice(start, end);
    let typed = '';
    for (let i = start; i < end; i++) {
      typed += typedChars[i] !== undefined ? typedChars[i] : '';
    }
    result.push({ expected, typed: typed || '(skipped)' });
  }
  return result;
}

export interface TypingStore {
  getSnapshot(): TypingSnapshot;
  subscribe(listener: () => void): () => void;
  dispatch(action: TypingAction): void;
  /** Restarts the same test, or starts a new one when a config is passed. */
  reset(config?: TypingConfig): void;
}

/**
 * One store per mounted engine. It is not a module singleton like the clock:
 * solo and race each own a test, and a passage change must not reset the other.
 */
export function createTypingStore(initialConfig: TypingConfig): TypingStore {
  let config = initialConfig;
  let snapshot = initialState(config);
  const listeners = new Set<() => void>();

  function publish(next: TypingSnapshot): void {
    if (next === snapshot) return;
    snapshot = next;
    for (const listener of listeners) listener();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action) {
      publish(reduce(snapshot, action));
    },
    reset(nextConfig) {
      if (nextConfig) config = nextConfig;
      publish(initialState(config));
    },
  };
}

/**
 * The whole snapshot. For surfaces that genuinely need several fields at once
 * (the race input): solo readouts should use the narrow hooks below instead.
 */
export function useTypingState(store: TypingStore): TypingSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * Subscribes to one selected value. The selector must return a primitive or a
 * stable reference: `useSyncExternalStore` compares snapshots with `Object.is`.
 */
export function useTypingValue<T>(store: TypingStore, select: (snapshot: TypingSnapshot) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getSnapshot()),
    () => select(store.getSnapshot())
  );
}

export interface TypingSelection {
  typedChars: string[];
  currentIndex: number;
  lockedIndex: number;
  extraChars: string[];
  isFinished: boolean;
}

/**
 * The character-level slice the passage renders from. The fields are copied into
 * one cached object so `useSyncExternalStore` sees a stable reference between
 * keystrokes that do not change this selection, instead of re-rendering on every
 * unrelated commit (a clock publication never reaches the store, but a reset or
 * a counter bump would).
 */
export function useTypingSelection(store: TypingStore): TypingSelection {
  const cachedRef = useRef<TypingSelection | null>(null);

  const read = (): TypingSelection => {
    const snapshot = store.getSnapshot();
    const cached = cachedRef.current;
    if (
      cached !== null &&
      cached.typedChars === snapshot.typedChars &&
      cached.currentIndex === snapshot.currentIndex &&
      cached.lockedIndex === snapshot.lockedIndex &&
      cached.extraChars === snapshot.extraChars &&
      cached.isFinished === snapshot.isFinished
    ) {
      return cached;
    }
    const next: TypingSelection = {
      typedChars: snapshot.typedChars,
      currentIndex: snapshot.currentIndex,
      lockedIndex: snapshot.lockedIndex,
      extraChars: snapshot.extraChars,
      isFinished: snapshot.isFinished,
    };
    cachedRef.current = next;
    return next;
  };

  return useSyncExternalStore(store.subscribe, read, read);
}

/**
 * Mistake tracking as its own slice: the set is replaced only when a word is
 * flagged or cleared, so a consumer that only underlines words opts out of the
 * per-character notifications the selection hook needs.
 */
export function useMistakeTracker(store: TypingStore): Set<number> {
  return useTypingValue(store, snapshot => snapshot.mistakeWordIndices);
}
