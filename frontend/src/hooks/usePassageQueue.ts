import { useRef, useState, useEffect, useCallback } from 'react';
import type { Passage, Mode, WordCount, PhraseLength, TextDifficulty, TextType } from '../types';
import type { ApiTextResponse, ApiWordResponse } from '../types/api';
import { api } from '../services/api';
import { generateTestPassage } from '../services/passages';

function charLengthToType(charLength: number): TextType {
  if (charLength < 100) return 'SHORT';
  if (charLength < 300) return 'MEDIUM';
  if (charLength < 500) return 'LONG';
  return 'THICC';
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
  const retryCountRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBatch = useCallback(async (retry = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    retryCountRef.current = retry ? retryCountRef.current : 0;
    try {
      let passages: Passage[] = [];
      if (mode === 'words' || mode === 'time') {
        const count = mode === 'time'
          ? Math.max(200, duration * 4)
          : wordCount;
        const batchCount = mode === 'words' ? wordCount * 5 : count;
        const data = await api.get<ApiWordResponse[]>(
          `/words?language=en&difficulty=${difficulty}&count=${batchCount}`
        );
        if (mode === 'words') {
          const words = data.map(w => w.word);
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
        } else {
          const text = data.map(w => w.word).join(' ');
          passages.push({
            title: '',
            text,
            author: 'random',
            source: 'word list'
          });
        }
      } else if (mode === 'phrases') {
        const type = phraseLength === 'all'
          ? undefined
          : phraseLength.toUpperCase();
        const params = new URLSearchParams({
          language: 'en',
          count: '5'
        });
        if (type) params.set('textType', type);
        const data = await api.get<ApiTextResponse[]>(
          `/texts?${params.toString()}`
        );
        passages = data.map(dto => ({
          textId: dto.textId,
          title: dto.title,
          text: dto.content,
          author: dto.author,
          source: dto.source,
          type: charLengthToType(dto.charLength),
        }));
      }

      if (passages.length > 0) {
        queueRef.current = [...queueRef.current, ...passages];
        retryCountRef.current = 0;
      } else {
        throw new Error('Empty batch received');
      }
    } catch (err) {
      console.error('Passage queue fetch failed:', err);
      if (retryCountRef.current === 0) {
        retryCountRef.current = 1;
        isFetchingRef.current = false;
        await fetchBatch(true);
        return;
      }
      const fallback = await generateTestPassage(
        mode, duration, wordCount, phraseLength, difficulty
      );
      queueRef.current = [...queueRef.current, fallback];
    } finally {
      isFetchingRef.current = false;
      if (queueRef.current.length > 0) setIsLoading(false);
    }
  }, [mode, duration, wordCount, phraseLength, difficulty]);

  useEffect(() => {
    queueRef.current = [];
    isFetchingRef.current = false;
    setIsLoading(true);
    fetchBatch();
  }, [mode, duration, wordCount, phraseLength, difficulty]);

  const next = useCallback((): Passage | null => {
    if (queueRef.current.length === 0) return null;
    const passage = queueRef.current.shift()!;
    if (queueRef.current.length < 20 && !isFetchingRef.current) {
      fetchBatch();
    }
    return passage;
  }, [fetchBatch]);

  return { next, isLoading };
}
