# Refactor 54 — Move keystroke state into a granular external store

**Area:** Frontend typing engine (`useTypingEngine`, `TypingTest`, `Race`, typing readouts)
**Architecture pattern:** Per-test vanilla store + `useSyncExternalStore` selectors
**Status:** Done

## Bottleneck / anti-pattern (before)

`TypingTest` owned the whole test in a `useReducer`. Every keystroke produced a new
`TypingState` object, so React re-rendered the page around the passage: the header, the
hint row, the timer/WPM/accuracy block, the progress bar, the caps-lock leaf, the footer
and `TypingViewport`. Only the passage and the live counters actually changed.

The theoretical cost was visible in the code even after the previous two waves: the
viewport was memoized, but its props were read from a state object that the container
held, so the container had to re-render first to hand the new characters down. Render
isolation was one level deep; the container itself was still on the keystroke path.

## Solution / enhancement (after)

- `src/utils/typingStore.ts` holds the model in one place: word-boundary helpers, the
  reducer, `TypingSnapshot`, `createTypingStore()`, and the selector hooks.
  `createTypingStore()` is a factory (not a module singleton): solo and race each own a
  test, and the store exposes `getSnapshot` / `subscribe` / `dispatch` / `reset`,
  mirroring `typingClock.ts`.
- `useTypingEngine` is now glue only. It creates the store once with `useState`, wires
  the clock (`publishClock` on every store commit, 100 ms interval only while
  `isRunning && !isFinished`), and returns `{ store, handleKeyDown, getResult, reset }`.
  `handleKeyDown` dispatches into the store; it never calls `setState`. The callbacks
  are stable, so the container's keydown handler does not change per keystroke.
- `TypingTest` subscribes to exactly two primitives — `isRunning` and `isFinished` — and
  keeps the purely low-frequency state (`passage`, `resetKey`, preferences) in React
  state. `totalWords` is now counted from the passage text, not read back from the
  engine.
- Every per-keystroke readout is a leaf that subscribes on its own:
  - `AccuracyReadout` → `accuracy`;
  - `WordsReadout` / `WordsProgress` → `completedWords` + `isFinished`;
  - `TypingSelectionViewport` → the character slice + mistake set.
- `TypingViewport` stays presentational and memoized. `TypingSelectionViewport` is the
  seam: it reads `typedChars`, `currentIndex`, `lockedIndex`, `extraChars`,
  `isFinished` through `useTypingSelection` (cached object, field-by-field equality) and
  the mistake set through `useMistakeTracker`, then passes them to the memoized
  viewport. A keystroke re-renders the wrapper and the viewport; the container does not.
- `Race` no longer reads the whole snapshot for progress reporting: it subscribes to the
  store inside an effect, so progress updates do not re-render the race input. The
  finish path reads the snapshot at the moment it fires.

## Result

Production preview build, headless Chrome, 1280 × 800, timed mode. The "before" column
was measured by building `03c9506` in a separate worktree, patching both builds with the
same one-line container render mark, serving them on two ports and running one script.

| Scenario (60 keys, 14 ms apart) | Container renders before | After |
| --- | --- | --- |
| 60-key burst | 61 | **1** |
| …after a 900 ms idle window | 61 | **1** |
| Tab reset after the burst | 62 | **2** |

The single render is the `isRunning` edge on the first key; the record is unchanged for
the remaining 59. The viewport still renders on every key (3 bursts: 62 samples in both
builds — 60 keys plus mount/reset), because that is the render that carries the typed
character.

`perf:keystroke`, three runs after the change:

| Metric | Before (mean / p95) | After (mean / p95) |
| --- | --- | --- |
| keystroke | 0.36 / 0.6–0.7 ms | **0.33–0.34 / 0.6–0.7 ms** |
| viewport | 0.19–0.20 / 0.4–0.5 ms | 0.20–0.22 / 0.5 ms |
| caret | 0.50–0.53 / 0.7–0.8 ms | **0.35–0.38 / 0.5–0.6 ms** |
| tick | 0.14–0.17 / 0.2–0.3 ms | 0.12–0.15 / 0.2–0.3 ms |

All samples are `n = 200` keys; the caret sample count varies (193 here) because
requestAnimationFrame coalesces keys typed within one frame.

Bundle: total JavaScript gzip 268.6 → **269.0 KiB** (budget 312.5), initial JS + CSS
unchanged at 87.5 KiB. `TypingTest` 10.02 → 10.01 kB raw; `Race` 98.11 → 97.94 kB raw.

## Notes / trade-offs

- The store is created with `useState(() => createTypingStore(config))`, not held in a
  ref: the React lint rules reject reading or returning a ref during render, and the
  store identity must be stable for subscriptions. `useState` gives a once-per-mount
  value with the same guarantee.
- A passage or config change resets the same store in an effect (`store.reset(config)`);
  the store keeps its own config, so the user-facing `reset()` is a no-arg action.
  Resetting instead of recreating keeps the subscription graph and the clock history
  handling unchanged.
- Clock publication is driven by a single store subscription. Because `dispatch`
  notifies synchronously, the finished snapshot reaches the clock before the
  `isFinished` effect computes the result — the same ordering the old `useEffect([state])`
  had, without a React commit in between.
- `useTypingSelection` caches its object and compares fields, so unrelated commits (a
  reset, a counter-only change) do not produce a new selection reference. `useTypingValue`
  is for primitives and stable references (`useSyncExternalStore` uses `Object.is`).
- `Race` is the one place that deliberately keeps a broader subscription (inside an
  effect, not in render) because its progress callback needs several fields at once.
  Its two-client socket finish path is still only exercised manually.

## Files changed

- `frontend/src/utils/typingStore.ts` — new: reducer, snapshot type, store factory,
  `countWords`, `useTypingState`, `useTypingValue`, `useTypingSelection`,
  `useMistakeTracker`.
- `frontend/src/hooks/useTypingEngine.ts` — model removed; store + clock glue only;
  stable `handleKeyDown` / `getResult` / `reset`.
- `frontend/src/Components/TypingTest/TypingSelectionViewport.tsx` — new: store-to-props
  seam for the memoized viewport.
- `frontend/src/Components/TypingTest/TypingStateReadouts.tsx` — new: `AccuracyReadout`,
  `WordsReadout`.
- `frontend/src/Components/TypingTest/TypingClockReadouts.tsx` — words-mode progress
  subscribes to the store.
- `frontend/src/Components/TypingTest/TypingTest.tsx` — container reads only
  `isRunning` / `isFinished`; total words counted from the passage.
- `frontend/src/Pages/Race.tsx` — store-driven progress reporting, store-backed viewport.

## Verification

- `npx tsc -b` — green.
- `npm run lint` — 0 errors, 0 warnings.
- `npm run build` — green; `npm run perf:bundle` — all budgets pass.
- `npm run perf:keystroke` — three runs, viewport samples exactly 1:1 with keydowns.
- Headless functional pass: words mode types a full passage into `/results` with
  accuracy 100, correct counters and replay events matching the text; live accuracy
  drops on a wrong key and recovers after Backspace; a wrong submitted word is flagged;
  caps-lock toggles render no viewport; Tab reset clears chars, timer and accuracy; a
  15 s timed run finishes with 16 history points; no runtime errors.
- Container render A/B described above.

## Rollback

Revert this commit. The model returns to `useTypingEngine`'s reducer, `TypingTest` reads
`state` again and passes per-key props to `TypingViewport`; typing and results are
unchanged, only the render cost returns.
