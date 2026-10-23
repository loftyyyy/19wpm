# 19wpm
19wpm is a typing test app with solo practice modes and real-time multiplayer races. Guest sessions use localStorage; authenticated users sync results to the backend.


# WIP
- Streak
- diverse quotes
- Improve UI/UX
- Improve latency in races
- Mobile compatibility
- Ease of Use
- Smooth animations
- Fluidity
- Responsiveness
- Reduce library/package size


## Routes

| Path | Page |
|---|---|
| `/` | Landing |
| `/solo` | Typing test (words, phrases, time) |
| `/results` | Post-test results (WPM chart, replay, mistakes) |
| `/login` | Login / signup with OAuth2 (GitHub, Google) |
| `/oauth2/callback` | OAuth2 redirect handler |
| `/dashboard` | History, progression chart, stats |
| `/create` | Content creation |
| `/compete` | Compete against your personal best |
| `/leaderboard` | Leaderboard |
| `/about` | About |
| `/race` | Multiplayer race lobby |

## Tech Stack

| Frontend | Backend |
|---|---|
| React 19 | Spring Boot 4.0.2 (Java 17) |
| TypeScript | PostgreSQL + Flyway |
| Tailwind CSS v4 | Redis (tokens, live race rooms, matchmaking) |
| Vite | Bucket4j (rate limiting) |
| Recharts | STOMP / SockJS (WebSocket) |

## Getting Started

**Prerequisites:** Java 17, Node.js 20, PostgreSQL 14+, Redis 6+.

```sh
# Backend
cd backend
cp .env.example .env
./mvnw spring-boot:run        # starts on :8080

# Frontend
cd frontend
npm install
npm run dev                   # starts on :5173, proxies /api to :8080
```

Flyway runs migrations on startup. Word lists and preset texts are seeded at deploy time.

## Backend Performance Refactors

Each refactor is an isolated commit so it can be reverted on its own if it regresses.
Per-change write-ups live in [`docs/refactors/`](docs/refactors/).

| # | Change | Architecture pattern | Details |
|---|---|---|---|
| 1.1 | Race room live-state store + delta progress broadcasts | In-memory live state with write-through persistence; delta (event) broadcast | [`docs/refactors/01-race-room-live-store.md`](docs/refactors/01-race-room-live-store.md) |
| 1.2 | Race countdown uses a shared scheduler instead of a raw thread per start | Managed task scheduling (`TaskScheduler`) | [`docs/refactors/04-race-countdown-scheduler.md`](docs/refactors/04-race-countdown-scheduler.md) |
| 1.3 | Matchmaking pairs players on join instead of on the 2s poll | Event-driven matching with a serialized match routine + safety-net poll | [`docs/refactors/11-matchmaking-event-driven.md`](docs/refactors/11-matchmaking-event-driven.md) |
| 1.4 | Static text catalogue served from a Caffeine cache | Cache-aside for read-mostly data (Spring Cache + Caffeine) | [`docs/refactors/08-text-catalogue-cache.md`](docs/refactors/08-text-catalogue-cache.md) |
| 2.1 | JWT parsed once; redundant auth DB/Redis work removed | Single-pass token validation (parse-once, reuse claims) | [`docs/refactors/02-jwt-single-parse.md`](docs/refactors/02-jwt-single-parse.md) |
| 2.3 | Indexes for `words`/`texts` content lookups | Index the query predicates (access-path-aligned indexes) | [`docs/refactors/07-db-indexes.md`](docs/refactors/07-db-indexes.md) |
| 2.4 | Typing-result history is paginated in the database | Offset pagination with a stable page envelope | [`docs/refactors/09-typing-result-pagination.md`](docs/refactors/09-typing-result-pagination.md) |
| 2.5 | Frontend consumes the paginated history | "Load more" accumulation over the page envelope | [`docs/refactors/10-typing-result-pagination-frontend.md`](docs/refactors/10-typing-result-pagination-frontend.md) |
| 3.1 | SQL logging off; Open-Session-In-View disabled; bounded HikariCP pool | Transaction-scoped persistence context + environment-specific config via profiles | [`docs/refactors/03-jpa-osiv-sql-logging.md`](docs/refactors/03-jpa-osiv-sql-logging.md) |
| 4.1 | Random word/text selection done in the database | Push selection down to the database (set-based random sampling) | [`docs/refactors/05-word-text-random-selection.md`](docs/refactors/05-word-text-random-selection.md) |
| 4.2 | User-stats update is a single atomic SQL statement | Atomic state transition (single-statement read-modify-write) | [`docs/refactors/06-user-stat-atomic-update.md`](docs/refactors/06-user-stat-atomic-update.md) |
| 5.1 | Solo route chunk is fetched from landing intent instead of after navigation | Intent-based route prefetching over a memoized dynamic import | [`docs/refactors/32-solo-route-intent-prefetch.md`](docs/refactors/32-solo-route-intent-prefetch.md) |
| 5.2 | Solo route and passage loading use typing-shaped skeletons | Route-specific Suspense fallback plus content-shaped loading state | [`docs/refactors/33-typing-skeleton-fallback.md`](docs/refactors/33-typing-skeleton-fallback.md) |
| 5.3 | First passage is deadline-bounded and falls back locally | Deadline-bounded remote read with an immediate local fallback | [`docs/refactors/34-passage-deadline-local-fallback.md`](docs/refactors/34-passage-deadline-local-fallback.md) |
| 6.1 | Passage batches share a TTL cache and in-flight request map | TTL cache-aside with request coalescing | [`docs/refactors/35-passage-cache-inflight-dedupe.md`](docs/refactors/35-passage-cache-inflight-dedupe.md) |
| 6.2 | Landing warms the passage cache on idle and start intent | Idle-time cache warming keyed by current preferences | [`docs/refactors/36-landing-idle-passage-prefetch.md`](docs/refactors/36-landing-idle-passage-prefetch.md) |
| 6.3 | Typing page renders cached passages first and revalidates in the background | Stale-while-revalidate with an append-only queue | [`docs/refactors/37-passage-cache-first-swr.md`](docs/refactors/37-passage-cache-first-swr.md) |
| 7.1 | Random words/texts use count + indexed offset instead of `ORDER BY random()` | Uniform sampling over an ordered index | [`docs/refactors/38-ordered-random-sampling.md`](docs/refactors/38-ordered-random-sampling.md) |
| 7.2 | Word pools are cached per language/difficulty and shuffled in memory | Cache-aside for read-mostly data with bounded in-memory pools | [`docs/refactors/39-word-pool-cache.md`](docs/refactors/39-word-pool-cache.md) |
| 7.3 | Batch content reuses the existing `count` parameters | Batch retrieval over a parameterized read | [`docs/refactors/40-batch-content-reuse.md`](docs/refactors/40-batch-content-reuse.md) |
| 7.4 | Content endpoints report service time in `Server-Timing` | Per-route response-header instrumentation | [`docs/refactors/41-server-timing-telemetry.md`](docs/refactors/41-server-timing-telemetry.md) |
| 8.1 | Typing render path reports keystroke and viewport timing | User Timing marks around the keydown-to-commit path | [`docs/refactors/42-performance-instrumentation.md`](docs/refactors/42-performance-instrumentation.md) |
| 8.2 | Inactive words stop re-rendering on every keystroke | Active-only prop boundary + strict leaf memoization | [`docs/refactors/43-strict-word-memoization.md`](docs/refactors/43-strict-word-memoization.md) |
| 8.3 | Caret movement no longer triggers layout | Compositor-only transform animation | [`docs/refactors/44-cursor-transform-animation.md`](docs/refactors/44-cursor-transform-animation.md) |
| 9.1 | Cold starts use bounded database and Redis pools; deployment stays warm | Bounded resource pools with fail-fast timeouts; explicit capacity constraint | [`docs/refactors/45-cold-start-and-connection-pools.md`](docs/refactors/45-cold-start-and-connection-pools.md) |
| 9.2 | Multi-replica audit confirms race rooms and STOMP remain instance-local | Explicit single-replica capacity constraint | [`docs/refactors/17-race-room-store-seam.md`](docs/refactors/17-race-room-store-seam.md) |
| 9.3 | k6 suite validated against the optimized read endpoints | Scripted arrival-rate load testing with thresholds | [`k6/README.md`](k6/README.md) |
| 10.1 | Pull requests enforce bundle and Lighthouse performance budgets | Automated performance budgets in CI | [`docs/refactors/46-ci-performance-regression-gates.md`](docs/refactors/46-ci-performance-regression-gates.md) |
| 10.2 | Backend requests, services, and repositories emit Actuator, Prometheus, and OTLP telemetry | Automatic HTTP instrumentation + declarative observations at service and repository boundaries | [`docs/refactors/47-backend-telemetry.md`](docs/refactors/47-backend-telemetry.md) |
| 10.3 | Browsers report Core Web Vitals and Start Typing latency to a Micrometer-backed ingress | Beacon-delivered field metrics + bounded-cardinality server summaries | [`docs/refactors/48-frontend-rum.md`](docs/refactors/48-frontend-rum.md) |
| 11.1 | Race rooms move to Redis and STOMP events bridge across replicas | Shared-state store with distributed locks + Pub/Sub event bridge | [`docs/refactors/17-race-room-store-seam.md`](docs/refactors/17-race-room-store-seam.md) |
| 11.2 | Matchmaking pairs players by WPM and accuracy across replicas | Skill-based pairing over sharded queues + distributed lock | [`docs/refactors/11-matchmaking-event-driven.md`](docs/refactors/11-matchmaking-event-driven.md) |
| 11.3 | Race finishes are validated server-side; suspicious runs are flagged | Server-authoritative scoring + tiered anti-cheat verdicts | [`docs/refactors/49-server-authoritative-anti-cheat.md`](docs/refactors/49-server-authoritative-anti-cheat.md) |

