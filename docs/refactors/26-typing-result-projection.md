# Refactor CR-3.4 — Project the result history instead of fetching whole entities

**Area:** Backend (`TypingResultRepository` + `TypingResultResponseDTO`)
**Architecture pattern:** Read-model projection (select only the columns the response needs)
**Status:** Done

## Issue (before)

The paginated history query fetched full `TypingResult` entities **with** the `User` association
eagerly joined, only to read two user fields (`userId`, `username`) when building the DTO:

```java
@Query(value = "SELECT tr FROM TypingResult tr JOIN FETCH tr.user u WHERE u.userId = :userId",
       countQuery = "SELECT COUNT(tr) FROM TypingResult tr WHERE tr.user.userId = :userId")
Page<TypingResult> findByUserWithUser(@Param("userId") Long userId, Pageable pageable);
```

Every row materialized a managed `User` entity and every column of `typing_results`/`users`, even
though the response DTO needs a fixed subset. The count query still runs (a `Page` always pairs
content with a total), so the win here is not fewer round-trips but a leaner read model.

## Solution (after)

Return an interface projection that selects exactly the needed columns — the result fields plus
`userId`/`username`:

```java
@Query(value = "SELECT tr.typingResultId AS typingResultId, tr.textId AS textId, "
        + "tr.textTitle AS textTitle, tr.textContent AS textContent, tr.finishedAt AS finishedAt, "
        + "tr.durationMs AS durationMs, tr.timeConstraintMs AS timeConstraintMs, tr.wpm AS wpm, "
        + "tr.accuracy AS accuracy, tr.mode AS mode, tr.createdAt AS createdAt, "
        + "u.userId AS userId, u.username AS username "
        + "FROM TypingResult tr JOIN tr.user u WHERE u.userId = :userId",
        countQuery = "SELECT COUNT(tr) FROM TypingResult tr WHERE tr.user.userId = :userId")
Page<TypingResultProjection> findByUserWithUser(@Param("userId") Long userId, Pageable pageable);
```

The DTO gains a constructor over the projection; the now-unused `TypingResultResponseDTO(TypingResult)`
constructor is removed. The JSON response is byte-for-byte the same shape.

## Architecture pattern

- **Read-model projection:** a query returns a purpose-built view (`TypingResultProjection`) rather than
  managed entities, so no `User` entity is instantiated per row and the SQL selects only the columns the
  API actually serializes.

## Impact

- No `User` entity is built for the history endpoint; the join now projects two columns instead of the
  whole `users` row. Page envelope + count behaviour is unchanged, so the frontend contract is
  untouched.

## Files changed

- `backend/src/main/java/com/rho/backend/dto/typingResult/response/TypingResultProjection.java` (new) —
  interface projection.
- `backend/src/main/java/com/rho/backend/repository/TypingResultRepository.java` — return the projection;
  drop the entity `JOIN FETCH`.
- `backend/src/main/java/com/rho/backend/dto/typingResult/response/TypingResultResponseDTO.java` — map
  from the projection; remove the unused entity constructor.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- No remaining caller used the removed `TypingResultResponseDTO(TypingResult)` constructor.

## Rollback

Revert this commit — the query returns `Page<TypingResult>` and the entity→DTO constructor returns.
