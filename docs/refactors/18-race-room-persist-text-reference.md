# Refactor CR-3.1 — Persist only the text reference in race rooms

**Area:** Race-room persistence (`RaceRoomRepository`, new `PersistedRaceRoom`)
**Architecture pattern:** Projection / read-model separation for durable storage
**Status:** Done

## Bottleneck / anti-pattern (before)

`RaceRoomRepository.save` serialized the entire live `RaceRoom` to Redis, including the full
`TextResponseDTO` passage content:

```java
String json = objectMapper.writeValueAsString(room);   // room.text.content() included
```

The passage is chosen once at room creation (`RaceService.createRoom`) and stored with the room.
Because `persist(...)` is called on every lifecycle transition (create, each join, connect, start,
countdown→racing, finish), the **same immutable passage text was re-serialized and rewritten to
Redis repeatedly**, once per room. The passage also lives authoritatively in the `texts` table, so
the Redis copy was redundant data with a duplicated lifecycle.

## Solution / enhancement (after)

Split the live model from its durable projection:

- **New `PersistedRaceRoom`** — a Jackson-friendly record holding every per-room field *except* the
  passage, which collapses to a single `Long textId`:

  ```java
  public record PersistedRaceRoom(
          String roomCode, RaceState state, boolean isPrivate, TextType textType,
          Long textId, Long hostUserId, List<RaceParticipant> participants,
          Instant startTime, int finishCount, Instant countdownStartTime,
          long countdownDurationMs, int durationSeconds) { ... }
  ```

- **`save`** serializes `PersistedRaceRoom.from(room)` — no passage content on the wire.
- **`findByCode`** reads the projection and rehydrates the passage from the catalogue by id:

  ```java
  TextResponseDTO text = persisted.textId() == null ? null
          : textRepository.findByTextId(persisted.textId()).map(TextResponseDTO::new).orElse(null);
  return Optional.of(persisted.toRoom(text));
  ```

The live `RaceRoom` is unchanged and still carries the full text, so in-memory progress validation
(`RaceService.updateProgress`) and the STOMP broadcasts keep working without a round-trip. Only the
rare cache-miss load (instance restart / Caffeine eviction) pays a single `texts` lookup to
rehydrate — cheaper and more correct than duplicating the content.

Rehydration preserves the `CopyOnWriteArrayList` participant semantics, so concurrent joins during a
broadcast remain safe after a room is loaded from Redis.

## Architecture pattern

- **Projection / read-model separation:** the durable representation is a projection of the domain
  object that references (`textId`) rather than embeds the catalogue content, keeping one source of
  truth for passages.

## Impact

- Redis values no longer embed passage content; the payload shrinks and the redundant copy of
  immutable text is eliminated.
- Transitions still write on lifecycle events only (progress ticks remain in-memory).

## Files changed

- `backend/.../race/PersistedRaceRoom.java` — **new** durable projection + `from`/`toRoom` mapping.
- `backend/.../repository/RaceRoomRepository.java` — `save`/`findByCode` use the projection and
  rehydrate the passage via `TextRepository`; adds a `TextRepository` dependency.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- Round-trip: `save(room)` writes a projection with `textId`; `findByCode` rebuilds an equivalent
  `RaceRoom` with the passage rehydrated from `texts`.

## Rollback

Revert this commit — `save`/`findByCode` return to serializing the full `RaceRoom`.
