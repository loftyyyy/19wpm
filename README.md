# 19wpm

Typing test app with solo practice modes and real-time multiplayer races. Guest sessions use localStorage; authenticated users sync results to the backend.

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

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DB_URL` | PostgreSQL JDBC URL |
| `DB_USERNAME` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | HMAC key for access/refresh tokens |
| `GITHUB_CLIENT_ID` | GitHub OAuth2 client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth2 client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |

### Frontend (`frontend/.env.production`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API URL (production builds) |

## Limitations

- Guest results live in localStorage only. Clearing site data removes them permanently.
- Mobile works for typing but keyboard shortcuts (Tab, Enter) require a physical keyboard.
- Word lists and phrase content are seeded at deploy time and cannot be edited through the UI.
- No offline support. Both frontend and backend must be reachable for authenticated sessions.
- Token refresh is attempted once on 401. A second consecutive failure is not retried.

## License

MIT
