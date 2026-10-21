# Refactor 3.2 — Cache word pools per language and difficulty

**Area:** Caching (`CacheConfig`, `WordService`)
**Architecture pattern:** Cache-aside for read-mostly data (bounded in-memory word pools)
**Status:** Done

## Bottleneck / anti-pattern (before)

Every `GET /api/v1/words` request ran two database round trips:

1. `countByLanguageAndDifficulty(...)` to size the available pool.
2. `findPageByLanguageAndDifficulty(...)` to read a random indexed page.

Words are seeded content and change only through rare admin writes, yet each typing-test request
paid both queries. Under load this multiplied connection-pool pressure for data that is effectively
static.

The random-selection paths also cannot use Spring's `@Cacheable` directly: caching the selected
words would return the same passage on every request. The cache must hold the **pool**, not the
**sample**.

## Solution / enhancement (after)

Add a `wordPools` Caffeine region and cache an immutable `WordPool(total, words)` per
`language:difficulty` key:

```java
private static final int MAX_CACHED_WORDS = 5_000;

WordPool getWordPool(String language, TextDifficulty difficulty) {
    String cacheKey = language + ':' + difficulty.name();
    WordPool cached = wordPoolCache.get(cacheKey, WordPool.class);
    if (cached != null) return cached;

    long total = wordRepository.countByLanguageAndDifficulty(language, difficulty);
    int poolSize = (int) Math.min(total, MAX_CACHED_WORDS);
    long offset = total > MAX_CACHED_WORDS
            ? ThreadLocalRandom.current().nextLong(total - MAX_CACHED_WORDS + 1)
            : 0;

    List<WordResponseDTO> words = wordRepository
            .findPageByLanguageAndDifficulty(language, difficulty.name(), poolSize, offset)
            .stream().map(WordResponseDTO::new).toList();

    WordPool pool = new WordPool(total, List.copyOf(words));
    wordPoolCache.put(cacheKey, pool);
    return pool;
}
```

On a cache hit, each request shuffles a copy of the immutable list and returns the first `count`
entries. No database work is performed:

```java
List<WordResponseDTO> shuffled = new ArrayList<>(pool.words());
Collections.shuffle(shuffled, ThreadLocalRandom.current());
return List.copyOf(shuffled.subList(0, count));
```

- **Full pool for current data:** the largest current group is 5,000 words, below
  `MAX_CACHED_WORDS`, so the cached list is the complete group and sampling remains uniform over
  all words rather than a frozen subset.
- **Bounded for future growth:** above 5,000 words the pool becomes a random contiguous page; the
  page is refreshed on TTL expiry or eviction. Memory stays bounded.
- **Oversized requests bypass the cache:** if `count` exceeds the cached page size but is still
  within the total, the service falls back to one indexed database page query, preserving the API
  contract.
- **Writes evict:** `saveWord`, `saveWords` and `deleteWord` clear the `wordPools` region, so a
  newly added or removed word is reflected on the next read.
- **Self-healing:** the shared Caffeine configuration keeps `maximumSize(1_000)` entries and
  `expireAfterWrite(30m)`, bounding memory and staleness even if an eviction path is missed.

This builds on the ordered indexed sampling from
[`38-ordered-random-sampling.md`](38-ordered-random-sampling.md): the cache is populated with one
indexed `LIMIT/OFFSET` query instead of `ORDER BY random()`.

## Architecture pattern

- **Cache-aside for immutable source data:** hot reads come from a bounded in-memory pool; random
  selection happens in application memory. Mutations are explicit invalidation points, not
  cache-through writes. TTL and size limits bound both memory and drift.

## Notes / trade-offs

- The cached value is an immutable `List<WordResponseDTO>` (records), safe to share across threads.
  Each request copies and shuffles it, so callers never observe shared mutable state.
- Only the Caffeine-backed local cache is used. The app is single-node for content reads, unlike the
  Redis-backed race room store.
- Cache keys are normalized to lower-case language plus enum name, so `EN` and `en` share a pool.
- No cache is added to `TextService` random paths: the existing `textCatalogue` region holds
  galleries, while random text reads stay uncached for the same "cache the pool, not the sample"
  reason.

## Files changed

- `backend/src/main/java/com/rho/backend/config/CacheConfig.java` — add the `wordPools` region.
- `backend/src/main/java/com/rho/backend/service/WordService.java` — cache-aside pool loading,
  in-memory shuffle, oversized-request fallback, eviction on word writes.
- `backend/src/test/java/com/rho/backend/content/RandomContentIntegrationTest.java` — clear the pool
  between transactional tests and verify cache population plus write eviction.

## Verification

- Compile: `.\mvnw.cmd -q -DskipTests compile` (green).
- Tests: `.\mvnw.cmd -q -Dtest=RandomContentIntegrationTest test` with a Base64 `JWT_SECRET`
  (6 tests, 0 failures, 0 errors).
- The test clears `wordPools` in `@BeforeEach` because the Caffeine cache lives outside the
  test-managed transaction and would otherwise outlive rolled-back inserts.
- PostgreSQL-specific query behavior is covered by the existing H2 profile only; Flyway and native
  `LIMIT/OFFSET` syntax remain unverified locally because the test profile disables Flyway.

## Rollback

Revert this commit. `WordService` returns to the uncached count + indexed page query from refactor
38; the `wordPools` region disappears from `CacheConfig`.
