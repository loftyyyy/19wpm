# Build fix — Inject the Jackson 3 mapper that Spring Boot 4 actually provides

**Area:** Backend (`RaceRoomRepository`)
**Architecture pattern:** Dependency injection aligned to the container's managed bean type
**Status:** Done

## Issue (before)

CR-2.5 changed `RaceRoomRepository` to inject Spring's `ObjectMapper` instead of building its own.
The import was the Jackson 2 type:

```java
import com.fasterxml.jackson.databind.ObjectMapper;
```

The project runs Spring Boot **4.0.2** (`spring-boot-starter-webmvc`), which manages **Jackson 3**
(`tools.jackson.*`). Boot auto-configures a `tools.jackson.databind.ObjectMapper` (a `JsonMapper`)
bean — there is **no** Jackson 2 `com.fasterxml.jackson.databind.ObjectMapper` bean. Jackson 2 is on
the classpath only transitively via the explicit `jackson-datatype-jsr310` (2.x) dependency, so the
code compiled but the context failed to start:

```
Parameter 2 of constructor in com.rho.backend.repository.RaceRoomRepository
required a bean of type 'com.fasterxml.jackson.databind.ObjectMapper' that could not be found.
APPLICATION FAILED TO START
```

`./mvnw -DskipTests compile` never starts a context, so the regression only surfaced in the
deployed container (`restartCount` climbing, replica never `ready`).

## Solution (after)

Inject the Boot-managed Jackson 3 mapper:

```java
import tools.jackson.databind.ObjectMapper;
```

`RaceRoomRepository` only calls `writeValueAsString(...)` / `readValue(String, Class)`, both present
on the Jackson 3 API, and Boot's mapper includes Java-time support so the record's `Instant` fields
serialize unchanged. The two catch-all `catch (Exception e)` blocks keep working — Jackson 3 throws
unchecked `JacksonException`.

## Impact

- The application context starts again and the Container App revision reaches ready.
- Durable race rooms serialize/deserialize through the same container-managed mapper the HTTP layer
  uses, so there is one JSON configuration rather than an ad-hoc Jackson 2 instance.

## Files changed

- `backend/src/main/java/com/rho/backend/repository/RaceRoomRepository.java` — import
  `tools.jackson.databind.ObjectMapper` (Jackson 3) instead of `com.fasterxml.jackson.databind`.

## Verification

- `./mvnw clean test-compile -DskipTests` (green).
- Container App revision reaches `ready` with no restarts; `/api/v1/texts` responds.

## Rollback

Revert this commit — the repository returns to the Jackson 2 type and the context fails to start
under Boot 4.
