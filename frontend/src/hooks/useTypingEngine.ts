import { useCallback, useEffect, useRef, useState } from 'react';
import type { Passage, Duration, TestResult, WpmPoint, ReplayEvent, TestMode, WordCount, ContentType } from '../types';
import { v4 } from '../utils/id';
import { beginTick } from '../utils/performance';
import { getClockSnapshot, publishClock, resetClock, type ClockSnapshot } from '../utils/typingClock';
import {
  computeMistakeWords,
  computeRawWpm,
  computeWpm,
  createTypingStore,
  elapsedSecondsAt,
  netCorrectChars,
  type TypingConfig,
  type TypingSnapshot,
  type TypingStore,
} from '../utils/typingStore';

/**
 * Mutable inputs for the external clock. `state` is the last committed store
 * snapshot; the history counters survive between publications so one point is
 * recorded per whole second, exactly like the old ticker did.
 */
interface ClockSource {
  state: TypingSnapshot;
  history: WpmPoint[];
  lastSecond: number;
  incorrectAtLastSecond: number;
}

function sampleClock(source: ClockSource, now: number): ClockSnapshot {
  const state = source.state;
  if (state.startTime === null) {
    return {
      elapsedSeconds: 0,
      timeLeft: state.totalTime,
      wpm: 0,
      rawWpm: 0,
      wpmHistory: source.history,
    };
  }

  const elapsed = elapsedSecondsAt(state, now);
  const timeLeft = state.testMode === 'timed'
    ? Math.max(0, Math.round((state.totalTime - elapsed) * 10) / 10)
    : state.totalTime;
  const wpm = computeWpm(netCorrectChars(state), elapsed);
  const second = Math.round(elapsed);

  if (state.isRunning && second > source.lastSecond) {
    source.history = [
      ...source.history,
      { time: second, wpm, errors: Math.max(0, state.totalIncorrect - source.incorrectAtLastSecond) },
    ];
    source.lastSecond = second;
    source.incorrectAtLastSecond = state.totalIncorrect;
  }

  return {
    elapsedSeconds: elapsed,
    timeLeft,
    wpm,
    rawWpm: computeRawWpm(state.totalKeystrokes, elapsed),
    wpmHistory: source.history,
  };
}

function computeConsistency(wpmHistory: WpmPoint[]): number {
  if (wpmHistory.length < 2) return 100;
  const wpms = wpmHistory.map(p => p.wpm);
  const mean = wpms.reduce((a, b) => a + b, 0) / wpms.length;
  if (mean === 0) return 100;
  const variance = wpms.reduce((sum, w) =>
    sum + Math.pow(w - mean, 2), 0) / wpms.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  const consistency = Math.max(0, Math.round((1 - cv) * 100));
  return Math.min(100, consistency);
}

export interface TypingEngine {
  /** External store owning the per-keystroke state. */
  store: TypingStore;
  handleKeyDown(e: React.KeyboardEvent): void;
  getResult(): TestResult;
  reset(): void;
}

/**
 * Wires the typing store to the keyboard, the clock and the result payload.
 *
 * The keystroke path never calls `setState`: `handleKeyDown` dispatches into the
 * store, and only the leaves subscribed to the changed fields re-render. This
 * hook keeps no React state of its own, so it never re-renders its caller; the
 * clock, the interval and the clock history live in refs beside the store.
 */
