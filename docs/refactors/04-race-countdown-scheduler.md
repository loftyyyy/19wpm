# Refactor 1.2 — Schedule the race countdown on a shared, managed thread pool

**Area:** Real-time race flow (`RaceStompController`)
**Architecture pattern:** Managed task scheduling (shared `TaskScheduler`) instead of ad-hoc thread creation
**Status:** Done

## Bottleneck / anti-pattern (before)

When the host started a race, `RaceStompController.startRoom` spawned a **brand-new `Thread` per
race start** whose only job was to `Thread.sleep(COUNTDOWN_DURATION_MS)` and then flip the room to
`RACING`:

```java
new Thread(() -> {
    try {
        Thread.sleep(RaceService.COUNTDOWN_DURATION_MS);
        RaceRoom racing = raceService.transitionToRacing(code);
        messagingTemplate.convertAndSend("/topic/room/" + code, racing);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
}).start();
```

Problems:
- **Unbounded:** N concurrent race starts create N OS threads, each of which then blocks for ~3.5s
  doing nothing but sleeping.
- **Unmanaged:** these threads are outside Spring's lifecycle — they aren't pooled, aren't named,
  and aren't drained on shutdown.
- **Wasteful:** a thread parked in `sleep` for the entire countdown ties up a stack for no reason;
  the work is a single delayed callback.

## Solution / enhancement (after)

Delegate the delayed transition to a **`TaskScheduler`** (Spring Boot auto-configures a
`ThreadPoolTaskScheduler` because the app already uses `@EnableScheduling`):

```java
taskScheduler.schedule(
        () -> transitionToRacing(code),
        Instant.now().plusMillis(RaceService.COUNTDOWN_DURATION_MS));
```

The scheduler queues the callback and fires it when due; **no thread sleeps**, the pool is bounded,
threads are pooled and named, and the scheduler is shut down with the application context. The
transition logic was extracted into a small `transitionToRacing(code)` helper that catches and logs
failures (e.g. the room already advanced or expired) so a failed transition can't escape onto the
scheduler's error path.

## Architecture pattern

- **Managed task scheduling:** use the container-managed scheduler for delayed/deferred work rather
  than creating threads by hand; the container owns the pool's size, naming and lifecycle.

## Impact

- Race starts no longer create OS threads; a bounded pool absorbs any number of concurrent countdowns
  without a thread parked in `sleep`.
- Scheduler threads are named and shut down gracefully with the context (no leaked threads across
  redeploys).

## Files changed

- `backend/.../controller/RaceStompController.java` (inject `TaskScheduler`; replace `new Thread(...)`
  with a scheduled callback; extract `transitionToRacing`)

## Verification

- `./mvnw -q -DskipTests compile` → success.
- Manual: start a race with ≥2 connected participants; confirm the room broadcasts `COUNTDOWN` then
  transitions to `RACING` after ~3.5s and the client starts.

## Rollback

Revert this commit; the previous `new Thread(...)` implementation is self-contained in one method.
