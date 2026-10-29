import { useRef, useState, useEffect, useCallback } from 'react';
import type {
  Duration,
  Mode,
  Passage,
  PhraseLength,
  TextDifficulty,
  WordCount
} from '../types';
import {
  getCachedPassages,
  isPassageCacheStale,
  prefetchPassages
} from '../services/passageCache';
import { charLengthToType, generateTestPassage } from '../utils/passages';

const PASSAGE_DEADLINE_MS = 1500;

function matchesPhraseLength(passage: Passage, phraseLength: PhraseLength): boolean {
  if (phraseLength === 'all') return true;
  const type = passage.type ?? charLengthToType(passage.text.length);
  return type === phraseLength.toUpperCase();
}

function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error('Passage fetch deadline exceeded')),
      timeoutMs
    );
    promise.then(
      value => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      err => {
        window.clearTimeout(timeoutId);
        reject(err);
      }
    );
  });
}

export function usePassageQueue(
  mode: Mode,
  duration: Duration,
  wordCount: WordCount,
  phraseLength: PhraseLength,
  difficulty: TextDifficulty
): {
  next: () => Passage | null;
  isLoading: boolean;
} {
  const queueRef = useRef<Passage[]>([]);
  const isFetchingRef = useRef(false);
  const requestIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBatch = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const requestId = ++requestIdRef.current;

    try {
      const passages = await withDeadline(
        prefetchPassages(
          { mode, duration, wordCount, phraseLength, difficulty },
          { force: true }
        ),
        PASSAGE_DEADLINE_MS
      );
      if (requestId !== requestIdRef.current) return;
      // Strictly enforce the requested phrase length so a cache or fallback entry that does
      // not belong to the selected type can never be served to the typist.
      const accepted = mode === 'phrases'
        ? passages.filter(passage => matchesPhraseLength(passage, phraseLength))
        : passages;
      if (accepted.length === 0) {
        throw new Error('Empty passage batch received');
      }
      queueRef.current = [...queueRef.current, ...accepted];
    } catch {
      if (requestId !== requestIdRef.current) return;
      queueRef.current = [
        ...queueRef.current,
        generateTestPassage(mode, duration, wordCount, phraseLength)
      ];
    } finally {
      if (requestId === requestIdRef.current) {
        isFetchingRef.current = false;
        if (queueRef.current.length > 0) setIsLoading(false);
      }
    }
  }, [mode, duration, wordCount, phraseLength, difficulty]);

  useEffect(() => {
    requestIdRef.current += 1;
    isFetchingRef.current = false;
    const preferences = {
      mode,
      duration,
      wordCount,
      phraseLength,
      difficulty
    };
    const cached = getCachedPassages(preferences);

    queueRef.current = (cached ?? []).filter(passage =>
      mode === 'phrases' ? matchesPhraseLength(passage, phraseLength) : true
    );
    if (queueRef.current.length > 0) {
      setIsLoading(false);
      if (isPassageCacheStale(preferences)) {
        void fetchBatch();
      }
    } else {
      setIsLoading(true);
      void fetchBatch();
    }

    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchBatch, mode, duration, wordCount, phraseLength, difficulty]);

  const next = useCallback((): Passage | null => {
    if (queueRef.current.length === 0) return null;
    const passage = queueRef.current.shift()!;
    if (queueRef.current.length < 20 && !isFetchingRef.current) {
      void fetchBatch();
    }
    return passage;
  }, [fetchBatch]);

  return { next, isLoading };
}
