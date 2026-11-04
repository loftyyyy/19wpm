/**
 * Leading-edge + trailing publisher for high-frequency progress telemetry.
 *
 * The race engine reports on every store commit, which is every keystroke. A
 * STOMP publish per key is wasted bandwidth, and the server only broadcasts the
 * latest state of a participant anyway. This coalescer sends the first payload
 * immediately (so the other racers see the start of the run without waiting for
 * a full interval), then at most one payload per `intervalMs`, always leaving the
 * newest value queued so the last keystroke before a pause is not lost.
 *
 * Identical payloads are dropped: when the reported values did not change there
 * is nothing for the server or the other clients to apply.
 *
 * The interval is owned by the caller, which flushes on the finish edge and
 * disposes on room change/unmount. `dispose()` discards a pending payload: a
 * progress tick for a room that is gone must not be published later.
 */

export interface ProgressPayload {
  progressPercent: number;
  currentWpm: number;
  errors: number;
}

export interface ProgressPublisher {
  /** Queue a sample. Sends now on the leading edge, otherwise after the interval. */
  push(payload: ProgressPayload): void;
  /** Deliver the newest queued sample immediately (used before finishing). */
  flush(): void;
  /** Cancel the timer and drop anything still queued. */
  dispose(): void;
}

export interface ProgressPublisherOptions {
  send: (payload: ProgressPayload) => void;
  intervalMs?: number;
  now?: () => number;
}

function samePayload(a: ProgressPayload, b: ProgressPayload): boolean {
  return (
    a.progressPercent === b.progressPercent &&
    a.currentWpm === b.currentWpm &&
    a.errors === b.errors
  );
}

export function createProgressPublisher({
  send,
  intervalMs = 100,
  now = Date.now,
}: ProgressPublisherOptions): ProgressPublisher {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: ProgressPayload | null = null;
  let lastSent: ProgressPayload | null = null;
  let lastSentAt = 0;
  let disposed = false;

  function emit(payload: ProgressPayload): void {
    if (lastSent !== null && samePayload(lastSent, payload)) return;
    lastSent = payload;
    lastSentAt = now();
    send(payload);
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(): void {
    if (timer !== null) return;
    const wait = Math.max(0, intervalMs - (now() - lastSentAt));
    timer = setTimeout(() => {
      timer = null;
      if (disposed) return;
      const payload = pending;
      pending = null;
      if (payload !== null) emit(payload);
    }, wait);
  }

  return {
    push(payload) {
      if (disposed) return;

      // Leading edge: the first sample, or the first one after a quiet interval,
      // goes out now instead of waiting for the trailing timer.
      if (lastSent === null || now() - lastSentAt >= intervalMs) {
        clearTimer();
        pending = null;
        emit(payload);
        return;
      }

      pending = payload;
      schedule();
    },

    flush() {
      if (disposed) return;
      clearTimer();
      const payload = pending;
      pending = null;
      if (payload !== null) emit(payload);
    },

    dispose() {
      disposed = true;
      clearTimer();
      pending = null;
    },
  };
}