### 1.1 — Race room live-state store + delta progress broadcasts

**Before:** every progress tick read-modify-wrote the *entire* race room (all participants + the
full passage text) as JSON in Redis and rebroadcast that whole object to every subscriber —
O(N²) payload fan-out, write amplification, and a non-atomic GET/SET that could lose updates.

**After:** live rooms are held in an in-memory `RaceRoomStore` (Caffeine, idle-expiring) and Redis
is written only on lifecycle transitions (create / join / start / racing / finish / disconnect).
Room mutations are guarded by a per-room monitor so concurrent updates can't be lost, and progress
ticks now emit a fixed-size `RaceProgressDTO` on a dedicated `/topic/room/{code}/progress` topic
that the client merges into its last full snapshot.

**Impact:** removes two Redis round-trips plus full-room serialization per tick per participant,
fixes the concurrent lost-update bug, and drops the per-tick payload from O(participants) to a
constant-size delta.

> Superseded in Phase 9: live rooms now live in Redis rather than the in-memory store. See 11.1 below.

### 1.2 — Race countdown on a shared scheduler

**Before:** each race start spawned a raw `new Thread(...)` that slept for the countdown (~3.5s)
before flipping the room to `RACING` — one unmanaged OS thread per race, parked in `sleep`.

**After:** the delayed transition is scheduled on the container-managed `TaskScheduler`
(`taskScheduler.schedule(..., Instant.now().plusMillis(COUNTDOWN_DURATION_MS))`); no thread sleeps,
the pool is bounded and named, and it is shut down with the application context.

**Impact:** no thread-per-race creation; concurrent countdowns are absorbed by a managed pool and
no threads leak across redeploys.

### 1.4 — Static text catalogue cached with Caffeine

**Before:** Caffeine was on the classpath but Spring's cache abstraction was never enabled, so every
hit to the text catalogue (`/preset-texts`, `/short`, `/medium`, `/long`, `/thicc`) re-queried the
whole table and rebuilt the DTO list — even though the catalogue is seeded at deploy time and
effectively static.

**After:** `@EnableCaching` with a Caffeine `CacheManager` (bounded at 1k entries, 30-minute
write-expiry). The five catalogue reads are `@Cacheable` under one `textCatalogue` region (distinct
keys); the three text write paths (`saveText`, `saveCustomText`, `modifyText`) `@CacheEvict` the
region so newly created/edited texts appear immediately. Random-selection paths are intentionally
not cached.

**Impact:** catalogue reads are served from memory with no query and no DTO rebuild; writes stay
correct via eviction.

