# Refactor CR-2.2 — Remove dead imports from `TextService`

**Area:** Backend (`TextService`)
**Architecture pattern:** Dead-code removal
**Status:** Done

## Issue (before)

`TextService` carried two imports that resolved to the wrong types and were never used:

```java
import org.apache.coyote.Response;      // Tomcat internal, unrelated to any method here
import java.awt.print.Pageable;         // desktop-printing type, not Spring Data's Pageable
```

Both were auto-import leftovers. The `java.awt.print.Pageable` import was the actively misleading one:
the paging code in this class uses Spring Data's `PageRequest` (from `org.springframework.data.domain`),
so a reader could reasonably assume the wrong `Pageable` was in play. Neither symbol is referenced
anywhere in the class.

## Solution (after)

Both imports are deleted. `PageRequest` remains imported and is the only paging type used
(`findFirstPresetByIdGreaterThanEqual…(…, PageRequest.of(0, 1))`).

## Architecture pattern

- **Keep imports honest:** an unused import is noise, and a *wrong* unused import is a trap — it
  suggests a dependency that does not exist in the code path.

## Impact

- No behaviour change. The class no longer implies a Tomcat-API or AWT dependency it does not use.

## Files changed

- `backend/src/main/java/com/rho/backend/service/TextService.java` — drop the two unused imports.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).

## Rollback

Revert this commit — the two imports return (they are inert either way).
