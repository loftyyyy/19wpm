# Fix — Sync the race countdown to the server clock (STOMP time offset)

**Area:** Backend + Frontend (race countdown)
**Architecture pattern:** Clock-offset estimation (NTP-style four-timestamp round trip) over STOMP
**Status:** Done

## Issue (before)

The countdown is a client-rendered timer, but the reference timestamp (`countdownStartTime`) is minted
on the server. Each client computed `remaining = (startTime + durationMs) - Date.now()` using its **own
wall clock**, with no shared time base. Two players whose clocks differ by a few seconds therefore
started their timers at different points, producing:

1. **Desync** — the two players' displays ran out of step, and their `GO!` moments (which fire the
   transition to typing) were seconds apart.
2. **`GO!, GO!, GO!, GO!` instead of `1, 2, 3, Go!`** — when a client's clock ran **ahead** of the
   server by more than the display window (`durationMs`), `remaining` was already `0` on first paint,
   so the display jumped straight to `GO!` for the whole duration.

Two latent faults made it worse: the step thresholds in `Countdown.tsx` were hardcoded to the current
3500 ms duration (`2500`/`1500`/`500`) rather than derived from `durationMs`, and the malformed-
`startTime` fallback recomputed `Date.now() + duration` on every render, so it never counted down.

## Solution (after)

Estimate the client→server clock offset once per connection and render the countdown on the
**server-corrected** clock.

**Backend** — a stateless STOMP endpoint that echoes the four timestamps needed for an offset estimate:

- `dto/time/TimeSyncRequestDTO` — `(long clientSentAt)`.
- `dto/time/TimeSyncResponseDTO` — `(long clientSentAt, long serverReceivedAt, long serverSentAt)`.
- `controller/TimeSyncController` — `@MessageMapping("/time")` replies to the caller's
  `/user/queue/time` with `t1` (echoed) plus `t2`/`t3` captured as `System.currentTimeMillis()`.

**Frontend** (`hooks/useRaceSocket.ts`) — on connect, subscribe to `/user/queue/time` and publish three
`/app/time` samples (`{ clientSentAt: Date.now() }`) spaced ~200 ms. For each reply it computes the
round-trip time and offset from the four timestamps:

```
rtt    = (t4 - t1) - (t3 - t2)
offset = ((t2 - t1) + (t3 - t4)) / 2
```

It keeps the **lowest-RTT** sample's offset (least network noise) and exposes it as `serverOffsetMs`.

**Frontend** (`Components/Race/Countdown.tsx`) — takes `offsetMs`, renders from `now + offsetMs`
against the server `deadline`, and derives its step boundaries from `durationMs` (fifths:
`5/7`, `3/7`, `1/7`) instead of hardcoded milliseconds. The `startTime`-parse fallback is now memoized
(anchored once) so it counts down normally. `Pages/Race.tsx` passes `offsetMs={socket.serverOffsetMs}`.

## Impact

- Both players render the countdown against the same server clock, so the digits stay in step and the
  `GO!` moment is synchronized (within network jitter) rather than skewed by each device's clock.
- A client clock ahead of the server no longer collapses the sequence to `GO!`.
- Step thresholds scale with the duration, so a future non-3500 ms countdown still shows `1, 2, 3, GO!`.

## Files changed

- `backend/.../controller/TimeSyncController.java` (new) — `/app/time` → `/user/queue/time`.
- `backend/.../dto/time/TimeSyncRequestDTO.java` (new).
- `backend/.../dto/time/TimeSyncResponseDTO.java` (new).
- `frontend/src/hooks/useRaceSocket.ts` — offset sampling + `serverOffsetMs`.
- `frontend/src/Components/Race/Countdown.tsx` — server-corrected render; duration-derived steps.
- `frontend/src/Pages/Race.tsx` — pass `offsetMs`.

## Verification

- `./mvnw clean test-compile -DskipTests` (green).
- `npm run build` (type-check + production build) green.

## Follow-up (not in this change)

`Race.tsx` still derives the live race WPM from `new Date(startTime).getTime()` against the raw client
clock — the same defect class. It can reuse `serverOffsetMs` to become skew-corrected too.

## Rollback

Revert this commit — the countdown returns to the client-only clock (`Countdown`'s `offsetMs` defaults
to `0`, so the frontend still functions without the backend endpoint).
