import type { TestResult } from '../types';
import type { ApiTypingResultRequest, ApiTypingResultResponse } from '../types/api';
import { api } from './api';

// ── Existing localStorage-based functions (unchanged) ──

const GUEST_RESULTS_KEY = '19wpm-guest-results';

function userResultsKey(userId: string): string {
  return `19wpm-results-${userId}`;
}

export function saveResult(result: TestResult, userId?: string) {
  const key = userId ? userResultsKey(userId) : GUEST_RESULTS_KEY;
  const existing: TestResult[] = JSON.parse(localStorage.getItem(key) || '[]');
  existing.unshift(result);
  localStorage.setItem(key, JSON.stringify(existing));
}

export function getResults(userId?: string): TestResult[] {
  const key = userId ? userResultsKey(userId) : GUEST_RESULTS_KEY;
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export async function migrateGuestResults(_userId: string): Promise<boolean> {
  try {
    const guestResults: TestResult[] = JSON.parse(localStorage.getItem(GUEST_RESULTS_KEY) || '[]');
    if (guestResults.length === 0) return true;

    const toMigrate = guestResults.filter(r => r.textId);
    if (toMigrate.length === 0) return true;

    const results = await Promise.allSettled(
      toMigrate.map(r =>
        apiSaveResult({
          textId: r.textId!,
          finishedAt: new Date(r.date).toISOString(),
          durationMs: r.duration * 1000,
          timeConstraintMs: null,
          wpm: r.wpm,
          accuracy: r.accuracy,
        })
      )
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
}

// ── New API-based functions ──

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
