import { useSyncExternalStore } from 'react';
import type { WpmPoint } from '../types';

/**
 * Time-derived values for the typing surface.
 *
 * They live outside React state on purpose. The engine publishes a snapshot
 * every 100 ms while a test runs, and only the small readouts that subscribe to
 * this store re-render — the passage, its characters and the caret animation
 * stay untouched. Keystrokes publish too, so the visible WPM follows typing
 * instead of waiting for the next timer beat.
 */
export interface ClockSnapshot {
  elapsedSeconds: number;
  timeLeft: number;
  wpm: number;
  rawWpm: number;
  wpmHistory: WpmPoint[];
}

const EMPTY_HISTORY: WpmPoint[] = [];

function idleSnapshot(totalTime: number): ClockSnapshot {
  return {
    elapsedSeconds: 0,
    timeLeft: totalTime,
    wpm: 0,
    rawWpm: 0,
    wpmHistory: EMPTY_HISTORY,
  };
}

let snapshot: ClockSnapshot = idleSnapshot(0);
const listeners = new Set<() => void>();

export function getClockSnapshot(): ClockSnapshot {
  return snapshot;
}

export function subscribeClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishClock(next: ClockSnapshot): void {
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Clears a previous passage's history before a new test is mounted. */
export function resetClock(totalTime: number): void {
  publishClock(idleSnapshot(totalTime));
}

export function useClock(): ClockSnapshot {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot);
}

/**
 * Subscribes to one value. The selector must return a primitive or a stable
 * reference, because `useSyncExternalStore` compares snapshots with `Object.is`.
 */
export function useClockValue<T>(select: (snapshot: ClockSnapshot) => T): T {
  return useSyncExternalStore(
    subscribeClock,
    () => select(getClockSnapshot()),
    () => select(getClockSnapshot())
  );
}
