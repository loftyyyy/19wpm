import { useSyncExternalStore } from 'react';
import type { RaceRoom } from '../types/race';

/**
 * Race room state, outside React.
 *
 * `/topic/room/{code}` replaces the whole room on every broadcast, and
 * `/topic/room/{code}/progress` replaces one participant's telemetry on every
 * progress tick. Holding that in the page's `useState` re-rendered the entire
 * race page — including the active typing input — for every tick and for every
 * change to an unrelated field.
 *
 * This store mirrors the typing store: the socket writes into it, and each
 * surface subscribes to the primitive it displays. The racing stage subscribes
 * to the text/start time only, `RaceTrack` subscribes to the participant list,
 * and the typing input subscribes to nothing in it at all.
 */

export interface RaceProgressDelta {
  userId: number;
  progressPercent: number;
  currentWpm: number;
  errors: number;
}

export interface RaceRoomStore {
  getSnapshot(): RaceRoom | null;
  subscribe(listener: () => void): () => void;
  /** Replace the room with a full snapshot (join, resume, broadcast). */
  set(room: RaceRoom | null): void;
  /**
   * Apply one high-frequency progress delta. Participants whose values did not
   * change keep their object identity and no notification is emitted when the
   * delta is a duplicate or targets an unknown participant.
   */
  applyProgress(delta: RaceProgressDelta): void;
}

export function createRaceRoomStore(): RaceRoomStore {
  let snapshot: RaceRoom | null = null;
  const listeners = new Set<() => void>();

  function publish(next: RaceRoom | null): void {
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

    set(room) {
      publish(room);
    },

    applyProgress(delta) {
      const current = snapshot;
      if (current === null) return;

      let changed = false;
      const participants = current.participants.map((participant) => {
        if (participant.userId !== delta.userId) return participant;
        if (
          participant.progressPercent === delta.progressPercent &&
          participant.currentWpm === delta.currentWpm &&
          participant.errors === delta.errors
        ) {
          return participant;
        }
        changed = true;
        return {
          ...participant,
          progressPercent: delta.progressPercent,
          currentWpm: delta.currentWpm,
          errors: delta.errors,
        };
      });

      if (!changed) return;
      publish({ ...current, participants });
    },
  };
}

/** The whole room snapshot. Only for stages that genuinely need several fields. */
export function useRaceRoom(store: RaceRoomStore): RaceRoom | null {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * One selected slice. The selector must return a primitive or a stable
 * reference: `useSyncExternalStore` compares snapshots with `Object.is`.
 */
export function useRaceRoomValue<T>(
  store: RaceRoomStore,
  select: (room: RaceRoom | null) => T
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getSnapshot()),
    () => select(store.getSnapshot())
  );
}
