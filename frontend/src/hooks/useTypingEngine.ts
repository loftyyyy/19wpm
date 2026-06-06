import { useReducer, useEffect, useCallback, useRef } from 'react';
import type { Passage, Duration, TestResult, WpmPoint, MistakeWord, ReplayEvent, TestMode, WordCount, ContentType } from '../types';
import { v4 } from '../utils/id';

interface WordBoundary {
  start: number;
  end: number;
}

function getWordBoundaries(text: string): WordBoundary[] {
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

function wordIndexAt(charIndex: number, boundaries: WordBoundary[]): number {
  for (let i = 0; i < boundaries.length; i++) {
    if (charIndex >= boundaries[i].start && charIndex < boundaries[i].end) return i;
  }
  return -1;
}

interface TypingState {
  passage: Passage;
  typedChars: string[];
  extraChars: string[];
  currentIndex: number;
  timeLeft: number;
  totalTime: number;
  elapsedSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
  wpm: number;
  accuracy: number;
  wpmHistory: WpmPoint[];
  correctChars: number;
  incorrectChars: number;
  totalCorrect: number;
  totalIncorrect: number;
  errorsThisSecond: number;
  mistakeWordIndices: Set<number>;
  wordBoundaries: WordBoundary[];
  startTime: number | null;
  lockedIndex: number;
  testMode: TestMode;
  wordCount: WordCount;
  contentType: ContentType;
}

type Action =
  | { type: 'KEY_PRESS'; key: string }
  | { type: 'BACKSPACE' }
  | { type: 'DELETE_WORD' }
  | { type: 'TICK' }
  | { type: 'RESET'; passage: Passage; duration: Duration; testMode: TestMode; wordCount: WordCount; contentType: ContentType };

function initialState(passage: Passage, duration: Duration, testMode: TestMode, wordCount: WordCount, contentType: ContentType): TypingState {
  return {
    passage,
    typedChars: [],
    extraChars: [],
    currentIndex: 0,
    timeLeft: duration,
    totalTime: duration,
    elapsedSeconds: 0,
    isRunning: false,
    isFinished: false,
    wpm: 0,
    accuracy: 100,
    wpmHistory: [],
    correctChars: 0,
    incorrectChars: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    errorsThisSecond: 0,
    mistakeWordIndices: new Set(),
    wordBoundaries: getWordBoundaries(passage.text),
    startTime: null,
    lockedIndex: 0,
    testMode,
    wordCount,
    contentType,
  };
}

function reducer(state: TypingState, action: Action): TypingState {
  switch (action.type) {
    case 'KEY_PRESS': {
      if (state.isFinished || state.currentIndex >= state.passage.text.length) return state;
      const expected = state.passage.text[state.currentIndex];

      if (expected === ' ' && action.key !== ' ') {
        return {
          ...state,
          extraChars: [...state.extraChars, action.key],
          totalIncorrect: state.totalIncorrect + 1,
          incorrectChars: state.incorrectChars + 1,
          errorsThisSecond: state.errorsThisSecond + 1,
          accuracy: Math.round((state.totalCorrect / (state.totalCorrect + state.totalIncorrect + 1)) * 100),
          isRunning: true,
          startTime: state.startTime ?? Date.now(),
        };
      }

      if (expected === ' ' && state.extraChars.length > 0) return state;

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
      return {
        ...state,
        typedChars: [...state.typedChars, action.key],
        currentIndex: newIndex,
        correctChars: newCorrect,
        incorrectChars: newIncorrect,
        totalCorrect: newTotalCorrect,
        totalIncorrect: newTotalIncorrect,
        errorsThisSecond: state.errorsThisSecond + (isCorrect ? 0 : 1),
        accuracy: totalAttempted > 0 ? Math.round((newTotalCorrect / totalAttempted) * 100) : 100,
        mistakeWordIndices: newMistakes,
        isRunning: true,
        startTime: state.startTime ?? Date.now(),
        lockedIndex: action.key === ' ' ? newIndex : state.lockedIndex,
        extraChars: action.key === ' ' ? [] : state.extraChars,
      };
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
    case 'TICK': {
      const newElapsed = state.elapsedSeconds + 0.1;
      const roundedElapsed = Math.round(newElapsed);
      const elapsedMinutes = newElapsed / 60;
      const netCorrect = state.correctChars;
      const wpm = elapsedMinutes > 0 ? Math.round((netCorrect / 5) / elapsedMinutes) : 0;
      const newTimeLeft = state.testMode === 'timed'
        ? Math.max(0, Math.round((state.timeLeft - 0.1) * 10) / 10)
        : state.timeLeft;
      const finishedByTime = state.testMode === 'timed' && newTimeLeft <= 0;
      const finishedByPassage = state.currentIndex >= state.passage.text.length;
      const finished = finishedByTime || finishedByPassage;
      const lastRecorded = state.wpmHistory.length > 0 ? state.wpmHistory[state.wpmHistory.length - 1].time : -1;
      const shouldRecord = roundedElapsed > lastRecorded;
      return {
        ...state,
        timeLeft: newTimeLeft,
        elapsedSeconds: newElapsed,
        wpm,
        wpmHistory: finished
          ? state.wpmHistory
          : shouldRecord
            ? [...state.wpmHistory, { time: roundedElapsed, wpm, errors: state.errorsThisSecond }]
            : state.wpmHistory,
        errorsThisSecond: shouldRecord ? 0 : state.errorsThisSecond,
        isRunning: !finished,
        isFinished: finished,
      };
    }
    case 'RESET':
      return initialState(action.passage, action.duration, action.testMode, action.wordCount, action.contentType);
  }
}

function computeMistakeWords(
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

export function useTypingEngine(passage: Passage, duration: Duration, testMode: TestMode = 'timed', wordCount: WordCount = 25, contentType: ContentType = 'phrases') {
  const [state, dispatch] = useReducer(reducer, { passage, duration, testMode, wordCount, contentType }, (cfg) => initialState(cfg.passage, cfg.duration, cfg.testMode, cfg.wordCount, cfg.contentType));
  const replayEventsRef = useRef<ReplayEvent[]>([]);

  useEffect(() => {
    replayEventsRef.current = [];
    dispatch({ type: 'RESET', passage, duration, testMode, wordCount, contentType });
  }, [passage, duration, testMode, wordCount, contentType]);

  useEffect(() => {
    if (!state.isRunning || state.isFinished) return;
    const interval = setInterval(() => dispatch({ type: 'TICK' }), 100);
    return () => clearInterval(interval);
  }, [state.isRunning, state.isFinished]);

  const reset = useCallback(() => {
    replayEventsRef.current = [];
    dispatch({ type: 'RESET', passage, duration, testMode, wordCount, contentType });
  }, [passage, duration, testMode, wordCount, contentType]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const now = Date.now();

    if (e.key === 'Escape') {
      e.preventDefault();
      reset();
      return;
    }
    if (state.isFinished) return;

    if (e.key === 'Backspace' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      replayEventsRef.current.push({ type: 'deleteWord', timestamp: now });
      dispatch({ type: 'DELETE_WORD' });
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      replayEventsRef.current.push({ type: 'backspace', timestamp: now });
      dispatch({ type: 'BACKSPACE' });
      return;
    }

    if (e.key.length === 1 && e.key >= ' ') {
      e.preventDefault();
      replayEventsRef.current.push({ type: 'key', key: e.key, timestamp: now });
      dispatch({ type: 'KEY_PRESS', key: e.key });
    }
  }, [state.isFinished, reset]);

  const getResult = useCallback((): TestResult => {
    const elapsed = state.testMode === 'timed' ? state.totalTime - state.timeLeft : Math.round(state.elapsedSeconds);
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
      wpm: state.wpm,
      accuracy: state.accuracy,
      duration: Math.max(1, elapsed),
      correctChars: state.correctChars,
      incorrectChars: state.incorrectChars,
      totalCorrect: state.totalCorrect,
      totalIncorrect: state.totalIncorrect,
      wpmHistory: state.wpmHistory,
      mistakeWords: computeMistakeWords(state.passage, state.typedChars, state.mistakeWordIndices, state.wordBoundaries),
      replayEvents: normalizedEvents,
      testMode: state.testMode,
      wordCount: state.wordCount,
      contentType: state.contentType,
      date: new Date().toISOString(),
    };
  }, [state]);

  return { state, dispatch, handleKeyDown, getResult, reset };
}
