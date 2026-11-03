# Refactor 53 — Isolate non-keystroke renders from the typing viewport

**Area:** Frontend typing test (`TypingViewport`, `TypingTest`, `Race`, `useTypingActivity`, `useCapsLock`)
**Architecture pattern:** Memoized render seam plus external store for transient UI state
**Status:** Done

## Bottleneck / anti-pattern (before)

`TypingTest` owned every piece of state around the passage: the engine, the activity flag used to keep
the caret solid while typing, and the caps-lock indicator. Two of those change for reasons unrelated to
the text:

- `useTypingActivity` flipped a `useState` flag 500 ms after each typing burst, so the end of every
  burst re-rendered `TypingTest` and `TypingViewport` — the passage, every character span, the caret and
  the scroll layout effects — just to swap one caret class.
- `useCapsLock` set state in `TypingTest` on every keydown, and a caps-lock toggle re-rendered the same
  tree to show or hide a banner above it.

Neither update changes a character, so both were wasted work on the surface where input latency matters
most. The instrumentation from [refactor 42](./42-performance-instrumentation.md) exposed them as
`19wpm:viewport` samples with no matching `19wpm:keystroke`.

## Solution / enhancement (after)

- `TypingViewport` is wrapped in `React.memo` with an explicit `arePropsEqual`. It compares only the
  props that can change the rendered passage: `charsText`, `typedChars`, `currentIndex`, `lockedIndex`,
  `mistakeWordIndices`, `extraChars`, `isFinished`, `extraVariant`, `resetKey` and `measureKey`.
  `layoutEpoch` is internal state, not a prop, so a resize still re-measures through its own render.
  The list of ignored props is empty by construction: transient values no longer reach the component.
- `useTypingActivity` is now a small external store (`markTypingActive` + `useSyncExternalStore`). The
  keydown handlers in `TypingTest` and `Race` call `markTypingActive` without subscribing, so an idle
  timeout notifies only the caret.
- The caret moved into a memoized `TypingCaret` leaf inside the viewport. It subscribes to the activity
  flag itself and receives only `cursorRef` and `hidden`, so a burst's idle flip re-renders one empty
  `div` instead of the passage behind it.
- The caps-lock banner moved into a `CapsLockNotice` leaf that owns the `useCapsLock` subscription.
  Toggling the key no longer re-renders `TypingTest` at all.
- `TypingViewport` lost its `isTypingActive` prop; both call sites (`TypingTest`, `Race`) were updated.

## Result

Production preview build, headless Chrome, 1280 × 800, timed mode. The "before" column was measured by
building the previous commit (`67e1529`) in a separate worktree, serving it on a second port and running
the same script against both.

| Scenario | Viewport renders before | After |
| --- | --- | --- |
| 3 bursts of 30 keys, 900 ms idle between them | 93 (90 keys + 3 idle flips) | **90 (1:1)** |
| 1 key, then a 900 ms idle timeout | 2 | **1** |
| Show the caps-lock banner | 1 | **0** |
| Hide the caps-lock banner | 1 | **0** |
| 200 sampled keys (`perf:keystroke`, 3 runs) | 200 | **200** |

`perf:keystroke` after the change, three runs: `viewport` n = 200 with p95 0.4 – 0.5 ms, `keystroke` p95
0.6 – 0.7 ms, `tick` p95 0.2 – 0.3 ms. The keystroke path is unchanged within noise; the difference is
that renders which used to be triggered by timers and modifier keys are gone.

Bundle: `TypingTest` 10.05 → 10.02 kB raw (3.64 → 3.63 kB gzip), total JavaScript gzip 268.5 → 268.6 KiB,
initial JS + CSS unchanged. All budgets pass.

## Notes / trade-offs

- The comparator is deliberately hand-written rather than a shallow compare: it documents the render
  contract, and a new transient prop added later will not silently reintroduce a full passage render.
- Props compared by reference (`typedChars`, `extraChars`, `mistakeWordIndices`) are replaced only when
  their content changes, so reference equality is sufficient and cheaper than deep comparison.
- The activity store keeps its 500 ms timer at module scope. After unmount it can fire once with no
  subscribers, which is inert.
- `markTypingActive` still runs on every accepted key. It only publishes when the flag actually changes,
  so a burst costs one notification at its start and one at its end.
- `TypingViewport` still re-renders once per keystroke by design; that is the render that carries the
  typed character.

## Files changed

- `frontend/src/Components/TypingTest/TypingViewport.tsx` — `React.memo` comparator, memoized caret leaf,
  activity subscription moved out of the parent.
- `frontend/src/hooks/useTypingActivity.ts` — external store with `markTypingActive` and a subscribing
  hook.
- `frontend/src/Components/TypingTest/TypingTest.tsx` — `CapsLockNotice` leaf, action-only activity use,
  dropped transient prop.
- `frontend/src/Pages/Race.tsx` — action-only activity use, dropped transient prop.

## Verification

- `npx tsc -b` — green.
- `npm run lint` — 0 errors, 0 warnings.
- `npm run build` — green.
- `npm run perf:bundle` — all budgets pass.
- `npm run perf:keystroke` — three runs, viewport samples exactly 1:1 with keydowns.
- Headless timing check: burst/interrupt counts above, caret returns to `typing-cursor-active` on a key
  and `animate-blink` after 500 ms, banner toggles without a viewport render, reset and a timed run into
  `/results` still work, no runtime errors.

## Rollback

Revert this commit. `TypingViewport` renders on every parent update again, the caret class comes from a
prop, and the caps-lock banner subscribes in `TypingTest`; typing and results are unchanged.