### 1.3 — Event-driven matchmaking on join

**Before:** pairing was polled. `MatchmakingScheduler` ran `pollQueues()` every 2 s, which swept all
five queues with an `LLEN` each — even when nobody was queued — and players waited up to 2 s to be
paired after their opponent joined.

**After:** `joinQueue` enqueues the player and immediately calls the (extracted) `matchQueue(textType)`,
so a pair forms as soon as the second player arrives. `matchQueue` is guarded by a `ReentrantLock` so
overlapping callbacks (concurrent joins + the poll) can't pop the same player into two rooms; the
scheduler now runs only as a **low-frequency safety net** (`fixedRate = 10000`).

**Impact:** match latency drops from up to 2 s to near-immediate; idle queue sweeps fall from every
2 s to every 10 s.

### 2.1 — JWT parsed once; redundant auth DB/Redis work removed

**Before:** every authenticated request verified the JWT signature **three times**
(`isRefreshToken` → `extractSubject` → `isAccessTokenValid`) and hit the database **twice**
(`existsByEmail` then `loadUserByUsername`), because `JwtService` only exposed
string-in/boolean-out helpers that each re-parsed the token.

**After:** the filter parses/verifies the token once and reuses the `Claims`
(`isAccessClaimsValid(Claims)`), and loads the user once instead of an existence check plus a load.
The STOMP `CONNECT` interceptor does the same and now also enforces expiry. Re-parsing helpers
were deleted.

**Impact:** 3 → 1 signature verifications and 2 → 1 DB queries per authenticated request; the
STOMP handshake gains expiry validation it previously lacked.

### 2.3 — Indexes for content lookups

**Before:** the schema indexed only `texts(is_custom)` and `texts(created_by)`, so the
language/difficulty and language/type content-selection queries sequential-scanned `words` (~13k
seeded rows) and `texts`.

**After:** `V10__add_lookup_indexes.sql` adds `words(language, difficulty)`,
`texts(language, type)` and `texts(type)` — leading-column composites that also cover the
language-only filter.

**Impact:** content lookups use an index instead of a full table scan.

### 2.4 — Typing-result history paginated in the database

**Before:** `GET /api/v1/result` returned **every** result the user had ever recorded as an unbounded
`List`, mapping the full history to DTOs per request (each row recompiling a `\\s+` regex for its
word count), with the sort hard-coded in the query.

**After:** the query is `Page<TypingResult> findByUserWithUser(userId, Pageable)` (a `COUNT` query
plus `LIMIT/OFFSET`), the endpoint takes `page`/`size` (default 20, `createdAt DESC`) and returns a
stable `PageResponseDTO` envelope; the word count uses one shared compiled pattern.

**Impact:** transfer and mapping are bounded by the page size instead of the whole history; deep
history is served via the existing `typing_results(user_id, created_at)` index. (The frontend
consumer is updated in 2.5.)

### 2.5 — Frontend consumes the paginated history

**Before:** `apiGetResults()` expected the whole history as one array; `RecentHistory` faked paging
with a local `page` counter and `slice()`.

**After:** the API type is `ApiPage<T>`; `AuthContext` loads the first page, tracks `hasMoreResults`
and **appends** pages via `loadMoreResults()`; `RecentHistory` shows a server-driven "Load More" and
no longer slices locally.

**Impact:** the client no longer holds/maps the entire history up front; paging matches the backend
envelope. Note: history search now filters the *loaded* pages (full-history search is a follow-up).

### 3.1 — SQL logging off; Open-Session-In-View disabled; bounded HikariCP pool

**Before:** the configuration shipped `show-sql=true` (every statement logged on the hot path) and
left `spring.jpa.open-in-view` at the Spring Boot default of `true`, so a database connection was
held open for the whole HTTP request — controller execution plus JSON serialization. HikariCP was
left with implicit, undocumented defaults.

**After:** `show-sql=false` (dev-only logging moved to `application-dev.properties`),
`open-in-view=false` so the Hibernate session/connection is scoped to the transaction, and explicit
HikariCP sizing (`DB_POOL_MAX`/`DB_POOL_MIN`-overridable). The single OSIV-dependent read path
(`UserStatService.getStat`, which dereferenced the lazy `UserStat.user`) is now
`@Transactional(readOnly = true)`, as is `TypingResultService.getResultsByUser`. These settings live
in the committed profile files (`application-prod.properties` / `application-dev.properties`).

**Impact:** no SQL logging on the request path outside dev, DB connections returned to the pool at
transaction end instead of end-of-request, and a bounded, tunable connection pool.

### 4.1 — Random word/text selection in the database

**Before:** `getRandomWords` / `getRandomTexts` fetched **every** row matching a language +
difficulty/type bucket into the app, `Collections.shuffle`d the list, and kept `count` of them.

**After:** a native `SELECT ... ORDER BY random() LIMIT :count` returns at most `count`
uniformly-random rows; the service never sees the rest of the bucket. The oversized-`count` guard is
now `size() < count` against the small result set.

**Impact:** transfer and heap usage are bounded by `count` instead of the bucket size on a hot
endpoint.

### 4.2 — Atomic user-stats update

**Before:** `updateUserStats` loaded the `user_stats` row, recomputed the running average / best /
count in Java, and saved it back — a read-modify-write that loses updates when two results arrive
concurrently.

**After:** a single `@Modifying UPDATE user_stats SET ... text_completed = text_completed + 1 ...`
computes everything against the row's current values in one row-locked statement, consistent with
the atomic streak update. `updatedRows == 0` preserves the "not found" behaviour.

**Impact:** concurrent result submissions no longer clobber each other's count/average.

### 5.1 - Solo route chunk is fetched from landing intent

**Before:** the lazy `/solo` route downloaded `TypingTest` only after navigation, so the global
page spinner stood between the click and the typing page.

**After:** `preloadSolo()` memoizes the route import and is called after an 800 ms idle window, on
start-button pointer/focus/touch intent, and on click. `App.tsx` reuses the same import for the lazy
route, and the start button exposes a busy state while the transition begins.

**Impact:** the route chunk can download while the user configures the test, removing one serial
step from the click-to-type path. A slow or missing prefetch still falls back to normal Suspense
loading.

