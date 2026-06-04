import type { Passage, WordCount, PhraseLength, Mode } from '../types';
import type { ApiTextResponse, ApiTextCreateRequest } from '../types/api';
import { generateTestPassage as localGeneratePassage, getRandomPassage as localRandomPassage } from '../utils/passages';
import { generateRandomWords as localRandomWords } from '../utils/words';
import { api } from './api';

// ── Existing localStorage-based functions (unchanged) ──

export function getRandomPassage(): Passage {
  return localRandomPassage();
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
): Promise<Passage> {
  if (mode === 'phrases' || mode === 'time') {
    try {
      const type = !phraseLength || phraseLength === 'all' ? undefined : phraseLength;
      const result = await apiFetchRandomText(type);
      if (result.data) return result.data;
    } catch {
      // API unreachable — fall through to local
    }
  }
  // mode === 'words' or API unavailable: fall back to local generation
  return localGeneratePassage(mode, duration, wordCount, phraseLength);
}

// ── New API-based functions ──

function mapTextToPassage(dto: ApiTextResponse): Passage {
  return {
    textId: dto.textId,
    text: dto.content,
    author: dto.author,
    source: dto.source,
  };
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
