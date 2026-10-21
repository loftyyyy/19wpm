import { useRef, useState, useEffect, useCallback } from 'react';
import type { Passage, Mode, WordCount, PhraseLength, TextDifficulty, TextType } from '../types';
import type { ApiTextResponse, ApiWordResponse } from '../types/api';
import { api } from '../services/api';
import { generateTestPassage } from '../utils/passages';

const PASSAGE_DEADLINE_MS = 1500;
const RETRY_DELAY_MS = 250;
const MAX_ATTEMPTS = 2;

function charLengthToType(charLength: number): TextType {
  if (charLength < 100) return 'SHORT';
  if (charLength < 300) return 'MEDIUM';
  if (charLength < 500) return 'LONG';
  return 'THICC';
}

function waitForRetry(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const timeoutId = window.setTimeout(cleanup, RETRY_DELAY_MS);
    function cleanup() {
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', cleanup);
      resolve();
    }
    signal.addEventListener('abort', cleanup, { once: true });
  });
}

async function fetchPassages(
  mode: Mode,
  duration: number,
  wordCount: WordCount,
  phraseLength: PhraseLength,
  difficulty: TextDifficulty,
  signal: AbortSignal
): Promise<Passage[]> {
  if (mode === 'phrases') {
    const type = phraseLength === 'all'
      ? undefined
      : phraseLength.toUpperCase();
    const params = new URLSearchParams({
      language: 'en',
      count: '5'
    });
    if (type) params.set('textType', type);
    const data = await api.get<ApiTextResponse[]>(
      `/texts?${params.toString()}`,
      'json',
      { signal }
    );
    return data.map(dto => ({
      textId: dto.textId,
      title: dto.title,
      text: dto.content,
      author: dto.author,
      source: dto.source,
      type: charLengthToType(dto.charLength),
    }));
  }

  const count = mode === 'time'
    ? Math.max(200, duration * 4)
    : wordCount;
  const batchCount = mode === 'words' ? wordCount * 5 : count;
  const data = await api.get<ApiWordResponse[]>(
    `/words?language=en&difficulty=${difficulty}&count=${batchCount}`,
    'json',
    { signal }
  );

  if (mode === 'words') {
    const words = data.map(w => w.word);
    const passages: Passage[] = [];
    for (let i = 0; i < words.length; i += wordCount) {
      const chunk = words.slice(i, i + wordCount);
      if (chunk.length === wordCount) {
        passages.push({
          title: '',
          text: chunk.join(' '),
          author: 'random',
          source: 'word list'
        });
      }
    }
    return passages;
  }

  return [{
    title: '',
    text: data.map(w => w.word).join(' '),
    author: 'random',
    source: 'word list'
  }];
}

export function usePassageQueue(
  mode: Mode,
  duration: number,
  wordCount: WordCount,
  phraseLength: PhraseLength,
  difficulty: TextDifficulty
): {
  next: () => Passage | null;
  isLoading: boolean;
} {
  const queueRef = useRef<Passage[]>([]);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBatch = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const deadlineAt = Date.now() + PASSAGE_DEADLINE_MS;
    const deadlineId = window.setTimeout(() => controller.abort(), PASSAGE_DEADLINE_MS);

    try {
      let passages: Passage[] = [];

      for (let attempt = 0; attempt < MAX_ATTEMPTS && requestId === requestIdRef.current && !controller.signal.aborted; attempt++) {
        try {
          passages = await fetchPassages(
            mode, duration, wordCount, phraseLength, difficulty, controller.signal
          );
          if (passages.length > 0) break;
          throw new Error('Empty batch received');
        } catch (err) {
          if (requestId !== requestIdRef.current || controller.signal.aborted) break;
          console.error('Passage queue fetch failed:', err);
          if (attempt === MAX_ATTEMPTS - 1) break;
          if (deadlineAt - Date.now() < RETRY_DELAY_MS * 2) break;
          await waitForRetry(controller.signal);
        }
      }

      if (requestId !== requestIdRef.current) return;

      if (passages.length === 0) {
        passages = [generateTestPassage(mode, duration, wordCount, phraseLength)];
      }
      queueRef.current = [...queueRef.current, ...passages];
    } finally {
      window.clearTimeout(deadlineId);
      if (requestId === requestIdRef.current) {
        isFetchingRef.current = false;
        abortControllerRef.current = null;
        if (queueRef.current.length > 0) setIsLoading(false);
      }
    }
  }, [mode, duration, wordCount, phraseLength, difficulty]);

  useEffect(() => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    isFetchingRef.current = false;
    queueRef.current = [];
    setIsLoading(true);
    void fetchBatch();

    return () => {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, [fetchBatch]);

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