### 5.2 - Typing-shaped loading skeletons

**Before:** the `/solo` route used the global centered spinner while its chunk loaded, then the
passage card showed a single "Loading passage..." line before expanding into the typing layout.

**After:** the route has a specific Suspense fallback shaped like the typing page, and the card uses
a reusable passage skeleton. Both expose a polite status label and keep the final layout stable.

**Impact:** removes the full-screen spinner flash and the layout jump between loading and typing.

### 5.3 - Deadline-bounded passage loading

**Before:** the first `/words` or `/texts` request had no time bound. A slow backend could leave the
typing page loading indefinitely, and a late response could still write to the queue after a
preference change or unmount.

**After:** each passage batch is aborted at 1.5 seconds and replaced with a synchronously generated
local passage. One quick retry is allowed while enough deadline remains, and request ids invalidate
stale work after preference changes or unmounts. `api.get` now accepts an optional `RequestInit` so
the queue can pass an `AbortSignal`.

**Impact:** the first passage arrives within 1.5 seconds even when the API is slow or unavailable,
and stale requests cannot mutate the queue.

### 6.1 - Shared passage cache with request coalescing

**Before:** every queue batch fetched `/words` or `/texts` directly, so the landing screen and the
typing screen could not share work, and concurrent consumers could duplicate the same request.

**After:** `passageCache.ts` owns word and phrase fetching behind five-minute, preference-keyed
entries, a synchronous `getCachedPassages` lookup, and a `Map` of in-flight promises. Successful
batches are cached; failures preserve the previous entry. Queue refills force a new batch but still
join an in-flight request, preventing duplicate passages from being appended.

**Impact:** identical preference sets can share one network response, and a late response warms the
cache for the next visit while the current queue keeps its 1.5-second local fallback.

### 6.2 - Landing-page passage prefetch

**Before:** the landing page prefetched the `/solo` route chunk but still left the first `/words` or
`/texts` request to start after navigation.

**After:** an idle callback prefetches the current preference set, and every preference change
replaces the pending warm-up with one for the new key. Start-button intent warms both the route and
the passage cache before the click navigates.

**Impact:** a user who pauses on the landing page can arrive with the route and its first passage
batch already available, while failures still fall back to the bounded typing-page fetch.

### 6.3 - Cache-first passages with background revalidation

**Before:** the typing page always started with an empty queue, even when the landing page had just
prefetched the same preferences.

**After:** `usePassageQueue` reads the cache synchronously on mount. A cache hit renders immediately;
a stale hit is served while a forced batch revalidates in the background. Revalidation only appends
to the upcoming queue, so the passage already on screen cannot change.

**Impact:** the landing warm-up becomes a real instant start, and stale passages remain available
without blocking the test.

### 7.1 - Indexed offset sampling for random content

**Before:** random words and texts used `ORDER BY random()` (or function-based random ordering), so
PostgreSQL sorted the whole matching set on every request; even cached galleries did not help the
non-cached random paths.

**After:** each request counts the matching rows, picks a random `OFFSET` in
`[0, total - count]`, and reads one page ordered by the primary key. Dedicated indexes cover the
language/difficulty and language/type predicates, so the count and page read stay index-only or
index-range scans.

**Impact:** request cost is proportional to the page size instead of the full content set, and the
sampled rows are uniformly distributed without a sort.

### 7.2 - Cached word pools

**Before:** every word request ran a count plus a page query, even though seeded words change only
through admin writes.

**After:** a `wordPools` Caffeine region holds an immutable pool per `language:difficulty`, capped at
5,000 words. Requests shuffle a copy in memory; oversized requests fall back to the indexed page
query, and word writes evict the region.

**Impact:** warm requests do no database work while preserving uniform sampling over the current
5,000-word groups.

### 7.3 - Reuse existing batch endpoints

**Before:** the plan called for a batch content API, but `/words` and `/texts` already accepted
`count`, and the frontend already requested `wordCount * 5` words or five texts per batch.

**After:** kept the existing endpoints as the batch contract; no duplicate `/batch` route was added.
Invalid counts and counts above the pool still return a client error.

**Impact:** fewer routes to maintain and no change to the frontend's cache/queue batching.

### 7.4 - Server-Timing telemetry

**Before:** a slow passage request was indistinguishable from security, serialization, or network
overhead in the browser and in k6 output.

**After:** `/words`, `/texts`, `/texts/{id}`, and `/texts/random` return
`Server-Timing: <metric>;dur=<ms>`, and CORS exposes the header to the frontend origin.

**Impact:** cache hits, database reads, and sampling cost are visible per request without changing
the response body; total client latency remains available from the browser or k6.

### 8.1 - Typing render instrumentation

**Before:** slow keystrokes could not be attributed to the engine, React rendering, or caret layout.

**After:** `19wpm:keystroke` measures keydown through the first committed viewport update, and
`19wpm:viewport` measures render through the final layout effect. Both are exposed through the
browser's User Timing API and remain enabled in production builds.

**Impact:** the production-preview baseline for a 240-word timed passage was 0.8 ms p50 / 1.2 ms p95
per keystroke and 0.6 ms p50 / 1.0 ms p95 per viewport render.

### 8.2 - Active-only word memoization

**Before:** `TypedWord` was memoized, but every word received the changing `activeGlobalIdx`, so the
comparator invalidated every word and React reconciled the whole passage on each keystroke.

**After:** only the active word receives the cursor index; inactive words receive `-1` and skip the
typed-segment comparison. The leaf is now `Word`, with a stable word ref callback and character refs
only on the current and last characters.

**Impact:** keystroke timing fell to 0.3 ms p50 / 0.5 ms p95 and viewport timing to 0.2 ms p50 /
0.3 ms p95, roughly a 60–70% reduction.

### 8.3 - Transform-based caret

**Before:** the caret animated `left` and `top`, forcing layout work on every animation frame.

**After:** the caret is positioned once with `translate3d` and subsequent moves animate
`translateX`/`translateY`. Invariant geometry moved to `.typing-cursor`, and the conflicting CSS
transition and unused keyframes were removed.

**Impact:** cursor motion stays on the compositor; typing timings were unchanged because the
benchmark markers do not include paint or compositing.

