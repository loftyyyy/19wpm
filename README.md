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
| `/compete` | Matchmaking lobby |
| `/leaderboard` | Leaderboard |
| `/about` | About |
| `/race` | Matchmaking lobby |

## Tech Stack

| Frontend | Backend |
|---|---|
| React 19 | Spring Boot 4.0.2 (Java 17) |
| TypeScript | PostgreSQL + Flyway |
| Tailwind CSS v4 | Redis (token blacklist) |
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

## Code Review Remediation

Follow-up fixes from a full-codebase review (security, correctness, and cleanliness). Each is an
isolated commit so it can be reverted on its own. Per-change write-ups live in
[`docs/refactors/`](docs/refactors/).

| # | Change | Architecture pattern | Details |
|---|---|---|---|
| CR-1.2 | OAuth tokens no longer travel in the redirect query string | Out-of-band handoff via a short-lived, single-use exchange code | [`docs/refactors/12-oauth-token-query-string.md`](docs/refactors/12-oauth-token-query-string.md) |
| CR-1.3 | Refresh-token rotation is atomic (single-use via GETDEL) | Atomic check-and-consume (single-use token) | [`docs/refactors/13-refresh-token-atomic-rotation.md`](docs/refactors/13-refresh-token-atomic-rotation.md) |

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

## Limitations

- Guest results live in localStorage only. Clearing site data removes them permanently.
- Mobile works for typing but keyboard shortcuts (Tab, Enter) require a physical keyboard.
- Word lists and phrase content are seeded at deploy time and cannot be edited through the UI.
- No offline support. Both frontend and backend must be reachable for authenticated sessions.
- Token refresh is attempted once on 401. A second consecutive failure is not retried.

## License

MIT
