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

## Limitations

- Guest results live in localStorage only. Clearing site data removes them permanently.
- Mobile works for typing but keyboard shortcuts (Tab, Enter) require a physical keyboard.
- Word lists and phrase content are seeded at deploy time and cannot be edited through the UI.
- No offline support. Both frontend and backend must be reachable for authenticated sessions.
- Token refresh is attempted once on 401. A second consecutive failure is not retried.

## License

MIT
