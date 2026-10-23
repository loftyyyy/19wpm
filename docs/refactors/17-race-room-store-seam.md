# Refactor CR-3.2 — Extract a `RaceRoomStore` seam and document single-instance scaling

**Area:** Live race-room state (`RaceRoomStore`, `RaceService`, `RaceRestController`, `WebSocketDisconnectHandler`)
**Architecture pattern:** Port/adaptor seam over the live-room store (dependency inversion)
**Status:** Done (seam); distributed implementation deferred

## Bottleneck / anti-pattern (before)

`RaceRoomStore` was a concrete `@Component` that held authoritative live room state in a
process-local Caffeine cache and wrote through to Redis only on lifecycle transitions:

```java
@Component
public class RaceRoomStore {
    private final Cache<String, RaceRoom> liveRooms;   // process-local, authoritative
    ...
}
```

Consumers (`RaceService`, `RaceRestController`, `WebSocketDisconnectHandler`) depended directly on
that concrete class. This is not a correctness bug on the current single-replica deployment, but it
**hard-codes the single-node assumption into every caller**, and the constraint was undocumented:

- Live state is authoritative in one JVM; a room served by instance B never sees mutations made on
  instance A.
- Broadcasts use `SimpMessagingTemplate` with **no broker relay**, so `/topic/room/{code}` messages
  only reach STOMP sessions attached to the publishing instance.
- The countdown→RACING transition is scheduled on an instance-local `TaskScheduler`
  (`RaceStompController`), and `MatchmakingService`'s `ReentrantLock` is documented as depending on
  the single-instance assumption too.

So scaling the backend horizontally would silently split race rooms across instances unless the
store and the messaging layer change together.

## Solution / enhancement (after)

Introduce a seam: `RaceRoomStore` becomes an **interface** describing the store contract, and the
existing behavior moves to `InMemoryRaceRoomStore`:

```java
public interface RaceRoomStore {
    Optional<RaceRoom> get(String roomCode);
    boolean exists(String roomCode);
    void put(RaceRoom room);       // live, fast
    void persist(RaceRoom room);   // durable write-through, lifecycle only
    void remove(String roomCode);
}
```

```java
@Component
public class InMemoryRaceRoomStore implements RaceRoomStore { /* unchanged behavior */ }
```

Because the interface keeps the same package and name, every consumer keeps its existing
`import com.rho.backend.race.RaceRoomStore` and resolves it to the interface — **no caller changes
and no behavior change**. The seam separates the two concerns the store already mixed: the fast,
mutable live path (`get`/`put`) and the durable write-through (`persist`).

The remaining work — a distributed implementation — is deliberately **deferred** because it is a
coordinated change, not a drop-in adaptor. The scale-out path, recorded here for when it is needed:

1. **Shared state.** Back live rooms with Redis (e.g. a hash / JSON doc per room) or a Redis-locked
   read-modify-write, so any instance can load and mutate a room.
2. **Cross-instance fan-out.** Route `/topic/room/{code}` through a Redis pub/sub bridge (or enable a
   STOMP broker relay) so broadcasts reach participants on every instance, not just the publisher.
3. **Distributed coordination.** Replace the instance-local countdown `TaskScheduler` with a
   scheduled, idempotent transition guarded by a distributed lock, and replace
   `MatchmakingService`'s `ReentrantLock` with a Redis lock (or Lua) so overlapping matches across
   instances cannot pop the same player twice.
4. **Routing.** Either keep sticky routing of a room's participants to one instance (cheapest, the
   current implicit assumption) or complete 1–3 for full load-balancing.

Until then the deployment must remain single-replica, which is now an explicit, documented
constraint rather than an accidental one.

## Architecture pattern

- **Port/adaptor seam (dependency inversion):** callers depend on a `RaceRoomStore` port; the
  in-memory cache is one adaptor, and a distributed store can be added as another without touching
  callers.

## Impact

- Zero behavior change; callers are now decoupled from the concrete store and can be pointed at a
  distributed implementation later.
- The single-instance constraint and the concrete scale-out path are documented instead of implicit.

## Files changed

