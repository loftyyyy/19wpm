# Refactor 2.4 — Paginated typing-result history (backend)

**Area:** Repository / service / controller / DTO (`TypingResult*`)
**Architecture pattern:** Offset pagination with a stable page envelope (pushed down to the database)
**Status:** Done (backend half; the frontend consumer follows in refactor 2.5)

## Bottleneck / anti-pattern (before)

`GET /api/v1/result` (`getMyResults`) returned **every** result the user had ever recorded, as one
unbounded `List`:

```java
@Query("SELECT tr FROM TypingResult tr JOIN FETCH tr.user u WHERE u.userId = :userId ORDER BY tr.createdAt DESC")
List<TypingResult> findByUserWithUser(@Param("userId") Long userId);
```

- No `LIMIT`: the whole result history is loaded and every row is mapped to a DTO per request.
- No ordering contract exposed to the client; the sort was hard-coded in the query.
- Every DTO performed `textContent.split("\\s+")` to compute the word count — a regex **compiled per
  row** over the list.

An index for the exact access path already exists from `V1` (`idx_tr_user_created (user_id, created_at)`),
so the query can be served without a sort or sequential scan once it is bounded.

## Solution / enhancement (after)

Page the query in the database and return a stable envelope:

```java
@Query(value = "SELECT tr FROM TypingResult tr JOIN FETCH tr.user u WHERE u.userId = :userId",
       countQuery = "SELECT COUNT(tr) FROM TypingResult tr WHERE tr.user.userId = :userId")
Page<TypingResult> findByUserWithUser(@Param("userId") Long userId, Pageable pageable);
```

```java
public record PageResponseDTO<T>(List<T> content, int page, int size,
                                 long totalElements, int totalPages, boolean last) {
    public static <S, T> PageResponseDTO<T> of(Page<S> page, Function<S, T> mapper) { ... }
}
```

```java
@GetMapping
public ResponseEntity<PageResponseDTO<TypingResultResponseDTO>> getMyResults(
        @AuthenticationPrincipal CustomUserDetails user,
        @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) { ... }
```

- **Bounded transfer:** at most `size` (default 20) rows leave the database per request; total count
  comes from a cheap `COUNT` query.
- **Sort is the pageable's responsibility** (`sort=createdAt,DESC` by default), matching
  `idx_tr_user_created` — no hard-coded `ORDER BY`.
- **Stable contract:** `PageResponseDTO` decouples the JSON shape from Spring Data's `Page`
  serialization and maps entities→DTOs in one pass.
- **Word count** is now computed once via a shared compiled `Pattern` (`WHITESPACE`) instead of
  recompiling `\\s+` per row.

## Architecture pattern

- **Offset pagination pushed to the database:** `Pageable` becomes `LIMIT/OFFSET` + `ORDER BY`,
  alongside a separate `COUNT` query; the API exposes a self-describing page envelope (`page`,
  `size`, `totalElements`, `totalPages`, `last`) so clients can advance deterministically.

## Notes / trade-offs

- `JOIN FETCH` on a **to-one** association (`tr.user`) is safe with pagination (a `ManyToOne` fetch
  join does not cause the "in-memory pagination" problem that collection fetch joins do). The user is
  still fetched in the same query, so no N+1 on `getUser()`/`getUsername()`.
- Offset pagination is fine for a per-user history (small, non-hot); keyset pagination would be the
  next step only if deep pages over very large histories became a concern.
- This backend change is a **contract change** (`List` → page envelope); the frontend consumer
  (`apiGetResults`, `AuthContext`, `RecentHistory`) is updated in refactor 2.5. Between the two
  commits the results screen is temporarily broken, which is expected for isolated commits.

## Files changed

- `backend/src/main/java/com/rho/backend/dto/common/PageResponseDTO.java` (new).
- `backend/src/main/java/com/rho/backend/repository/TypingResultRepository.java` — `List` → `Page`,
  added `countQuery`.
- `backend/src/main/java/com/rho/backend/service/TypingResultService.java` — `getResultsByUser(long, Pageable)`.
- `backend/src/main/java/com/rho/backend/controller/TypingResultController.java` — `Pageable` +
  `@PageableDefault`.
- `backend/src/main/java/com/rho/backend/dto/typingResult/response/TypingResultResponseDTO.java` —
  shared compiled word-count pattern.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- Manually: `GET /api/v1/result?page=0&size=20` returns `{ content, page, size, totalElements,
  totalPages, last }`; `?page=1` returns the next slice; the results are `createdAt DESC`.
- The `idx_tr_user_created` index covers `user_id` equality + `created_at` ordering.

## Rollback

Revert this commit (restores the unbounded `List` query); revert 2.5 alongside it to restore the
frontend.
