import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

const RUM_ENDPOINT =
  import.meta.env.VITE_RUM_ENDPOINT || '/api/v1/telemetry/web-vitals';
const RUM_ENABLED =
  import.meta.env.PROD || import.meta.env.VITE_RUM_ENABLED === 'true';
const START_TYPING_KEY = '19wpm:start-typing-start';
const START_TYPING_MARK = '19wpm:start-typing:click';
const START_TYPING_END_MARK = '19wpm:start-typing:complete';

const KNOWN_PATHS = new Set([
  '/',
  '/about',
  '/compete',
  '/create',
  '/dashboard',
  '/leaderboard',
  '/login',
  '/oauth2/callback',
  '/race',
  '/results',
  '/solo',
]);

type VitalsRating = 'good' | 'needs-improvement' | 'poor';

interface VitalsPayload {
  name: string;
  value: number;
  rating: VitalsRating;
  navigationType: string;
  path: string;
}

function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0];
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return KNOWN_PATHS.has(normalized) ? normalized : '/other';
}

function dispatch(payload: VitalsPayload): void {
  const body = JSON.stringify(payload);

  if (typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon(RUM_ENDPOINT, blob)) return;
  }

  void fetch(RUM_ENDPOINT, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => undefined);
}

function sendMetric(metric: Metric): void {
  dispatch({
    name: metric.name,
    value: Number(metric.value.toFixed(3)),
    rating: metric.rating,
    navigationType: metric.navigationType,
    path: normalizePath(window.location.pathname),
  });
}

function ratingForDuration(duration: number): VitalsRating {
  if (duration <= 1500) return 'good';
  if (duration <= 3000) return 'needs-improvement';
  return 'poor';
}

export function initWebVitals(): void {
  if (!RUM_ENABLED) return;

  onLCP(sendMetric);
  onINP(sendMetric);
  onCLS(sendMetric);
  onFCP(sendMetric);
  onTTFB(sendMetric);
}

export function markStartTyping(): void {
  if (typeof performance === 'undefined') return;

  try {
    performance.clearMarks(START_TYPING_MARK);
    performance.clearMarks(START_TYPING_END_MARK);
    performance.mark(START_TYPING_MARK);
    sessionStorage.setItem(START_TYPING_KEY, String(performance.now()));
  } catch {
    return;
  }
}

export function completeTypingJourney(): void {
  if (typeof performance === 'undefined') return;

  let start: number;
  try {
    const stored = sessionStorage.getItem(START_TYPING_KEY);
    if (stored === null) return;
    sessionStorage.removeItem(START_TYPING_KEY);
    start = Number(stored);
  } catch {
    return;
  }

  if (!Number.isFinite(start)) return;

  const duration = performance.now() - start;
  if (duration < 0) return;

  try {
    performance.mark(START_TYPING_END_MARK);
    performance.measure(
      '19wpm:start-typing',
      START_TYPING_MARK,
      START_TYPING_END_MARK
    );
  } catch {
    return;
  } finally {
    performance.clearMarks(START_TYPING_MARK);
    performance.clearMarks(START_TYPING_END_MARK);
  }

  dispatch({
    name: 'start-typing',
    value: Number(duration.toFixed(3)),
    rating: ratingForDuration(duration),
    navigationType: 'navigate',
    path: '/solo',
  });
}
