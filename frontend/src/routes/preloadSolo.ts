let soloRoutePromise: Promise<typeof import('../Components/TypingTest/TypingTest')> | null = null;

export function preloadSolo() {
  soloRoutePromise ??= import('../Components/TypingTest/TypingTest');
  return soloRoutePromise;
}