### 9.1 - Warm single replica with bounded connection pools

**Before:** Hikari waited up to 30 seconds for a cold PostgreSQL connection, Redis had no connection
pool, and no deployment manifest prevented scale-to-zero.

**After:** database connections fail within 5 seconds and are validated within 2 seconds; Redis uses
a Lettuce pool with 2-second command/connect timeouts. `deploy/container-app.yaml` pins
`minReplicas: 1` and `maxReplicas: 1`, so an idle app stays warm without pretending horizontal
scaling is safe.

**Impact:** a cold start no longer becomes a 30-second request; connection growth is bounded. The
limits are reasoned defaults, not load-test results.

### 9.2 - Race-room scale-out re-audit

**Before:** the single-replica requirement was documented, but the scale-out blockers were not
enumerated in one place.

**After:** the audit records four independent instance-local mechanisms: Caffeine room state, the
simple STOMP broker, the local countdown scheduler, and the matchmaking lock. At the time, all four
had to change before `maxReplicas` could exceed 1.

**Impact:** the deployment constraint is now explicit in both code-adjacent documentation and the
Container Apps manifest.

> Superseded in Phase 9: all four blockers were replaced (Redis room state, Pub/Sub event bridge,
> Redis countdown ZSET, distributed matchmaking lock). See 11.1-11.3. The manifest still runs one
> replica by choice, not because the code requires it.

### 9.3 - k6 suite validation

**Before:** the load-test suite was committed, but its coverage of the optimized content endpoints
had not been rechecked after the performance work.

**After:** all six scripts pass `k6 inspect`. The read-heavy workload exercises random texts, text
batches, cached word pools, text by id, stats, and paginated results at 100 requests per second.

**Impact:** the optimized read paths remain covered by the committed suite; the measured median
baseline remains the 2026-10-19 run because local services were unavailable for a rerun.

## Phase 9: Distributed Multiplayer

Phase 9 removes the single-instance assumptions behind races. The deployment template still runs one
replica by default, but the application is now safe to scale horizontally when Redis is shared. The
client-facing wire contract and operator procedures are in
[`docs/api/race-contract.md`](docs/api/race-contract.md) and
[`docs/runbooks/distributed-race-operations.md`](docs/runbooks/distributed-race-operations.md).

### 11.1 - Race rooms move to Redis and STOMP events bridge across replicas

**Before:** live rooms lived in a process-local Caffeine store, the STOMP broker was process-local,
and the countdown used a local scheduler. A room's participants had to stay on one instance.

**After:** rooms are persisted as `PersistedRaceRoom` JSON under `race:room:{code}` and mutated under
a Redis lock (`race:lock:{code}`). The countdown deadline is a `race:countdown` sorted-set member
polled by every replica, so any replica can settle it. Full-room and targeted STOMP messages are
delivered locally and republished on the `race:events` Pub/Sub channel; peers deliver them to their
own sessions and ignore their own echo.

**Impact:** rooms and reconnects are replica-independent, a replica crash no longer strands a
countdown, and clients do not need sticky sessions. See
[`17-race-room-store-seam.md`](docs/refactors/17-race-room-store-seam.md). The trade-off is that
Redis is now on the live race path: a Redis outage ends in-flight rooms, and each progress tick takes
a distributed lock.

### 11.2 - Matchmaking pairs players by skill across replicas

**Before:** matchmaking matched players by arrival order, so a beginner could be paired with a much
faster typist.

**After:** queue entries carry WPM and accuracy. `SkillMatchmaker` pairs the closest score within a
WPM tolerance that widens every 10 seconds and force-pairs after 20 seconds. Queues, presence, and
pending room codes live in Redis, and pairing runs under a per-text-type lock so two replicas cannot
match the same player twice.

**Impact:** matches are closer and work across replicas. The trade-off is waiting longer for a
well-matched opponent; the widening tolerance bounds that wait. See
[`11-matchmaking-event-driven.md`](docs/refactors/11-matchmaking-event-driven.md).

### 11.3 - Race finishes are validated server-side

**Before:** a client's reported WPM and correctness were trusted for ranking and streaks.

**After:** the server computes WPM from `correctChars` and the server-observed race start time,
analyzes optional inter-key intervals, and classifies the finish as `VALID`, `QUARANTINED`, or
`DISQUALIFIED`. Quarantined runs stay ranked but do not credit a streak; disqualified runs are
unranked and do not increment `finish_count`. The claimed WPM, computed WPM, status, and flags are
persisted on `race_results` by `V12`.

**Impact:** ranking and streaks no longer trust a single client-reported number, and suspicious runs
leave an audit trail. The trade-off is more stored data and a small number of false positives from
missing telemetry; thresholds are documented in
[`49-server-authoritative-anti-cheat.md`](docs/refactors/49-server-authoritative-anti-cheat.md).

## Code Review Remediation

Follow-up fixes from a full-codebase review (security, correctness, and cleanliness). Each is an
isolated commit so it can be reverted on its own. Per-change write-ups live in
[`docs/refactors/`](docs/refactors/).

