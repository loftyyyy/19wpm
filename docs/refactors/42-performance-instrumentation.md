# Refactor 4.1 — Instrument keystroke and viewport render timing

**Area:** Frontend typing test (`TypingTest`, `TypingViewport`)
**Architecture pattern:** User Timing API marks around the keydown-to-commit path
**Status:** Done

## Bottleneck / anti-pattern (before)

Typing performance was judged only by feel. There was no repeatable way to tell whether a slow
keystroke came from the engine reducer, React rendering, DOM commit, or the caret layout effect.
That made the later memoization and animation changes impossible to compare against a baseline.

## Solution / enhancement (after)

Add `frontend/src/utils/performance.ts` with small wrappers around `performance.mark`,
`performance.measure`, and `performance.clearMarks`. Two measures are emitted:

| Measure | Start | End |
| --- | --- | --- |
| `19wpm:keystroke` | keydown accepted for typing or Backspace | first viewport commit after the update |
| `19wpm:viewport` | `TypingViewport` render begins | all viewport layout effects finish |

The keystroke mark is started in `TypingTest` before the engine dispatch and completed in
`TypingViewport`'s final layout effect. The viewport mark is created during render and measured after
the scroll and caret layout effects run. Replacing an unfinished keystroke mark prevents an ignored
key from measuring the next unrelated render.

The measures are available in DevTools with:

```js
performance.getEntriesByType('measure')
  .filter((entry) => entry.name.startsWith('19wpm:'));
```

## Baseline

Baseline was captured against the production preview build (`vite preview`, port `4173`) in headless
Chrome at 1280 × 800. The test used timed mode with `time=60`, which produces a 240-word passage.
After a 10-word warm-up, the next 200 words were typed at a 2 ms key interval and the User Timing
measures were collected.

Three runs produced a representative baseline:

| Measure | Samples | p50 | p95 | max | mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| `keystroke` | 1,216 | 0.8 ms | 1.2 ms | 3.3 ms | 0.791 ms |
| `viewport` | 1,404 | 0.6 ms | 1.0 ms | 3.1 ms | 0.582 ms |

The viewport sample count is higher than the keystroke count because the 100 ms timer also renders
the viewport while the test is running. These numbers are the pre-optimization baseline for the next
two refactors.

## Notes / trade-offs

- The measurement covers JavaScript render work and synchronous layout effects, not paint or
  compositing. Animation changes still need to keep paint work off layout-triggering properties.
- Marks and measures are cheap, but they remain enabled in production builds so the same baseline can
  be reproduced from `vite preview`. The browser's User Timing buffer naturally discards old entries.
- No payload, result, or account data is recorded. Measure names are static.
- A discarded concurrent render can leave an unused start mark. The next render creates a fresh mark,
  and the stale mark is cleaned up naturally by the User Timing buffer.

## Files changed

- `frontend/src/utils/performance.ts` — mark, measure, and pending-keystroke helpers.
- `frontend/src/Components/TypingTest/TypingTest.tsx` — starts keystroke timing before engine dispatch.
- `frontend/src/Components/TypingTest/TypingViewport.tsx` — viewport render timing and keystroke
  completion after layout effects.

## Verification

- `npx tsc -b` — green.
- `npm run build` — green (`tsc -b && vite build`).
- Production preview baseline captured in headless Chrome; entries are readable from
  `performance.getEntriesByType('measure')`.

## Rollback

Revert this commit. The performance helper and all marks/measures disappear; typing behavior is
unchanged.
