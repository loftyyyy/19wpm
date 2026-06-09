import type { TestResult } from '../types';
import type { ApiTypingResultRequest, ApiTypingResultResponse } from '../types/api';
import { api } from './api';

const GUEST_RESULTS_KEY = '19wpm-guest-results';

export function saveGuestResult(result: TestResult) {
  const existing: TestResult[] = JSON.parse(localStorage.getItem(GUEST_RESULTS_KEY) || '[]');
  existing.unshift(result);
  localStorage.setItem(GUEST_RESULTS_KEY, JSON.stringify(existing));
}

export function getGuestResults(): TestResult[] {
  try {
    return JSON.parse(localStorage.getItem(GUEST_RESULTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearGuestResults() {
  localStorage.removeItem(GUEST_RESULTS_KEY);
}

export function clearAllResults() {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('19wpm-results-') || key === GUEST_RESULTS_KEY)) {
      toRemove.push(key);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}

let migrationPromise: Promise<boolean> | null = null;

export async function migrateGuestResults(): Promise<boolean> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async (): Promise<boolean> => {
    try {
      const guestResults: TestResult[] = JSON.parse(localStorage.getItem(GUEST_RESULTS_KEY) || '[]');
      if (guestResults.length === 0) return true;

      const toMigrate = guestResults.filter(r => r.passage);
      if (toMigrate.length === 0) {
        localStorage.removeItem(GUEST_RESULTS_KEY);
        return true;
      }

      const results = await Promise.allSettled(
        toMigrate.map(r => {
          const isTextMode = r.contentType === 'phrases';
          return apiSaveResult({
            mode: isTextMode ? 'TEXT' : 'WORDS',
            ...(isTextMode ? { textId: r.textId! } : {}),
            ...(isTextMode ? {} : { textContent: r.passage }),
            finishedAt: new Date(r.date).toISOString(),
            durationMs: r.duration * 1000,
            timeConstraintMs: null,
            wpm: r.wpm,
            accuracy: r.accuracy,
          });
        })
      );

      const allSucceeded = results.every(r => r.status === 'fulfilled' && r.value.data !== null);

      if (allSucceeded) {
        localStorage.removeItem(GUEST_RESULTS_KEY);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  })();

  try {
    return await migrationPromise;
  } finally {
    migrationPromise = null;
  }
}

export async function apiSaveResult(result: ApiTypingResultRequest): Promise<{ data: ApiTypingResultResponse | null; error: string | null }> {
  try {
    const data = await api.post<ApiTypingResultResponse>('/result', result);
    return { data, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save result';
    return { data: null, error: msg };
  }
}

export async function apiGetResults(): Promise<{ data: ApiTypingResultResponse[] | null; error: string | null }> {
  try {
    const data = await api.get<ApiTypingResultResponse[]>('/result');
    return { data, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && (err as { status?: number }).status === 404) {
      return { data: [], error: null };
    }
    const msg = err instanceof Error ? err.message : 'Failed to fetch results';
    return { data: null, error: msg };
  }
}
