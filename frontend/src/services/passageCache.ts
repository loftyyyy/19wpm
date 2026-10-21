import type {
  Duration,
  Mode,
  Passage,
  PhraseLength,
  TextDifficulty,
  TextType,
  WordCount
} from '../types';
import type { ApiTextResponse, ApiWordResponse } from '../types/api';
import { api } from './api';

const PASSAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 250;
const MAX_ATTEMPTS = 2;

export interface PassagePreferences {
  mode: Mode;
  duration: Duration;
  wordCount: WordCount;
  phraseLength: PhraseLength;
  difficulty: TextDifficulty;
}

interface CacheEntry {
  passages: Passage[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Passage[]>>();

function charLengthToType(charLength: number): TextType {
  if (charLength < 100) return 'SHORT';
  if (charLength < 300) return 'MEDIUM';
  if (charLength < 500) return 'LONG';
  return 'THICC';
}

export function getPassageCacheKey(preferences: PassagePreferences): string {
  if (preferences.mode === 'phrases') {
    return `phrases:${preferences.phraseLength}`;
  }
  if (preferences.mode === 'time') {
    return `time:${preferences.duration}:${preferences.difficulty}`;
  }
  return `words:${preferences.wordCount}:${preferences.difficulty}`;
}

export function getCachedPassages(preferences: PassagePreferences): Passage[] | null {
  const entry = cache.get(getPassageCacheKey(preferences));
  return entry ? [...entry.passages] : null;
}

export function isPassageCacheStale(preferences: PassagePreferences): boolean {
  const entry = cache.get(getPassageCacheKey(preferences));
  return !entry || entry.expiresAt <= Date.now();
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

async function fetchOnce(
  preferences: PassagePreferences,
  signal: AbortSignal
): Promise<Passage[]> {
  if (preferences.mode === 'phrases') {
    const type = preferences.phraseLength === 'all'
      ? undefined
      : preferences.phraseLength.toUpperCase();
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
      type: charLengthToType(dto.charLength)
    }));
  }

  const count = preferences.mode === 'time'
    ? Math.max(200, preferences.duration * 4)
    : preferences.wordCount;
  const batchCount = preferences.mode === 'words'
    ? preferences.wordCount * 5
    : count;
  const data = await api.get<ApiWordResponse[]>(
    `/words?language=en&difficulty=${preferences.difficulty}&count=${batchCount}`,
    'json',
    { signal }
  );

  if (preferences.mode === 'words') {
    const words = data.map(word => word.word);
    const passages: Passage[] = [];
    for (let i = 0; i < words.length; i += preferences.wordCount) {
      const chunk = words.slice(i, i + preferences.wordCount);
      if (chunk.length === preferences.wordCount) {
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
    text: data.map(word => word.word).join(' '),
    author: 'random',
    source: 'word list'
  }];
}

async function fetchFromNetwork(preferences: PassagePreferences): Promise<Passage[]> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let lastError: unknown = null;

  try {
    for (
      let attempt = 0;
      attempt < MAX_ATTEMPTS && !controller.signal.aborted;
      attempt++
    ) {
      try {
        const passages = await fetchOnce(preferences, controller.signal);
        if (passages.length > 0) return passages;
        throw new Error('Empty passage batch received');
      } catch (err) {
        lastError = err;
        if (attempt === MAX_ATTEMPTS - 1 || controller.signal.aborted) break;
        await waitForRetry(controller.signal);
      }
    }
  } finally {
    window.clearTimeout(timeoutId);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Passage fetch failed');
}

export function prefetchPassages(
  preferences: PassagePreferences,
  options: { force?: boolean } = {}
): Promise<Passage[]> {
  const key = getPassageCacheKey(preferences);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const cached = cache.get(key);
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return Promise.resolve([...cached.passages]);
  }

  const request = fetchFromNetwork(preferences)
    .then(passages => {
      cache.set(key, {
        passages,
        expiresAt: Date.now() + PASSAGE_CACHE_TTL_MS
      });
      return passages;
    });

  inFlight.set(key, request);
  const clear = () => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  };
  request.then(clear, clear);
  return request;
}
