# Refactor 1.3 — Event-driven matchmaking on join

**Area:** Matchmaking (`MatchmakingService`, `MatchmakingScheduler`)
**Architecture pattern:** Event-driven matching (match on state change) with a serialized match routine and a low-frequency safety-net poll
**Status:** Done

## Bottleneck / anti-pattern (before)

Matchmaking was **poll-only**:

```java
// MatchmakingScheduler
@Scheduled(fixedRate = 2000)
public void poll() { matchmakingService.pollQueues(); }

// MatchmakingService.pollQueues()
for (TextType textType : TextType.values()) {
    Long queueSize = redisTemplate.opsForList().size(queueKey);   // LLEN every 2s for every type
    if (queueSize == null || queueSize < 2) continue;
    // ... pop up to 5, form a room ...
}
```

- **Constant idle load:** the scheduler ran every 2 s forever, issuing an `LLEN` per queue (5 queues)
  whether or not anyone was waiting.
- **Latency floor:** a pairing could only happen on the next tick, so a player who completed a queue
  just after a tick waited up to ~2 s even though an opponent was already queued.

## Solution / enhancement (after)

Matching is now triggered by the event that makes it possible — a player joining:

```java
public void joinQueue(Long userId, TextType textType){
    // ... enqueue + set playerKey ...
    matchQueue(textType);          // event-driven: try to pair immediately
}

public void pollQueues(){
    for (TextType textType : TextType.values()) {
        matchQueue(textType);      // safety net
    }
}

private void matchQueue(TextType textType){
    matchLock.lock();              // serialize matching
    try {
        // ... existing size check / pop-up-to-5 / push-back-if-<2 / createRoom / join / notify ...
    } finally {
        matchLock.unlock();
    }
}
```

- **Match on join:** `joinQueue` calls the (extracted) `matchQueue` straight away, so the second
  player into a queue produces a room immediately.
- **Serialized matching:** a `ReentrantLock` wraps `matchQueue`. Previously only the single-threaded
  scheduler invoked it, so overlaps were impossible; now request threads also invoke it, and two
  concurrent callbacks could otherwise pop the same player into two rooms.
- **Safety net:** the scheduler keeps `pollQueues()` but at a **low frequency** (`fixedRate = 10000`)
  to catch any player left unmatched (e.g. queued via an older path, or missed by a race).

## Architecture pattern

- **Event-driven matching:** the primary trigger is a domain event (player joins the queue) rather
  than a fixed clock; the periodic poll is demoted to reconciliation only. Idle cost is now O(1)
  every 10 s instead of O(queues) every 2 s, and match latency is bounded by the (fast) match routine
  rather than the tick interval.

## Notes / trade-offs

- **Concurrency:** the `ReentrantLock` is an in-JVM lock — correct for the current **single-instance**
  deployment. If matchmaking is ever run on multiple app instances, serialization must move to Redis
  (e.g. an atomic Lua script that pops and `LPOS`/`LREM` matched ids in one round-trip) or a
  distributed lock.
- **`joinQueue` latency:** the join request now also runs the match routine (a handful of Redis ops +
  possibly `createRoom`). This is fast and bounded (≤5 players), and only the joining request pays it.
- `matchQueue` preserves the original semantics exactly (pop up to 5, require ≥2, otherwise push the
  popped players back; 2-minute pending-key; per-player matchmaking notification).
- The lock is blocking (`lock()`), not `tryLock()`, so a joining player never silently skips a match;
  matches are short, so contention is negligible.

## Files changed

- `backend/src/main/java/com/rho/backend/service/MatchmakingService.java` — extracted `matchQueue`,
  added `matchLock`, call it from `joinQueue`, slimmed `pollQueues` to a loop.
- `backend/src/main/java/com/rho/backend/scheduler/MatchmakingScheduler.java` — `fixedRate` 2000 → 10000
  with a comment stating it is a safety net.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- Manually: with two clients, the second to join is paired ~immediately (no ~2 s wait); with nobody
  queued, Redis sees no `LLEN` traffic except one sweep every 10 s.
- No unit tests exist for matchmaking; behaviour is otherwise unchanged.

## Rollback

Revert this commit — restores the 2 s poll-only scheduler and the original `pollQueues` body.