| # | Change | Architecture pattern | Details |
|---|---|---|---|
| CR-1.1 | Only the current word re-renders per keystroke | Memoized leaf component with a custom comparator | [`docs/refactors/16-memoized-typed-word-rendering.md`](docs/refactors/16-memoized-typed-word-rendering.md) |
| CR-1.2 | OAuth tokens no longer travel in the redirect query string | Out-of-band handoff via a short-lived, single-use exchange code | [`docs/refactors/12-oauth-token-query-string.md`](docs/refactors/12-oauth-token-query-string.md) |
| CR-1.3 | Refresh-token rotation is atomic (single-use via GETDEL) | Atomic check-and-consume (single-use token) | [`docs/refactors/13-refresh-token-atomic-rotation.md`](docs/refactors/13-refresh-token-atomic-rotation.md) |
| CR-1.4 | Content writes require auth; user-scoped reads no longer 500 | Deny-by-default allowlist + method guards | [`docs/refactors/14-content-endpoint-authorization.md`](docs/refactors/14-content-endpoint-authorization.md) |
| CR-1.5 | Client errors return 400/401/403 instead of 500 | Explicit exception→status mapping + guarded catch-all | [`docs/refactors/15-exception-handler-status-mapping.md`](docs/refactors/15-exception-handler-status-mapping.md) |
| CR-1.6 | Auth hot path no longer reloads the user from the DB on every request | Short-TTL read-through cache (failures uncached) | [`docs/refactors/19-cached-user-details.md`](docs/refactors/19-cached-user-details.md) |
| CR-3.2 | Live race-room store sits behind a seam; single-instance constraint documented | Port/adaptor seam (distributed store deferred) | [`docs/refactors/17-race-room-store-seam.md`](docs/refactors/17-race-room-store-seam.md) |
| CR-3.1 | Durable rooms reference the passage by id instead of embedding it | Durable projection with `textId` + rehydrate on load | [`docs/refactors/18-race-room-persist-text-reference.md`](docs/refactors/18-race-room-persist-text-reference.md) |
| CR-2.1 | Solo test and race share one typing viewport instead of two copies | Single presentational component + extracted hook | [`docs/refactors/20-shared-typing-viewport.md`](docs/refactors/20-shared-typing-viewport.md) |
| CR-2.2 | Removed two unused, misleading imports from `TextService` | Dead-code removal | [`docs/refactors/21-textservice-dead-imports.md`](docs/refactors/21-textservice-dead-imports.md) |
| CR-2.3 | Admin and custom text creation share one build path | Extract invariant + parameterize `isCustom` | [`docs/refactors/22-textservice-create-dedup.md`](docs/refactors/22-textservice-create-dedup.md) |
| CR-2.4 | `logoutAll` failures keep their original cause | Exception chaining | [`docs/refactors/23-logoutall-preserve-cause.md`](docs/refactors/23-logoutall-preserve-cause.md) |
| CR-2.5 | `RaceRoomRepository` injects the shared mapper and keeps failure causes | DI over ad-hoc construction + exception chaining | [`docs/refactors/24-raceroom-repository-mapper-cause.md`](docs/refactors/24-raceroom-repository-mapper-cause.md) |
| CR-3.3 | Random preset text is sampled uniformly in one query | Push sampling into the datastore (`ORDER BY random()`) | [`docs/refactors/25-uniform-random-text-selection.md`](docs/refactors/25-uniform-random-text-selection.md) |
| CR-3.4 | Result history reads a projection instead of whole entities | Read-model projection | [`docs/refactors/26-typing-result-projection.md`](docs/refactors/26-typing-result-projection.md) |
| Fix | `OAuth2SuccessHandlerTest` synced to the exchange-code handler (CR-1.2 follow-up) | Test double aligned to the current collaborator seam | [`docs/refactors/27-oauth-success-handler-test-sync.md`](docs/refactors/27-oauth-success-handler-test-sync.md) |
| Fix | `RaceRoomRepository` injects Boot 4's Jackson 3 mapper (CR-2.5 follow-up) | Inject the container-managed bean type | [`docs/refactors/28-raceroom-jackson3-mapper.md`](docs/refactors/28-raceroom-jackson3-mapper.md) |
| Fix | Race countdown synced to the server clock (was desynced / stuck on `GO!`) | Clock-offset estimation (NTP-style round trip) over STOMP | [`docs/refactors/29-server-clock-offset-sync.md`](docs/refactors/29-server-clock-offset-sync.md) |
| Fix | Race accuracy counts corrected mistakes, matching practice mode | One accuracy definition (cumulative keystroke stats) across modes | [`docs/refactors/30-race-accuracy-keystroke.md`](docs/refactors/30-race-accuracy-keystroke.md) |
| Fix | Stale streak no longer shown after a missed day | Read-time derived view over the stored streak state | [`docs/refactors/31-streak-current-read-model.md`](docs/refactors/31-streak-current-read-model.md) |

### CR-1.1 — Only the current word re-renders per keystroke

**Before:** `TypingTest.tsx` and `Race.tsx` inlined the whole passage render, so every keypress
rebuilt **every word and every character** — O(n) over the passage — even though only the current
word can change. The loop also recomputed `passageLength`/`passageText` per character and called
`chars.filter(...)` per word, and mutated a ref (`useRightEdgeRef`) during render.

**After:** a shared memoized `TypedWord` renders one word with precomputed props, and a custom
`areEqual` comparator only inspects that word's slice of `typedChars`, so untouched words bail out.
The per-render invariants are hoisted above the loop, `NO_EXTRA_CHARS` keeps the `extraChars` prop
reference stable, and the render-time ref mutation is replaced by a value derived where it is used.

**Impact:** per-keystroke render work drops from O(n) across the passage to O(word length), and ~200
lines of duplicated render logic collapse into one component shared by both surfaces.

### CR-1.2 — OAuth tokens off the redirect URL

**Before:** the OAuth2 success handler appended the access **and** 30-day refresh token to the
`/oauth2/callback` redirect (`?accessToken=…&refreshToken=…`), so the tokens were written to browser
history, forwardable via `Referer`, and logged by any proxy/CDN on the frontend origin.

**After:** the handler mints a 256-bit `SecureRandom` code, stores `oauth:code:{code} → userId` in
Redis for 60 s, and redirects with `?code=…` only. The frontend `POST`s the code to
`/api/v1/auth/oauth/exchange`, where `consumeOAuthCode` redeems it with `GETDEL` (single-use) and the
existing `issueTokenPair` path mints the pair in the response body.

**Impact:** tokens never appear in a URL; a leaked redirect exposes at most a one-shot code that
expires in a minute. OAuth now shares the same token-minting path as password login/register.

### CR-1.3 — Atomic refresh-token rotation

**Before:** `AuthService.refresh` verified the refresh token (`EXISTS`) and then rotated it
(`DEL` + `SET`) in separate Redis calls, leaving a check-then-act window in which the same token
could be redeemed twice and the revoke-on-reuse theft detection could silently miss.

**After:** `RedisTokenStore.consumeRefreshToken` performs a single atomic `GETDEL` — only one caller
can win; every other caller is treated as theft and has all sessions revoked. The new pair is then
stored. The now-redundant `isRefreshTokenValid`/`rotateRefreshToken` methods are removed.

