import { useReducer, useEffect, useCallback } from 'react';
import type { Passage, Duration, TestResult } from '../types';
import { v4 } from '../utils/id';

interface TypingState {
  passage: Passage;
  typedChars: string[];
  currentIndex: number;
  timeLeft: number;
  totalTime: number;
  isRunning: boolean;
  isFinished: boolean;
  wpm: number;
  accuracy: number;
  wpmHistory: { time: number; wpm: number }[];
  correctChars: number;
  incorrectChars: number;
  startTime: number | null;
}

type Action =
  | { type: 'KEY_PRESS'; key: string }
  | { type: 'BACKSPACE' }
  | { type: 'DELETE_WORD' }
  | { type: 'TICK' }
  | { type: 'RESET'; passage: Passage; duration: Duration };

function initialState(passage: Passage, duration: Duration): TypingState {
  return {
    passage,
    typedChars: [],
    currentIndex: 0,
    timeLeft: duration,
    totalTime: duration,
    isRunning: false,
    isFinished: false,
    wpm: 0,
    accuracy: 100,
    wpmHistory: [],
    correctChars: 0,
    incorrectChars: 0,
    startTime: null,
  };
}

function calcAccuracy(correct: number, incorrect: number): number {
  const total = correct + incorrect;
  return total > 0 ? Math.round((correct / total) * 100) : 100;
}

function reducer(state: TypingState, action: Action): TypingState {
  switch (action.type) {
    case 'KEY_PRESS': {
      if (state.isFinished || state.currentIndex >= state.passage.text.length) return state;
      const expected = state.passage.text[state.currentIndex];
      const isCorrect = action.key === expected;
      const newCorrect = state.correctChars + (isCorrect ? 1 : 0);
      const newIncorrect = state.incorrectChars + (isCorrect ? 0 : 1);
      return {
        ...state,
        typedChars: [...state.typedChars, action.key],
        currentIndex: state.currentIndex + 1,
        correctChars: newCorrect,
        incorrectChars: newIncorrect,
        accuracy: calcAccuracy(newCorrect, newIncorrect),
        isRunning: true,
        startTime: state.startTime ?? Date.now(),
      };
    }
    case 'BACKSPACE': {
      if (state.currentIndex <= 0) return state;
      const removed = state.typedChars[state.currentIndex - 1];
      const wasCorrect = removed === state.passage.text[state.currentIndex - 1];
      const newCorrect = state.correctChars - (wasCorrect ? 1 : 0);
      const newIncorrect = state.incorrectChars - (wasCorrect ? 0 : 1);
      const newTyped = state.typedChars.slice(0, -1);
      return {
        ...state,
        typedChars: newTyped,
        currentIndex: state.currentIndex - 1,
        correctChars: newCorrect,
        incorrectChars: newIncorrect,
        accuracy: calcAccuracy(newCorrect, newIncorrect),
      };
    }
    case 'DELETE_WORD': {
      if (state.currentIndex <= 0) return state;
      let start = state.currentIndex - 1;
      while (start >= 0 && state.passage.text[start] === ' ') start--;
      while (start >= 0 && state.passage.text[start] !== ' ') start--;
      start++;
      let correctDeduction = 0;
      let incorrectDeduction = 0;
      for (let i = start; i < state.currentIndex; i++) {
        const typed = state.typedChars[i];
        if (typed === undefined) continue;
        if (typed === state.passage.text[i]) correctDeduction++;
        else incorrectDeduction++;
      }
      const newCorrect = state.correctChars - correctDeduction;
      const newIncorrect = state.incorrectChars - incorrectDeduction;
      return {
        ...state,
        typedChars: state.typedChars.slice(0, start),
        currentIndex: start,
        correctChars: newCorrect,
        incorrectChars: newIncorrect,
        accuracy: calcAccuracy(newCorrect, newIncorrect),
      };
    }
    case 'TICK': {
      const newTimeLeft = Math.round((state.timeLeft - 0.1) * 10) / 10;
      const elapsedSeconds = Math.round(state.totalTime - newTimeLeft);
      const elapsedMinutes = elapsedSeconds / 60;
      const wpm = elapsedMinutes > 0 ? Math.round((state.correctChars / 5) / elapsedMinutes) : 0;
      const finished = newTimeLeft <= 0 || state.currentIndex >= state.passage.text.length;
      const lastRecorded = state.wpmHistory.length > 0 ? state.wpmHistory[state.wpmHistory.length - 1].time : -1;
      const shouldRecord = elapsedSeconds > lastRecorded;
      return {
        ...state,
        timeLeft: Math.max(0, newTimeLeft),
        wpm,
        wpmHistory: finished ? state.wpmHistory : shouldRecord ? [...state.wpmHistory, { time: elapsedSeconds, wpm }] : state.wpmHistory,
        isRunning: !finished,
        isFinished: finished,
      };
    }
    case 'RESET':
      return initialState(action.passage, action.duration);
  }
}

export function useTypingEngine(passage: Passage, duration: Duration) {
  const [state, dispatch] = useReducer(reducer, passage, (p) => initialState(p, duration));

  useEffect(() => {
    dispatch({ type: 'RESET', passage, duration });
  }, [passage, duration]);

  useEffect(() => {
    if (!state.isRunning || state.isFinished) return;
    const interval = setInterval(() => dispatch({ type: 'TICK' }), 100);
    return () => clearInterval(interval);
  }, [state.isRunning, state.isFinished]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET', passage, duration });
  }, [passage, duration]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      reset();
      return;
    }
    if (state.isFinished) return;

    if (e.key === 'Backspace' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      dispatch({ type: 'DELETE_WORD' });
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      dispatch({ type: 'BACKSPACE' });
      return;
    }

    if (e.key.length === 1 && e.key >= ' ') {
      e.preventDefault();
      dispatch({ type: 'KEY_PRESS', key: e.key });
    }
  }, [state.isFinished, reset]);

  const getResult = useCallback((): TestResult => {
    const elapsed = state.totalTime - state.timeLeft;
    return {
      id: v4(),
      passage: state.passage.text,
      author: state.passage.author,
      source: state.passage.source,
      wpm: state.wpm,
      accuracy: state.accuracy,
      duration: Math.round(elapsed),
      correctChars: state.correctChars,
      incorrectChars: state.incorrectChars,
      wpmHistory: state.wpmHistory,
      date: new Date().toISOString(),
    };
  }, [state]);

  return { state, dispatch, handleKeyDown, getResult, reset };
}
