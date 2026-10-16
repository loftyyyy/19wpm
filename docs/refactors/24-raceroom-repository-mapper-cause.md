# Refactor CR-2.5 — Inject the mapper and keep the cause in `RaceRoomRepository`

**Area:** Backend (`RaceRoomRepository`)
**Architecture pattern:** Dependency injection over ad-hoc construction; exception chaining
**Status:** Done

## Issue (before)

The repository built its own `ObjectMapper` and threw cause-less exceptions:

```java
this.objectMapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
// …
} catch (Exception e){
    throw new RuntimeException("Failed to save RacRoom: " + room.getRoomCode()
            + ". Error: " + e.getMessage());   // cause dropped, message typo, no context for reads
}
```

Two problems: (1) a hand-rolled `ObjectMapper` duplicated configuration the application already
provides as a bean, and every future JSON setting would have to be applied in two places; (2) the
catch-alls flattened Redis/Jackson failures into a `RuntimeException` with only `getMessage()` pasted
into the text, discarding the stack trace of the real cause.

## Solution (after)

The shared Spring-managed `ObjectMapper` is injected, and the failures chain their cause:

```java
public RaceRoomRepository(RedisTemplate<String, String> redisTemplate,
                          TextRepository textRepository,
                          ObjectMapper objectMapper){
    this.redisTemplate = redisTemplate;
    this.textRepository = textRepository;
    this.objectMapper = objectMapper;
}
// …
} catch (Exception e){
    throw new RuntimeException("Failed to save RaceRoom: " + room.getRoomCode(), e);
}
```

Spring Boot's `ObjectMapper` already registers the JSR-310 module and writes ISO-8601 dates, so
`Instant` fields serialize/deserialize exactly as before — the repository just stops owning a private
copy of the configuration.

## Architecture pattern

- **Inject the framework's configured collaborator:** reuse the container's `ObjectMapper` rather than
  instantiating one, so JSON behaviour is defined once.
- **Exception chaining:** translate infrastructure failures but carry the original as the cause.

## Impact

- No behaviour change on the happy path. Failures now surface with a full stack trace, and JSON
  configuration lives in one place.

## Files changed

- `backend/src/main/java/com/rho/backend/repository/RaceRoomRepository.java` — inject `ObjectMapper`;
  chain the cause in `save`/`findByCode`.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green). No other code constructs this repository directly.

## Rollback

Revert this commit — the repository constructs its own mapper and throws cause-less exceptions again.