**Impact:** a refresh token is redeemable exactly once under concurrency, theft detection is
reliable, and each refresh costs one fewer Redis round-trip.

### CR-1.4 — Authorize user-scoped content endpoints

**Before:** the filter chain permitted the whole `/api/v1/texts/**` subtree. That exposed
`POST /api/v1/texts/custom-text` as an anonymous write path and let `GET /texts/{id}` /
`GET /texts/user-texts` dereference a `null` principal (NPE → 500).

**After:** `permitAll` is now an explicit allowlist of the read-only content paths (random words,
random/preset texts, size buckets, language filter). The user-scoped handlers require authentication
both at the filter (falling through to `anyRequest().authenticated()`) and via
`@PreAuthorize("isAuthenticated()")`.

**Impact:** anonymous content writes are blocked and principal-dependent reads return 401 instead of
500; guest solo typing is unchanged because every endpoint it uses stays public.

### CR-1.5 — Map client errors to correct HTTP statuses

**Before:** `InvalidResourceException`, `UnauthorizedResourceException`, and `PasswordException`
were thrown across the services but had no handler, so bad input returned 500 instead of 400,
ownership failures 500 instead of 403, and failed credential checks 500 instead of 401.

**After:** each exception now maps to its correct status, with a guarded `Exception` catch-all that
preserves framework statuses (404 unknown route, 405 wrong method) and returns a consistent JSON 500
body — logged once with a stack trace — for anything genuinely unexpected.

**Impact:** the API reports client errors accurately, the frontend can react to them, and 5xx
alerting no longer fires on ordinary validation/authorization failures.

### CR-1.6 — Cache resolved user details on the auth hot path

**Before:** every authenticated request and every STOMP connect ran
`userDetailsService.loadUserByUsername(...)` — a database query with a role `JOIN FETCH` — just to
re-resolve an identity that changes only rarely.

**After:** a new `UserDetailsCache` serves resolved `UserDetails` from a Caffeine cache (per email,
60 s TTL, 10k entries). Only the two read-only consumers (the JWT filter and the STOMP channel
interceptor) use it; the login flow still resolves a fresh, managed entity because it mutates the
user's timezone on login. Unknown users are never cached, so `UsernameNotFoundException` still
rejects deleted accounts on every request.

**Impact:** one fewer DB query per authenticated request/connection; account and role changes
propagate within 60 s.

### CR-3.2 — Live race-room store seam

**Before:** `RaceRoomStore` was a concrete `@Component` holding authoritative live room state in a
process-local cache, and every caller depended on that class directly — baking the single-instance
assumption into the callers and leaving it undocumented.

**After:** `RaceRoomStore` is now an interface with the existing behavior moved to
`InMemoryRaceRoomStore`. Callers are unchanged (same package/name resolves to the interface) and
behavior is identical; the fast live path (`get`/`put`) and the durable write-through (`persist`)
are now explicit. The distributed implementation is deferred and its scale-out path (shared Redis
state, cross-instance broadcast, distributed coordination, routing) is written up.

**Impact:** no behavior change, but the store is now swappable and the single-instance deployment
requirement is an explicit, documented constraint rather than an accidental one.

### CR-3.1 — Persist only the text reference for race rooms

**Before:** `RaceRoomRepository.save` serialized the whole live `RaceRoom` to Redis, including the
full passage content, and re-wrote it on every lifecycle transition (create, each join, start,
finish) even though the passage is immutable and already lives in the `texts` table.

**After:** a new `PersistedRaceRoom` projection stores every room field except the passage, which
collapses to `textId`; `findByCode` rehydrates the passage from the catalogue on load. The live
`RaceRoom` is unchanged, so in-memory progress validation and STOMP broadcasts are untouched.

**Impact:** Redis values no longer embed (or repeatedly rewrite) passage content; the catalogue
remains the single source of truth for text.

### CR-2.1 — Extract a shared typing viewport

**Before:** `TypingTest.tsx` and `Race.tsx` (`RaceTypingInput`) each inlined the same typing surface —
word/character layout, the caret effect, the line-tracking scroll animation, the idle-blink timer, and
the `TypedWord` loop — as two near-identical ~300-line copies that had already begun to drift.

**After:** a shared `TypingViewport` component owns the caret, scroll, and render loop through props
(`extraVariant`, `resetKey`, `measureKey`), and a `useTypingActivity` hook owns the idle-blink timer.
Each page keeps only its container, its Tab/Enter/Escape policy, and its engine wiring.

**Impact:** ~300 duplicated lines removed; caret/scroll fixes now apply to both views at once, with the
solo test and race keeping their distinct extra-character variants and keyboard behaviour.

### CR-2.2 — Remove dead imports from `TextService`

**Before:** `TextService` imported `org.apache.coyote.Response` and `java.awt.print.Pageable`, neither of
which was used; the latter was actively misleading because the class pages with Spring Data's
`PageRequest`.

**After:** both imports are removed; `PageRequest` is the only paging type referenced.

**Impact:** no behaviour change — the class no longer implies Tomcat/AWT dependencies it does not have.

### CR-2.3 — Collapse duplicated text-create paths

**Before:** `TextService.saveText` (admin) and `saveCustomText` (per-user) were identical apart from a
single `isCustom` flag and an admin guard, so every validation rule and builder field was maintained
twice and could drift.

**After:** a private `buildAndSaveText(dto, id, isCustom)` holds the single copy; `saveText` keeps its
admin guard and delegates with `false`, `saveCustomText` with `true`. Both retain their `@CacheEvict`.

**Impact:** ~35 duplicated lines removed; the two create paths can no longer diverge, with cache
eviction and behaviour unchanged.

### CR-2.4 — Preserve the cause when `logoutAll` fails

**Before:** `AuthService.logoutAll` caught every exception and rethrew a generic
`IllegalArgumentException` without the cause, so a Redis/JWT/DB failure surfaced as an opaque error with
no root condition in the stack trace.

**After:** the original exception is chained as the cause; the client-facing message is unchanged.

**Impact:** the real failure is preserved for logs and debugging; no API behaviour change.

### CR-2.5 — Inject the mapper and keep the cause in `RaceRoomRepository`

