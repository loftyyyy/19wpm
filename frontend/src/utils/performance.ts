const MARK_PREFIX = '19wpm';

let sequence = 0;
let pendingKeystrokeMark: string | null = null;
let pendingTickMark: string | null = null;

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

/**
 * Starts a sample for the background 100 ms timer. Replacing an unfinished tick
 * mark prevents a dropped render from measuring the next unrelated commit.
 */
export function beginTick(): void {
  if (pendingTickMark && typeof performance !== 'undefined') {
    performance.clearMarks(pendingTickMark);
  }
  pendingTickMark = createMark('tick:start');
}

export function completeTick(): void {
  if (!pendingTickMark) return;
  measurePerformance('tick', pendingTickMark);
  pendingTickMark = null;
}

/**
 * One mark per render of the solo page container, counted by `verify:typing`.
 * It is intentionally permanent: the suite asserts that a typing burst does not
 * re-render the container, and a temporary patch would let the gate drift from
 * the code it is supposed to guard.
 */
export const TYPING_TEST_RENDER_MARK = '19wpm:render:typing-test';

export function markTypingTestRender(): void {
  if (typeof performance === 'undefined') return;
  performance.mark(TYPING_TEST_RENDER_MARK);
}
