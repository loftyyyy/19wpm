# Refactor 1.1 — Race room live-state store + delta progress broadcasts

**Area:** Real-time multiplayer races (`RaceService`, `RaceStompController`, `WebSocketDisconnectHandler`)
**Architecture pattern:** In-memory live state with write-through persistence + delta (event) broadcast
**Status:** Done

## Bottleneck / anti-pattern (before)

`RaceRoomRepository.save()` / `findByCode()` serialize and deserialize the **entire** `RaceRoom`
(all participants plus the full passage text) as JSON in Redis. Every progress tick
(`RaceService.updateProgress`) did a full GET → mutate → SET round-trip, several times per
second per participant, and then broadcast the whole room object to every subscriber.

Consequences:

- **Write amplification:** the whole room is serialized/deserialized to Redis on every tick.
- **Lost updates:** GET + mutate + SET is not atomic. Two participants updating concurrently
  can overwrite each other, so progress/WPM could be dropped.
- **O(N²) broadcast fan-out:** N subscribers each receive an O(N)-sized room payload per tick.

## Solution / enhancement (after)

1. **New `RaceRoomStore`** (`com.rho.backend.race.RaceRoomStore`) holds live rooms in an in-memory
   Caffeine cache (30-minute idle expiry, 10k max size). On a miss it loads from Redis, so a
   restart or a node that has never seen the room still works. Redis remains the persistence layer
   but is written **only on lifecycle transitions** (create / join / start / racing / finish /
   disconnect) through `persist()`, never on a progress tick.
2. **Atomic per-room mutation:** every read-modify-write in `RaceService` and
   `WebSocketDisconnectHandler` is wrapped in `synchronized (raceRoom)`, eliminating lost updates
   now that mutations hit shared in-memory objects.
3. **Delta progress broadcast:** `updateProgress` returns a small immutable `RaceProgressDTO`
   (`userId`, `progressPercent`, `currentWpm`, `errors`) instead of the whole room. The STOMP
   controller broadcasts it to a dedicated topic `/topic/room/{code}/progress`. Full room state is
   only sent on the lifecycle topics/events. The frontend patches the matching participant.
4. **`RaceRoom.participants`** is now a `CopyOnWriteArrayList` so a join can mutate the list while
   another thread serializes the room for the broker without a `ConcurrentModificationException`.

## Architecture pattern

- **In-memory live state + write-through persistence:** hot mutable state lives in memory; the
  durable store is updated at meaningful checkpoints rather than on every change.
- **Delta (event) broadcast:** separate the high-frequency "what changed" channel from the
  low-frequency "full state" channel. Subscribers merge deltas into the last full snapshot.

## Impact

- Removes ~2 Redis round-trips + full-room (de)serialization per progress tick per participant.
- Eliminates the concurrent lost-update bug on progress.
- Cuts the per-tick network payload from O(participants) to a fixed-size delta per tick.

## Files changed

- `backend/.../race/RaceRoomStore.java` (new)
- `backend/.../dto/race/RaceProgressDTO.java` (new)
- `backend/.../race/RaceRoom.java` (participants → `CopyOnWriteArrayList`)
- `backend/.../service/RaceService.java` (store + synchronized mutation + delta return)
- `backend/.../controller/RaceStompController.java` (broadcast delta to `/progress` topic)
- `backend/.../controller/RaceRestController.java` (read via store)
- `backend/.../multiplayer/WebSocketDisconnectHandler.java` (store + synchronized mutation)
- `frontend/src/hooks/useRaceSocket.ts` (subscribe to `/topic/room/{code}/progress`, patch state)

## Verification

- `./mvnw -q -DskipTests compile` → success.
- `npx tsc -b` (frontend) → success.
- Manual: run a race with 2+ players and confirm progress bars update and the race finishes.

## Rollback

Revert this commit. Note the frontend and backend topic change lands in the same commit, so a
revert restores the previous single-topic full-room contract on both sides.