**Before:** the repository built a private `ObjectMapper` (duplicating the app's JSON config) and its
catch-alls rethrew a `RuntimeException` with only `getMessage()` pasted into the text, losing the real
cause.

**After:** the Spring-managed `ObjectMapper` is injected, and both `save`/`findByCode` failures chain
the original exception as the cause.

**Impact:** JSON configuration lives in one place and infrastructure failures keep their stack traces;
the happy path is unchanged.

### CR-3.3 — Uniform random text selection without the id-probe double query

**Before:** `getRandomTextByType` / `getRandomText` picked a random id in `[1, maxId]` and fetched the
first row with `textId >= randId`, retrying from `1` on a miss. Selection was weighted by id *gaps*
(not row count) and sometimes cost two queries.

**After:** sampling is delegated to the database with `ORDER BY random() LIMIT 1` — the same pattern the
catalogue already used for language+type. The four id-probe queries and the unused imports are gone.

**Impact:** uniform selection in a single query; ~25 lines of probing logic and four dead repository
methods removed.

### CR-3.4 — Project the result history instead of fetching whole entities

**Before:** the paginated history query fetched full `TypingResult` entities with `JOIN FETCH tr.user`,
materializing a `User` entity and every column per row just to read `userId`/`username`.

**After:** an interface projection (`TypingResultProjection`) selects only the result fields plus
`userId`/`username`; the DTO maps from it and the unused entity constructor is removed.

**Impact:** no `User` entity per row and a leaner SELECT; the page envelope (and JSON shape) is
unchanged, so the frontend contract is untouched.

### Build fix — `OAuth2SuccessHandlerTest` synced to the exchange-code handler

**Before:** CR-1.2 moved the handler from issuing JWTs to minting a short-lived exchange code, changing
its constructor to `(RedisTokenStore, UserRepository)`. The companion unit test still passed a
`JwtService`, so it compiled only under `src/main` and broke the image build's `maven.test-compile`
stage.

**After:** the test constructs the handler with its real collaborators and asserts
`redisTokenStore.storeOAuthCode(...)` plus the `/oauth2/callback?code=…` redirect.

**Impact:** the repository compiles end to end (`./mvnw clean test-compile`), so `dockerfile`'s
test-compile stage and `mvn package` succeed again.

### Build fix — `RaceRoomRepository` injects Boot 4's Jackson 3 mapper

**Before:** CR-2.5 injected `com.fasterxml.jackson.databind.ObjectMapper` (Jackson 2). Spring Boot 4
manages Jackson 3 (`tools.jackson.*`) and provides no Jackson 2 `ObjectMapper` bean, so the context
failed to start (`APPLICATION FAILED TO START`, replica crash-looping).

**After:** the repository injects `tools.jackson.databind.ObjectMapper` — Boot's managed mapper —
which already handles Java-time, so the durable record's `Instant` fields serialize unchanged.

**Impact:** the context starts and the Container App revision becomes healthy; race rooms use the
same container-managed mapper as the HTTP layer.

### Fix — Race countdown synced to the server clock

**Before:** the countdown anchored to a server-minted `countdownStartTime` but rendered against each
client's local `Date.now()`. Players' clocks disagree, so the timers desynced and the `GO!` moments
diverged; a client clock ahead of the server by more than the 3500 ms window jumped straight to
`GO!` (the `GO!, GO!, GO!` symptom). Step thresholds were also hardcoded to 3500 ms.

**After:** a STOMP `/app/time` → `/user/queue/time` echo lets each client estimate its clock offset
from a four-timestamp round trip (keeping the lowest-RTT sample); `Countdown` renders on the
server-corrected clock and derives its steps from `durationMs`.

**Impact:** the digits stay in step across players and `GO!` fires together, independent of device
clock skew; the step sequence scales with the countdown duration. Reverting is safe — the frontend
falls back to offset `0` without the endpoint.

### Fix — Race accuracy counts corrected mistakes (matches practice)

**Before:** practice scored accuracy from cumulative keystrokes (`totalIncorrect` never rolls back on a
fix), but race compared the final typed string to the passage positionally — so a mistake that was
backspaced and retyped correctly vanished, leaving accuracy at 100%. Accuracy only dropped when a
mistake was left in place (typically the last word).

**After:** the race path forwards the engine's cumulative `totalIncorrect` / `totalCorrect`; the server
stores the client counts (`ProgressUpdateDTO.errors`, `RaceService.updateProgress`) instead of
recomputing them from `typedContent`, which is removed along with `calculateErrors`.

**Impact:** a corrected mistake still lowers race accuracy, matching practice mode, and live/final
race figures agree. Reverting restores the positional (final-string) calculation.

### Fix — Stale streak derived on read

**Before:** `users.streak` was written only when a result or race finished, and every profile/auth/stat
read returned it raw. After a missed day the dashboard kept showing the old value (e.g. `10 Day
Streak`) until the user played again, because the write model intentionally leaves the stored streak
untouched until the next activity resets it.

**After:** `StreakService.currentStreak(User | StreakState)` derives the visible value from
`lastPlayedDate` in the user's timezone: `0` when the last play is older than yesterday, otherwise
`max(stored, 1)` (today, yesterday, or a future date after a backwards timezone move). `/auth/me`,
auth responses, the user list, and user-stat reads now carry this value; the stored columns and write
path are unchanged.

**Impact:** a broken streak reads as `0` on the next fetch without any extra query or write, and
consecutive-day increment/reset behaviour is untouched. No schema or response-shape change.

## Limitations

- Guest results live in localStorage only. Clearing site data removes them permanently.
- Live race rooms and matchmaking now share Redis state, and STOMP events bridge across replicas, so the application no longer requires a single instance. The Container Apps template still pins `maxReplicas: 1` (and `minReplicas: 1` to avoid cold starts); raising it is an explicit scaling decision that assumes shared Redis/PostgreSQL and the same `JWT_SECRET`. See the [distributed race operations runbook](docs/runbooks/distributed-race-operations.md).
- Mobile works for typing but keyboard shortcuts (Tab, Enter) require a physical keyboard.
- Word lists and phrase content are seeded at deploy time and cannot be edited through the UI.
- No offline support. Both frontend and backend must be reachable for authenticated sessions.
- Token refresh is attempted once on 401. A second consecutive failure is not retried.

## License

MIT
