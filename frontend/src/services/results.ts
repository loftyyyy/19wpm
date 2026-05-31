import type { TestResult } from '../types';

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

export function migrateGuestResults(userId: string): boolean {
  try {
    const guestResults: TestResult[] = JSON.parse(localStorage.getItem(GUEST_RESULTS_KEY) || '[]');
    if (guestResults.length === 0) return true;
    const userKey = userResultsKey(userId);
    const userResults: TestResult[] = JSON.parse(localStorage.getItem(userKey) || '[]');
    const merged = [...guestResults, ...userResults].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    localStorage.setItem(userKey, JSON.stringify(merged));
    localStorage.removeItem(GUEST_RESULTS_KEY);
    return true;
  } catch {
    return false;
  }
}