export function useTypingEngine(
  passage: Passage,
  duration: Duration,
  testMode: TestMode = 'timed',
  wordCount: WordCount = 25,
  contentType: ContentType = 'phrases'
): TypingEngine {
  // The store belongs to the mounted engine: created once, then reset by the
  // config effect below. It is intentionally not rebuilt per passage, so reset is
  // an action on the same subscription graph.
  const [store] = useState(() =>
    createTypingStore({ passage, duration, testMode, wordCount, contentType })
  );

  const replayEventsRef = useRef<ReplayEvent[]>([]);
  const clockSourceRef = useRef<ClockSource>({
    state: store.getSnapshot(),
    history: [],
    lastSecond: -1,
    incorrectAtLastSecond: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to every store commit: refresh the clock readouts and keep the
  // 100 ms interval alive only while a run is in progress. The interval itself
  // still publishes on its own beat between keystrokes.
  useEffect(() => {
    const source = clockSourceRef.current;

    const sync = () => {
      const next = store.getSnapshot();
      source.state = next;
      if (next.startTime === null) {
        source.history = [];
        source.lastSecond = -1;
        source.incorrectAtLastSecond = 0;
      }
      publishClock(sampleClock(source, Date.now()));

      const shouldTick = next.isRunning && !next.isFinished;
      if (shouldTick && intervalRef.current === null) {
        intervalRef.current = setInterval(() => {
          const current = source.state;
          if (!current.isRunning || current.isFinished) return;
          beginTick();
          const now = Date.now();
          publishClock(sampleClock(source, now));
          if (current.testMode === 'timed' && elapsedSecondsAt(current, now) >= current.totalTime) {
            store.dispatch({ type: 'FINISH' });
          }
        }, 100);
      } else if (!shouldTick && intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const unsubscribe = store.subscribe(sync);
    sync();

    return () => {
      unsubscribe();
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [store]);

  // A new passage or config resets the store and the clock. Low-frequency, so it
  // is a render effect rather than part of the keystroke path.
  useEffect(() => {
    replayEventsRef.current = [];
    resetClock(duration);
    const config: TypingConfig = { passage, duration, testMode, wordCount, contentType };
    store.reset(config);
  }, [store, passage, duration, testMode, wordCount, contentType]);

  const reset = useCallback(() => {
    replayEventsRef.current = [];
    store.reset();
  }, [store]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const now = Date.now();

    if (store.getSnapshot().isFinished) return;

    if (e.key === 'Backspace' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      replayEventsRef.current.push({ type: 'deleteWord', timestamp: now });
      store.dispatch({ type: 'DELETE_WORD' });
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      replayEventsRef.current.push({ type: 'backspace', timestamp: now });
      store.dispatch({ type: 'BACKSPACE' });
      return;
    }

    if (e.key.length === 1 && e.key >= ' ') {
      e.preventDefault();
      replayEventsRef.current.push({ type: 'key', key: e.key, timestamp: now });
      store.dispatch({ type: 'KEY_PRESS', key: e.key });
    }
  }, [store]);

  const getResult = useCallback((): TestResult => {
    const state = store.getSnapshot();
    const clock = getClockSnapshot();
    const elapsed = state.elapsedSeconds > 0 ? state.elapsedSeconds : clock.elapsedSeconds;
    const startTime = state.startTime ?? (replayEventsRef.current.length > 0 ? replayEventsRef.current[0].timestamp : Date.now());
    const normalizedEvents = replayEventsRef.current.map(e => ({
      ...e,
      timestamp: Math.max(0, e.timestamp - startTime),
    }));
    return {
      id: v4(),
      textId: state.passage.textId,
      title: state.passage.title,
      passage: state.passage.text,
      author: state.passage.author,
      source: state.passage.source,
      wpm: state.wpm || clock.wpm,
      rawWpm: state.rawWpm || clock.rawWpm,
      accuracy: state.accuracy,
      consistency: computeConsistency(clock.wpmHistory),
      duration: Math.max(1, Math.round(elapsed)),
      correctChars: state.correctChars,
      incorrectChars: state.incorrectChars,
      totalCorrect: state.totalCorrect,
      totalIncorrect: state.totalIncorrect,
      wpmHistory: clock.wpmHistory,
      mistakeWords: computeMistakeWords(state.passage, state.typedChars, state.mistakeWordIndices, state.wordBoundaries),
      replayEvents: normalizedEvents,
      testMode: state.testMode,
      wordCount: state.wordCount,
      contentType: state.contentType,
      date: new Date().toISOString(),
    };
  }, [store]);

  return { store, handleKeyDown, getResult, reset };
}
