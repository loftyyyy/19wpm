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
| 2.1 | JWT parsed once; redundant auth DB/Redis work removed | Single-pass token validation (parse-once, reuse claims) | [`docs/refactors/02-jwt-single-parse.md`](docs/refactors/02-jwt-single-parse.md) |
| 3.1 | SQL logging off; Open-Session-In-View disabled; bounded HikariCP pool | Transaction-scoped persistence context + environment-specific config via profiles | [`docs/refactors/03-jpa-osiv-sql-logging.md`](docs/refactors/03-jpa-osiv-sql-logging.md) |

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

## Limitations

- Guest results live in localStorage only. Clearing site data removes them permanently.
- Mobile works for typing but keyboard shortcuts (Tab, Enter) require a physical keyboard.
- Word lists and phrase content are seeded at deploy time and cannot be edited through the UI.
- No offline support. Both frontend and backend must be reachable for authenticated sessions.
- Token refresh is attempted once on 401. A second consecutive failure is not retried.

## License

MIT
