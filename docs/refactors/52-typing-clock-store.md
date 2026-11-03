# Refactor 52 — Move the typing timer out of reducer state

**Area:** Frontend typing test (`useTypingEngine`, `TypingTest`, `TypingClockReadouts`, `typingClock`)
**Architecture pattern:** External store for high-frequency derived state
**Status:** Done

## Bottleneck / anti-pattern (before)

The engine ran a `setInterval(100)` while a test was running and dispatched `TICK`. The reducer
updated `timeLeft`, `elapsedSeconds`, `wpm`, `rawWpm`, `wpmHistory` and `errorsThisSecond`, so a new
state object replaced the previous one ten times a second.

`TypingTest` renders `TypingViewport` from that same state. Every tick therefore re-rendered the whole
typing tree — the word list, up to a hundred characters, the caret and the scroll layout effect —
even though only a three-digit countdown and a two-digit WPM number had changed. The cost was visible
in the instrumentation added in [refactor 42](./42-performance-instrumentation.md): the viewport
sample count was consistently higher than the keystroke count by roughly the number of ticks.

## Solution / enhancement (after)

- `src/utils/typingClock.ts` is a small external store: `publishClock`, `getClockSnapshot`,
  `subscribeClock`, `resetClock`, plus `useClock` / `useClockValue` built on `useSyncExternalStore`.
- The reducer no longer owns time. `TICK`, `timeLeft`, `wpmHistory` and `errorsThisSecond` are gone;
  a single `FINISH` action ends a timed run and stores the exact final elapsed seconds and WPM.
- `useTypingEngine` keeps a mutable clock source (last committed state, history, last recorded
  second) and publishes a snapshot on every commit and every 100 ms sample. Elapsed time is derived
  from the real start timestamp instead of accumulating `+0.1` per tick, so a throttled timer can no
  longer drift the countdown.
- Only `TestTimer`, `LiveWpm` and `TimedProgress` subscribe. They are leaf components: a tick touches
  three small text nodes and one width, and never the passage, the characters or the animations.
- WPM history and consistency now come from the clock snapshot (`getResult`, and `Race`'s finish
  callback) instead of reducer state.
- The tick measure closes in `LiveWpm`'s layout effect, because the tick no longer commits the
  viewport.

## Result

Production preview build, headless Chrome, 1280 × 800, solo words mode: 80 warm-up keys then 200
sampled keys at a 12 ms interval. Five runs before the change and five after.

| Measure | Before (per run) | After (per run) |
| --- | --- | --- |
| `tick` mean | 0.41 – 0.60 ms | **0.15 – 0.16 ms** |
| `tick` p95 | 0.6 – 2.6 ms | **0.2 – 0.4 ms** |
| `tick` max | 3.4 ms | **0.5 ms** |
| `viewport` samples | keys + ticks (222 – 229 for 200 keys) | **exactly the key count (200)** |
| `viewport` p95 | 0.4 ms | 0.4 – 0.5 ms |
| `keystroke` p95 | 0.6 ms | 0.6 – 0.7 ms |
| `caret` p95 | 0.7 ms | 0.7 – 0.8 ms |

The viewport count is the structural result: the timer no longer appears in the typing tree's render
path at all. The keystroke path is unchanged within noise, as intended — this refactor buys back the
work that used to happen *between* keystrokes.

Functional check in the same browser: timed countdown and progress, `Tab` reset (timer, characters and
WPM cleared), timed expiry landing on `/results` with a 16-point WPM history (`0…15`) and no duplicate
timestamps, a 10-word run finishing on its last key with all replay events, and replay playback from
the results page. No runtime errors.

Bundle: total JavaScript gzip 268.0 → 268.5 KiB, initial JS + CSS unchanged at 87.5 KiB. The refactor
trades about half a kilobyte of shared code for the removed per-tick render.

## Notes / trade-offs

- The store is a module singleton, matching the single typing surface per page (`/solo`, `/race`). Each
  engine resets it when it mounts or resets, so a previous passage's history cannot leak in.
- Every committed keystroke also publishes a snapshot, which updates the live WPM immediately instead
  of waiting for the next tick. Three leaf components re-render after commit; the keystroke measure
  still closes before that.
- `wpmHistory` is a new array only when a whole second is recorded, so its reference is stable for
  subscribers and result consumers.
- Errors per second are derived from `totalIncorrect` deltas at each second boundary instead of a
  counter reset by the ticker, which keeps backspacing behavior unchanged.
- `TypingViewport` is still re-rendered per keystroke, as it must be. Memoizing it against unrelated
  parent renders is a separate step.

## Files changed

- `frontend/src/utils/typingClock.ts` — new external clock store and hooks.
- `frontend/src/hooks/useTypingEngine.ts` — `FINISH` replaces `TICK`; clock sampling and publication.
- `frontend/src/Components/TypingTest/TypingClockReadouts.tsx` — `TestTimer`, `LiveWpm`,
  `TestProgress`.
- `frontend/src/Components/TypingTest/TypingTest.tsx` — subscribes through the readouts instead of
  reading time from engine state.
- `frontend/src/Components/TypingTest/TypingViewport.tsx` — tick sample no longer closes here.
- `frontend/src/Pages/Race.tsx` — finish callback reads WPM history from the clock snapshot.
- `frontend/scripts/bench.js` — reports the `tick` row.

## Verification

- `npx tsc -b` — green.
- `npm run lint` — 0 errors, 0 warnings.
- `npm run build` — green.
- `npm run perf:bundle` — all budgets pass.
- `npm run perf:keystroke` — five runs, numbers above.
- Headless functional pass over timed mode, reset, results, replay and words-mode completion.

## Rollback

Revert this commit. `TICK`, reducer-owned time and the in-tree countdown return; typing behavior and
results are otherwise unchanged.
