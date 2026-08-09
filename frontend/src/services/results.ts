import type { TestResult } from '../types';
import type { ApiTypingResultRequest, ApiTypingResultResponse } from '../types/api';
import { api, ApiError } from './api';

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

      // Everything that succeeded (200) or already existed on the server (409) is
      // considered migrated. Results that failed permanently (4xx, e.g. 404 when a
      // referenced text was deleted) are evicted individually instead of blocking
      // the whole batch. Only transient failures (network / 5xx) are kept for retry.
      const migrated = new Set<TestResult>();
      const evicted: { id: string | undefined; textId: number | undefined; reason: string }[] = [];
      results.forEach((r, i) => {
        const guest = toMigrate[i];
        if (r.status !== 'fulfilled') return; // transient — keep
        const { status, error } = r.value;
        if (status === 200 || status === 409) {
          migrated.add(guest);
          return;
        }
        if (status !== null && status >= 400 && status < 500) {
          evicted.push({ id: guest.id, textId: guest.textId, reason: error ?? `HTTP ${status}` });
        }
      });

      if (evicted.length > 0) {
        evicted.forEach(({ id, textId, reason }) => {
          console.warn(`[migration] evicting unresolvable guest result (id=${id ?? 'n/a'}, textId=${textId ?? 'n/a'}): ${reason}`);
        });
      }

      const kept = guestResults.filter(r => !migrated.has(r) && !evicted.some(e => e.id === r.id));
      if (kept.length === 0) {
        localStorage.removeItem(GUEST_RESULTS_KEY);
        return true;
      }

      if (kept.length !== guestResults.length) {
        localStorage.setItem(GUEST_RESULTS_KEY, JSON.stringify(kept));
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

export async function apiSaveResult(result: ApiTypingResultRequest): Promise<{ data: ApiTypingResultResponse | null; error: string | null; status: number | null }> {
  try {
    const data = await api.post<ApiTypingResultResponse>('/result', result);
    return { data, error: null, status: data ? 200 : null };
  } catch (err: unknown) {
    // 409 means the result already exists on the server — treat as benign success.
    if (err instanceof ApiError && err.status === 409) {
      return { data: null, error: null, status: 409 };
    }
    const status = err instanceof ApiError ? err.status : null;
    const msg = err instanceof Error ? err.message : 'Failed to save result';
    return { data: null, error: msg, status };
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
