# Refactor 1.4 — Enable Spring Cache (Caffeine) for the text catalogue

**Area:** Caching (`CacheConfig`, `TextService`)
**Architecture pattern:** Cache-aside for read-mostly data (Spring `@Cacheable` + `@CacheEvict`)
**Status:** Done

## Bottleneck / anti-pattern (before)

The Caffeine library was on the classpath but Spring's cache abstraction was never enabled
(`@EnableCaching` absent, no `CacheManager`), so nothing was ever cached. The text catalogue is
effectively static — seeded by Flyway and read by every client — yet each of these endpoints
re-queried the whole table and rebuilt the DTO list on every hit:

| Endpoint | Service method | Query |
| --- | --- | --- |
| `GET /api/v1/texts/preset-texts` | `getPresetTexts` | `findByIsCustomFalse()` |
| `GET /api/v1/texts/short` | `getShortTexts` | `findByType(SHORT)` |
| `GET /api/v1/texts/medium` | `getMediumTexts` | `findByType(MEDIUM)` |
| `GET /api/v1/texts/long` | `getLongTexts` | `findByType(LONG)` |
| `GET /api/v1/texts/thicc` | `getThiccTexts` | `findByType(THICC)` |

## Solution / enhancement (after)

Enable Spring's cache abstraction backed by Caffeine and mark those five read paths cacheable:

```java
@Configuration
@EnableCaching
public class CacheConfig {
    public static final String TEXT_CATALOGUE = "textCatalogue";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(TEXT_CATALOGUE);
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1_000)
                .expireAfterWrite(Duration.ofMinutes(30)));
        return manager;
    }
}
```

Each catalogue endpoint gets its own key in the single `textCatalogue` cache region (a no-arg method
would otherwise share the `SimpleKey.EMPTY` key), and the three text-write paths evict the whole
region so the catalogue is never stale:

```java
@Cacheable(cacheNames = CacheConfig.TEXT_CATALOGUE, key = "'preset'")  // 'short' / 'medium' / 'long' / 'thicc'
public List<TextResponseDTO> getPresetTexts() { ... }

@CacheEvict(cacheNames = CacheConfig.TEXT_CATALOGUE, allEntries = true)
public TextResponseDTO saveText(...) { ... }          // cache eviction also on saveCustomText + modifyText
```

- **Cache asides reads:** the first request populates the region; subsequent requests are served from
  memory with no query and no DTO rebuild.
- **Writes evict:** `saveText`, `saveCustomText` and `modifyText` invalidate the region, so a newly
  created/modified text is visible on the next read. `saveCustomText` is included because the
  `short`/`medium`/`long`/`thicc` galleries read *all* texts of a type (not only presets).
- **Bounded + self-healing:** `maximumSize(1_000)` caps memory and `expireAfterWrite(30m)` is a
  safety net that bounds staleness even if an eviction path is ever missed.

## Architecture pattern

- **Cache-aside (read-through) for read-mostly data:** hot, effectively-static read paths are served
  from a bounded in-memory cache; all mutations are explicit invalidation points rather than
  cache-through writes. TTL + size limits bound both memory and drift.

## Notes / trade-offs

- The random-selection paths (`getRandomText`, `getRandomTextByType`, `getRandomTexts`) are **not**
  cached — they must return a different row each call.
- `getTextsByLanguage` / `getUserTexts` are **not** cached — one is parameterized over a
  high-cardinality key, the other is per-user and not read-mostly.
- The cached value is an immutable `List<TextResponseDTO>` (records), safe to share across threads.
- Only the Caffeine-backed cache is used; no distributed cache is introduced (the app is single-node
  for this content, unlike the Redis-backed race room store).

## Files changed

- `backend/pom.xml` — add `spring-boot-starter-cache`.
- `backend/src/main/java/com/rho/backend/config/CacheConfig.java` (new).
- `backend/src/main/java/com/rho/backend/service/TextService.java` — `@Cacheable` on the five
  catalogue reads, `@CacheEvict` on the three text writes.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- Manually: hit `GET /api/v1/texts/preset-texts` twice and confirm the second call issues no SQL
  (with dev SQL logging enabled), then create a text and confirm the next read reflects it.
- Note: the existing `TextIntegrationTest` is a `@SpringBootTest` whose tests are `@Transactional`
  (rolled back per test); a Caffeine cache lives outside the transaction, so a cached catalogue can
  outlive a rolled-back insert. If that surfaces as test flakiness, the test (not the production
  config) should clear the cache — e.g. `@DirtiesContext` or injecting `CacheManager` to clear it in
  `@BeforeEach`. Full-suite execution needs Redis + Docker (Testcontainers), which were not available
  in this environment.

## Rollback

Revert this commit (removes the starter, the config bean and the annotations).
