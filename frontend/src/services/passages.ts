import type { Passage, WordCount, PhraseLength, Mode, TextType, TextDifficulty } from '../types';
import type { ApiTextResponse, ApiTextCreateRequest, ApiWordResponse } from '../types/api';
import { generateTestPassage as localGeneratePassage } from '../utils/passages';
import { generateRandomWords as localRandomWords } from '../utils/words';
import { api } from './api';

function charLengthToType(charLength: number): TextType {
  if (charLength < 100) return 'SHORT';
  if (charLength < 300) return 'MEDIUM';
  if (charLength < 500) return 'LONG';
  return 'THICC';
}

function mapTextToPassage(dto: ApiTextResponse): Passage {
  return {
    textId: dto.textId,
    title: dto.title,
    text: dto.content,
    author: dto.author,
    source: dto.source,
    type: charLengthToType(dto.charLength),
  };
}

export function generateRandomWords(count: number): string {
  return localRandomWords(count);
}

// ── API-first passage generation with local fallback ──

export async function generateTestPassage(
  mode: Mode,
  duration: number,
  wordCount: WordCount,
  phraseLength?: PhraseLength,
  difficulty?: TextDifficulty,
): Promise<Passage> {
  if (mode === 'words') {
    try {
      const result = await apiFetchWords(difficulty ?? 'EASY', wordCount);
      if (result.data) return result.data;
    } catch {
      // API unreachable — fall through to local
    }
  }
  if (mode === 'time') {
    const count = Math.max(200, duration * 4);
    for (const attempt of [count, 50]) {
      try {
        const result = await apiFetchWords(difficulty ?? 'EASY', attempt);
        if (result.data) return result.data;
      } catch {
        // retry with smaller count or fall through
      }
    }
  }
  if (mode === 'phrases') {
    try {
      const result = await apiFetchTextByPhraseLength(phraseLength ?? 'all');
      if (result.data) return result.data;
    } catch {
      // API unreachable — fall through to local
    }
  }
  return localGeneratePassage(mode, duration, wordCount, phraseLength);
}

// ── New API-based functions ──

export async function apiFetchWords(difficulty: TextDifficulty, count: number): Promise<{ data: Passage | null; error: string | null }> {
  try {
    const data = await api.get<ApiWordResponse[]>(`/words?language=en&difficulty=${difficulty}&count=${count}`);
    const text = data.map(w => w.word).join(' ');
    const passage: Passage = { title: '', text, author: 'random', source: 'word list' };
    try {
      const textData = await api.get<ApiTextResponse>('/texts/random');
      passage.textId = textData.textId;
    } catch {
      // No text available — result will save to localStorage only
    }
    return { data: passage, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch words';
    return { data: null, error: msg };
  }
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export async function apiFetchTextByPhraseLength(length: PhraseLength): Promise<{ data: Passage | null; error: string | null }> {
  try {
    if (length === 'all') {
      const data = await api.get<ApiTextResponse>('/texts/random');
      return { data: mapTextToPassage(data), error: null };
    }
    const data = await api.get<ApiTextResponse[]>(`/texts/${length}`);
    if (data.length === 0) return { data: null, error: 'No texts found for this type' };
    return { data: mapTextToPassage(pickRandom(data)), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch text';
    return { data: null, error: msg };
  }
}

export async function apiFetchRandomText(type?: string): Promise<{ data: Passage | null; error: string | null }> {
  try {
    const params = type ? `?type=${type}` : '';
    const data = await api.get<ApiTextResponse>(`/texts/random${params}`);
    return { data: mapTextToPassage(data), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch text';
    return { data: null, error: msg };
  }
}

export async function apiFetchPresetTexts(): Promise<{ data: Passage[] | null; error: string | null }> {
  try {
    const data = await api.get<ApiTextResponse[]>('/texts/preset-texts');
    return { data: data.map(mapTextToPassage), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch texts';
    return { data: null, error: msg };
  }
}

export async function apiFetchTextById(textId: number): Promise<{ data: Passage | null; error: string | null }> {
  try {
    const data = await api.get<ApiTextResponse>(`/texts/${textId}`);
    return { data: mapTextToPassage(data), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch text';
    return { data: null, error: msg };
  }
}

export async function apiFetchTextsByType(type: string): Promise<{ data: Passage[] | null; error: string | null }> {
  const lowerType = type.toLowerCase();
  const validTypes = ['short', 'medium', 'long', 'thicc'];
  const path = validTypes.includes(lowerType) ? `/texts/${lowerType}` : '/texts/preset-texts';

  try {
    const data = await api.get<ApiTextResponse[]>(path);
    return { data: data.map(mapTextToPassage), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch texts';
    return { data: null, error: msg };
  }
}

export async function apiSaveCustomText(request: ApiTextCreateRequest): Promise<{ data: Passage | null; error: string | null }> {
  try {
    const data = await api.post<ApiTextResponse>('/texts/custom-text', request);
    return { data: mapTextToPassage(data), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save text';
    return { data: null, error: msg };
  }
}

export async function apiFetchTextsByLanguage(language: string): Promise<{ data: Passage[] | null; error: string | null }> {
  try {
    const data = await api.get<ApiTextResponse[]>(`/texts/language?language=${encodeURIComponent(language)}`);
    return { data: data.map(mapTextToPassage), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch texts';
    return { data: null, error: msg };
  }
}

export async function apiFetchUserTexts(): Promise<{ data: Passage[] | null; error: string | null }> {
  try {
    const data = await api.get<ApiTextResponse[]>('/texts/user-texts');
    return { data: data.map(mapTextToPassage), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch custom texts';
    return { data: null, error: msg };
  }
}
