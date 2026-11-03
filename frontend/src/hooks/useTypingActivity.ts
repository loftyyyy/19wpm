import { useSyncExternalStore } from 'react';

/**
 * Whether the user typed within the last 500 ms, used to keep the caret solid
 * while keys are pressed and to let it blink when idle.
 *
 * The flag lives outside React state because it flips on every typing burst, not
 * on every passage change. Subscribing the test component would re-render the
 * whole typing surface once per burst for a decorative class, so only the caret
 * subscribes; every other caller just pokes `markTypingActive`.
 */
const IDLE_MS = 500;

let isTypingActive = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function publish(next: boolean): void {
  if (next === isTypingActive) return;
  isTypingActive = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return isTypingActive;
}

/** Starts or extends the active window. Safe to call from an event handler. */
export function markTypingActive(): void {
  publish(true);
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => publish(false), IDLE_MS);
}

/** Subscribes the calling component to the flag. */
export function useTypingActivity(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
