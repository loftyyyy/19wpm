const MARK_PREFIX = '19wpm';

let sequence = 0;
let pendingKeystrokeMark: string | null = null;

function createMark(name: string): string | null {
  if (typeof performance === 'undefined') return null;
  const mark = `${MARK_PREFIX}:${name}:${sequence++}`;
  performance.mark(mark);
  return mark;
}

export function markPerformance(name: string): string | null {
  return createMark(name);
}

export function measurePerformance(
  name: string,
  startMark: string | null
): number | null {
  if (!startMark || typeof performance === 'undefined') return null;

  const endMark = createMark(`${name}:end`);
  if (!endMark) return null;

  try {
    return performance.measure(`${MARK_PREFIX}:${name}`, startMark, endMark).duration;
  } catch {
    return null;
  } finally {
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
  }
}

export function beginKeystroke(): void {
  if (pendingKeystrokeMark && typeof performance !== 'undefined') {
    performance.clearMarks(pendingKeystrokeMark);
  }
  pendingKeystrokeMark = createMark('keystroke:start');
}

export function completeKeystroke(): void {
  if (!pendingKeystrokeMark) return;
  measurePerformance('keystroke', pendingKeystrokeMark);
  pendingKeystrokeMark = null;
}
