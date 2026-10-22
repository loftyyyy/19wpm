# Refactor 4.2 — Strictly memoize word rendering

**Area:** Typing viewport (`TypingViewport`, `Word`)
**Architecture pattern:** Leaf memoization with active-only prop changes
**Status:** Done

## Bottleneck / anti-pattern (before)

`TypedWord` was already wrapped in `React.memo`, but every word received the same
`activeGlobalIdx`. That value changes on every keystroke, so the comparator marked every word as
changed and React reconciled the entire 240-word passage. The memo existed, but it never produced a
memo hit during typing.

Each word also passed a new inline `onWordRef` closure and attached a ref callback to every character.
Both patterns added work on every parent render without changing the rendered output.

## Solution / enhancement (after)

Rename the leaf to `Word` and make the active state word-local:

- `activeCharIndex` is the real cursor index only for the active word. Every inactive word receives
  `-1`, which is stable.
- The comparator returns `true` immediately for two inactive versions of the same word. Their typed
  segment cannot change while they are inactive, so no per-character scan is needed.
- The active word compares only its own typed segment. An unchanged `typedChars` reference short-circuits.
- `onWordRef` is a single stable parent callback that receives the word index. The leaf creates one
  stable ref callback for its own span.
- Character refs are attached only to the current and last characters instead of every character.
- The cursor style objects and extra-character styles are hoisted to module constants.
- `passageWords` remains memoized on `charsText`, so keystrokes and timer ticks do not reparse the
  passage string.

## Result

The same headless-Chrome production-preview benchmark from
[`42-performance-instrumentation.md`](42-performance-instrumentation.md) was repeated three times with
the same 240-word timed passage and a 200-word typed sample.

| Measure | Before p50 / p95 | After p50 / p95 | Before mean | After mean |
| --- | --- | --- | ---: | ---: |
| `keystroke` | 0.8 / 1.2 ms | 0.3 / 0.5 ms | 0.791 ms | 0.346 ms |
| `viewport` | 0.6 / 1.0 ms | 0.2 / 0.3 ms | 0.582 ms | 0.202 ms |

Representative post-change maximums were 0.9 ms for `keystroke` and 0.5 ms for `viewport`. That is
roughly a 60–70% reduction in the measured render-and-layout window.

## Notes / trade-offs

- Inactive words skip the typed-segment comparison entirely. This is safe because the engine locks
  completed words and only edits the current word; a word transitioning from active to inactive
  re-renders once with its final typed state.
- The parent still owns the `typedChars` array and passes the same reference to every word. No
  per-word slices or derived view models are allocated.
- The comparator now depends on `isActive` and `activeCharIndex` instead of a global active index.
  Those are the only cursor state a word needs.
- The component rename is internal. No public API or visual behavior changes.

## Files changed

- `frontend/src/Components/TypingTest/Word.tsx` — strictly memoized leaf; formerly `TypedWord.tsx`.
- `frontend/src/Components/TypingTest/TypingViewport.tsx` — active-only cursor props, stable word ref
  callback, hoisted styles.

## Verification

- `npx tsc -b` — green.
- `npm run build` — green.
- Headless Chrome typed 200 words of a 240-word timed passage in all three post-change runs without
  missed key handling or render errors.
- Post-change User Timing samples remained readable from `performance.getEntriesByType('measure')`.

## Rollback

Revert this commit. The leaf returns to `TypedWord`, all words receive the global active index again,
and the benchmark returns to the baseline in `42-performance-instrumentation.md`.
