# Refactor CR-3.1 — Indexed offset sampling for random words and texts

**Area:** Backend (`WordService`, `TextService`, `WordRepository`, `TextRepository`, migration `V11`)
**Architecture pattern:** Turn a full-table sort into an index range scan on a stable primary-key order
**Status:** Done

## Issue (before)

Every random content request used `ORDER BY random()`:

```sql
SELECT * FROM words
WHERE language = :language AND difficulty = :difficulty
ORDER BY random() LIMIT :count;

SELECT * FROM texts
WHERE is_custom = false AND type = :type
ORDER BY random() LIMIT 1;
```

PostgreSQL has to read every matching row, evaluate a random value per row, sort the result, and only
then apply the limit. The cost therefore grows with the size of the language/difficulty or preset pool
(`en` medium/hard words alone are 5,000 rows each), even though the endpoint returns at most a few dozen
rows.

The id-probe approach rejected in `25-uniform-random-text-selection.md` also cannot be reused: it is
biased by gaps in the id sequence.

## Solution (after)

Use a count plus a uniformly chosen offset over a deterministic order:

```java
long total = wordRepository.countByLanguageAndDifficulty(language, difficulty);
long offset = ThreadLocalRandom.current().nextLong(total - count + 1);
List<Word> words = wordRepository.findPageByLanguageAndDifficulty(
        language, difficulty.name(), count, offset);
```

The page queries order by the primary key and use the same filter as the count:

```sql
SELECT * FROM words
WHERE language = :language AND difficulty = :difficulty
ORDER BY word_id LIMIT :count OFFSET :offset;
```

`V11__add_ordered_sampling_indexes.sql` replaces the two-column lookup indexes with covering order
indexes so PostgreSQL can satisfy both the filter and the ordering from the index:

- `words (language, difficulty, word_id)`
- `texts (language, type, text_id)`
- `texts (is_custom, type, text_id)`
- `texts (is_custom, text_id)`

## Architecture pattern

- **Sample in application space, not by sorting:** the count defines the valid offset range and every
  offset maps to exactly one row because the order is deterministic. Selection stays uniform without
  reading the whole pool.
- **Match the index to the query shape:** the primary key in the trailing index position makes the
  `ORDER BY <pk>` free and keeps the `OFFSET` inside an index range scan.
- **One sampling strategy for all callers:** language+type random texts, single preset, and
  single preset-by-type now share the same count/offset mechanism.

## Impact

- Removes a full matching-set sort from every random word/text request; a page read replaces it.
- `OFFSET` still walks the skipped index entries, so very large pools would eventually favour keyset
  sampling. Current pools are a few thousand rows, where the offset scan is cheaper than sorting.
- No API, DTO, or error-contract changes beyond clearer "texts" wording in text-pool errors.

## Files changed

- `backend/src/main/java/com/rho/backend/repository/WordRepository.java` — add count + ordered page query;
  remove `findRandomByLanguageAndDifficulty`.
- `backend/src/main/java/com/rho/backend/repository/TextRepository.java` — add preset/language-type counts
  and ordered page queries; remove the three `ORDER BY random()` methods.
- `backend/src/main/java/com/rho/backend/service/WordService.java` — count, validate, random offset, page.
- `backend/src/main/java/com/rho/backend/service/TextService.java` — same sampling for all three random
  text paths; drop unused imports.
- `backend/src/main/resources/db/migration/V11__add_ordered_sampling_indexes.sql` — replace lookup
  indexes with primary-key-ordered indexes.
- `backend/src/test/java/com/rho/backend/content/RandomContentIntegrationTest.java` — covers counts,
  distinctness, over-count rejection, and single preset/type selection.

## Verification

- Compile: `./mvnw.cmd -q -DskipTests compile` (green).
- Focused tests: `./mvnw.cmd -q -Dtest=RandomContentIntegrationTest test` (5 passed).
- `JWT_SECRET` must be a Base64 value; the test profile decodes it with `Decoders.BASE64`.

## Rollback

Revert this commit. The repository methods, service bodies, and `V11` indexes return to the
`ORDER BY random()` implementation.
