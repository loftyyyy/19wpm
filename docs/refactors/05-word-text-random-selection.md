# Refactor 4.1 — Random word/text selection in the database

**Area:** Content selection (`WordService.getRandomWords`, `TextService.getRandomTexts`)
**Architecture pattern:** Push selection down to the database (set-based random sampling) instead of
loading the whole result set and shuffling in the application
**Status:** Done

## Bottleneck / anti-pattern (before)

Both "random N" endpoints fetched **every** matching row and then picked a handful in Java:

```java
List<Word> words = wordRepository.findByLanguageAndDifficulty(language, difficulty); // ALL rows
...
Collections.shuffle(words);
return words.stream().limit(count).map(WordResponseDTO::new).toList();
```

For a language/difficulty bucket with thousands of words this:
- **Transfers the entire bucket** from PostgreSQL to the app on every request (the seeded word set
  alone is ~13k rows across all buckets).
- Materializes and shuffles a large list in heap, then throws almost all of it away.
- Does the exact count check (`count > words.size()`) only *after* paying for the full fetch.

`TextService.getRandomTexts` had the identical shape (`findByLanguageAndType` → `shuffle` → `limit`).

## Solution / enhancement (after)

Let the database do the sampling and return only the rows we need, via a native query:

```java
@Query(value = "SELECT * FROM words WHERE language = :language AND difficulty = :difficulty " +
               "ORDER BY random() LIMIT :count", nativeQuery = true)
List<Word> findRandomByLanguageAndDifficulty(@Param("language") String language,
                                             @Param("difficulty") String difficulty,
                                             @Param("count") int count);
```

The service now issues a single query that returns at most `count` uniformly-random rows:

```java
List<Word> words = wordRepository.findRandomByLanguageAndDifficulty(
        language.trim().toLowerCase(), difficulty.name(), count);
if (words.isEmpty()) { throw new ResourceNotFoundException(...); }
if (words.size() < count) { throw new InvalidResourceException("Count exceeds available words"); }
return words.stream().map(WordResponseDTO::new).toList();
```

The `count > available` contract is preserved: `LIMIT :count` returns fewer rows than requested
exactly when the bucket is too small, so `size() < count` is the equivalent guard — but it is only
evaluated against the (small) result set, never the whole bucket. Enums are passed as their
`name()` strings so the native query matches the `EnumType.STRING` columns.

## Architecture pattern

- **Push work down to the database:** selection/sampling/aggregation belongs in SQL; the application
  receives only the data it will actually use. Keeps payload and heap usage bounded by `count`
  rather than by the size of the table.

## Trade-off note

`ORDER BY random()` sorts the matching subset in the database. That is a full scan of the filtered
bucket per call. It is strictly cheaper than the previous behavior (which shipped the whole bucket
over the wire and shuffled it in the app), and is comfortably fast for the current data size. If a
bucket ever grows very large, the next step is an index range scan over a random start id (the
keyset pattern already used by `TextService.getRandomText`/`getRandomTextByType`), which also
benefits from the composite indexes tracked under refactor **2.3**.

## Impact

- Response for "random N" is bounded by `count`; no full-bucket fetch or in-app shuffle.
- Fewer rows transferred and no large transient list allocations on a hot endpoint.

## Files changed

- `backend/.../repository/WordRepository.java` — replaced `findByLanguageAndDifficulty` (which
  returned all rows) with `findRandomByLanguageAndDifficulty`; removed the stale commented-out
  max-id query.
- `backend/.../repository/TextRepository.java` — replaced `findByLanguageAndType` with
  `findRandomByLanguageAndType`.
- `backend/.../service/WordService.java` — `getRandomWords` uses the DB-side random query.
- `backend/.../service/TextService.java` — `getRandomTexts` uses the DB-side random query.

## Verification

- `./mvnw -q -DskipTests compile` → success.
- Manual: `GET` the random-word and random-text endpoints with a valid `language`/`difficulty`/`type`
  and `count`; confirm `count` distinct rows are returned and that an oversized `count` still yields
  `400` ("Count exceeds available words").

## Rollback

Revert this commit; the two repository methods and the two service bodies return to the prior
fetch-all + shuffle implementation.
