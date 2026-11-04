# Refactor 55 — Throttle race progress and isolate the racing surface

**Area:** Frontend race mode (`useRaceSocket`, `Race`, `RaceTrack`)
**Architecture pattern:** Leading + trailing publisher, per-hook external store + selectors
**Status:** Done

## Bottleneck / anti-pattern (before)

Two things happened on every keystroke in a race:

1. `RaceTypingInput` subscribed to the typing store and called `onProgress` on every
   commit. `useRaceSocket.sendProgress` published a STOMP frame immediately, so a
   typist producing 10 keys/second sent 10 progress messages, and a fast burst sent
   one per key.
2. The server's progress broadcast was applied by `setRoom(...)`: a new room object
   with a new participant array. `Race` held the room in `useState`, so every delta
   re-rendered the whole page — header, lobby/countdown/results branches, `RaceTrack`,
   and `RaceTypingInput`. The inline `onProgress` / `onFinish` arrows changed identity
   on each of those renders, so the input could not be memoized even in principle.

The page only needed the room's phase, host and connected count; the track needed the
participants; the input needed the passage and start time. All of it was behind one
state object.

## Solution / enhancement (after)

### Outgoing progress (`src/utils/progressThrottle.ts`)

`createProgressPublisher({ send, intervalMs = 100 })` implements:

- **leading edge** — the first sample, or the first after a quiet interval, is sent
  immediately, so observers see the start of the run;
- **coalescing** — samples inside the interval overwrite one pending slot, so the
  newest value wins;
- **trailing delivery** — the timer sends the pending slot when the interval ends;
- **dedupe** — an identical payload is not sent again;
- **flush / dispose** — `flush()` delivers the pending sample now, `dispose()` drops
  it.

`useRaceSocket` owns one publisher per room. `sendProgress` only pushes into it, so
its identity is stable. `sendFinish` flushes the publisher *before* publishing the
finish frame, which preserves the order the server expects (completed progress, then
the finish payload). Changing rooms or unmounting disposes the publisher, so a queued
tick cannot leak into the room the user just left.

### Incoming room state (`src/utils/raceRoomStore.ts`)

`createRaceRoomStore()` is a per-hook external store with `getSnapshot`, `subscribe`,
`set(room)` and `applyProgress(delta)`:

- `set` replaces the room from a full broadcast, resume snapshot or join response;
- `applyProgress` updates only the matching participant, keeps every other
  participant object identical, and emits **no notification** for a duplicate delta
  or an unknown user;
- `useRaceRoom` returns the full snapshot for stages that genuinely need it;
  `useRaceRoomValue(store, select)` returns one primitive or stable reference.

`useRaceSocket` returns `roomStore` instead of a room value. The socket writes into
the store from its subscriptions; React is notified only through the store.

### Render topology (`Race`, `RaceTrack`)

- `Race` subscribes to three primitives: `state`, `hostUserId` and `connectedCount`.
  A progress delta changes none of them, so the page does not re-render at all on a
  keystroke.
- The render branches became stage components: `LobbyStage`, `CountdownStage`,
  `RacingStage`, `FinishedStage`. Lobby and results may subscribe to the whole room;
  they are not on the keystroke path.
- `RacingStage` selects only `text` and `startTime` (stable references/primitives).
  `RaceTrack` receives the store and subscribes to `participants` itself, so a
  progress delta re-renders the track and nothing else.
- `RaceTypingInput` is wrapped in `memo`, and `RacingStage` passes a stable
  `sendProgress` plus a `useCallback` finish handler. A full-room broadcast that
  re-renders the stage no longer reaches the input unless the passage or start time
  actually changed.

## Result

The outgoing side is a rate bound rather than a measurement: at most one progress
frame per 100 ms per room, plus the leading sample and the finish flush, with
duplicates dropped. The publisher and the room store were exercised with a throwaway
Node harness covering leading edge, coalescing, trailing timer, flush, dedupe,
dispose, duplicate-delta suppression, unknown-user suppression and participant
identity preservation; all assertions passed.

On the incoming side, render isolation is structural: the only component that
subscribes to `participants` on the keystroke path is `RaceTrack`. The typing input
has no room-store subscription and its props no longer change per delta.

Bundle (gzip) 269.0 → **269.7 KiB** total JavaScript (budget 312.5 KiB); initial JS
+ CSS unchanged at 87.5 KiB. The race chunk grew 97.94 → 100.22 kB raw because it now
carries the store, the publisher and the stage split.

## Verification gate (`npm run verify:typing`)

The solo verification suite is now a committed script, `scripts/verify-typing.mjs`.
It starts its own `vite preview` on a strict port unless `BASE_URL` is supplied, runs
headless Chrome, and stops the server in `finally`.

`TypingTest` records a permanent `19wpm:render:typing-test` mark on each render
(`markTypingTestRender` in `utils/performance.ts`), so the gate measures the real
container instead of a patched build. Checks:

| Check | Assertion |
| --- | --- |
| words mode, 60-key burst | ≤ 3 container renders (measured 1), characters committed |
| Tab reset | ≤ 4 container renders (measured 2), passage cleared, idle prompt back |
| words finish | `/results`, stored result matches the passage, accuracy 100, replay events present |
| replay | play reaches “Replay Complete” and marks characters correct |
| timed 15 s | finishes by itself, duration 14–16 s, ≥ 15 history points (measured 16) |

## Notes / trade-offs

- `RaceTrack` still re-renders on every progress delta, which is the point: it is the
  component whose pixels change. The saving is that the input, the header and the
  stage around it do not.
- A full room broadcast (`set`) is still a new room object, so `RacingStage`
  re-renders when someone joins, finishes or disconnects. `RaceTypingInput` is
  memoized against that, so focus, selection and the engine store survive.
- The publisher drops a queued tick on dispose. On finish the flush runs first; when
  the socket is disconnected the finish payload is queued for reconnect (existing
  behavior) and progress is not replayed, because the finish payload carries the
  final counters.
- The two-client finish handshake cannot be exercised headlessly without a running
  backend; it remains a manual check, as before.

## Files changed

- `frontend/src/utils/progressThrottle.ts` — new: leading/trailing coalescer.
- `frontend/src/utils/raceRoomStore.ts` — new: room store and selector hooks.
- `frontend/src/hooks/useRaceSocket.ts` — store-backed room, throttled progress,
  flush on finish, per-room publisher disposal.
- `frontend/src/Pages/Race.tsx` — primitive subscriptions, stage components, memoized
  race input.
- `frontend/src/Components/Race/RaceTrack.tsx` — subscribes to participants itself.
- `frontend/src/utils/performance.ts` — permanent container render mark.
- `frontend/src/Components/TypingTest/TypingTest.tsx` — emits the render mark.
- `frontend/scripts/verify-typing.mjs` — new: self-contained headless gate.
- `frontend/package.json` — `verify:typing` alias.

## Verification

- `npx tsc -b` — green.
- `npm run lint` — 0 errors, 0 warnings.
- `npm run build` — green.
- `npm run verify:typing` — all four checks pass; 1 container render for 60 keys,
  2 for Tab reset, 15 s run with 16 history points.
- `npm run perf:bundle` — all budgets pass.
- `node scripts/smoke.mjs` — all routes pass, including the `/race` chunk.

## Rollback

Revert the commits. Progress returns to one publish per store commit, the room returns
to `useState`, and the page re-renders per delta.