- `backend/.../race/RaceRoomStore.java` — now the store **interface** (with the single-instance note).
- `backend/.../race/InMemoryRaceRoomStore.java` — **new** `@Component` holding the previous
  Caffeine + Redis write-through logic.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- Wiring: single `RaceRoomStore` bean (`InMemoryRaceRoomStore`); `RaceService`,
  `RaceRestController`, and `WebSocketDisconnectHandler` inject the interface unchanged.

## Rollback

Revert this commit — folds the interface and implementation back into the original concrete
`RaceRoomStore` class.

## Phase 5 re-audit (2026-10-22)

The single-replica constraint still holds. Re-checking the live path found four independent
instance-local mechanisms, not one:

1. **Authoritative room state.** `InMemoryRaceRoomStore` keeps `RaceRoom` objects in a process-local
   Caffeine cache. Redis is a lifecycle write-through, not the live read path. A room loaded on
   instance B would not see progress mutations made on instance A.
2. **STOMP fan-out.** `WebSocketConfig` enables a `SimpleBroker` for `/topic` and `/queue` with no
   broker relay. A message published on instance A does not reach a subscriber connected to
   instance B.
3. **Countdown transition.** `RaceStompController.startRoom` schedules the COUNTDOWN to RACING
   transition on the local `TaskScheduler`. Running the transition on every instance would race,
   while running it on only one instance would leave rooms on other instances stuck.
4. **Matchmaking coordination.** `MatchmakingService.matchQueue` serializes queue pops with a local
   `ReentrantLock`. Two instances can therefore pop from the same Redis list concurrently and create
   overlapping matches.

The deployment is pinned to `minReplicas: 1` and `maxReplicas: 1` in
`deploy/container-app.yaml`. Scale-to-zero is disabled to avoid request-triggered cold starts, not
because horizontal scaling is safe.

### Conditions for raising `maxReplicas`

All four items must change together:

- Store live rooms in Redis (or another shared store) with an atomic check-and-mutate path.
- Route STOMP broadcasts through Redis pub/sub or a broker relay.
- Make the countdown transition idempotent and guarded by a distributed lock.
- Replace the matchmaking `ReentrantLock` with a Redis lock or an atomic Lua script.

Sticky routing of a room's participants to one instance is a cheaper alternative, but it must cover
both HTTP and WebSocket traffic and survive revision restarts. Until one of those designs is in
place, `maxReplicas` must remain `1`.

## Phase 9 — distributed adaptor (2026-10-23)

Live room state now lives in Redis for every replica. `RedisRaceRoomStore` implements the same
`RaceRoomStore` port, and `InMemoryRaceRoomStore` is deleted. The port gains one method:

```java
<T> Optional<T> mutate(String roomCode, Function<RaceRoom, T> mutation);
```

`mutate` holds `race:lock:{roomCode}` (SET NX PX, Lua compare-and-delete release), reloads the
latest room, applies the function, and writes it back. All multi-field transitions use it:
join/connect, start, progress, finish, and disconnect.

Cross-replica STOMP fan-out uses `RaceEventBus`: it delivers locally through
`SimpMessagingTemplate`, publishes `RaceEvent(originId, destination, userId, payload)` on Redis
`race:events`, and each replica re-delivers events from other origins. The Spring simple broker is
kept; a STOMP broker relay still requires RabbitMQ/Artemis, which this deployment does not run.

The countdown deadline is a member of the Redis sorted set `race:countdown`. Every replica polls
with `@Scheduled(fixedDelay = 500)`; the replica that atomically removes a due room performs the
COUNTDOWN to RACING transition under the room lock, and peers observe a non-COUNTDOWN state and do
nothing. `transitionToRacing` returns `Optional.empty()` when another replica won.

Reconnect recovery: the client re-joins on every STOMP connect (join is idempotent) and subscribes
to `/user/queue/race-resume` for a targeted room snapshot. `/topic/room/{code}` remains the
lifecycle broadcast and `/topic/room/{code}/progress` remains the per-tick delta.

Trade-off: progress ticks now round-trip Redis because the authoritative room is shared. Text
content is cached in `RaceRoomRepository` (Caffeine, keyed by `textId`) so a mutation does not hit
PostgreSQL. This is acceptable for race-sized rooms; progress is not persisted to the relational
database, only the final result is.

Verification: `./mvnw.cmd -q -DskipTests test-compile` and `npm run build` (both green).
Remaining for horizontal scale: replace `MatchmakingService`'s `ReentrantLock` with the Redis lock.
