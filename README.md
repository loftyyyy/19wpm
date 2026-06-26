# 19wpm

A minimalist typing test web application. Tests are single-player only: choose a mode, type the presented text, and receive a WPM/accuracy score with per-character replay. Sessions are stateless for guests and persistent for authenticated users.

## Features

- Three test modes: words (N-word random sample from a difficulty-graded word list), phrases (full sentences from a curated text corpus), time (timed duration with a continuous word feed)
- Four difficulty tiers for words mode: Easy, Medium, Hard, Expert
- WPM burst chart showing speed across each second of the test
- Per-key replay with error highlighting and backspace tracking
- Mistake-word review showing expected vs. typed text
- Guest play with localStorage persistence; results migrate to the backend on signup or login
- OAuth2 authentication via GitHub and Google
- Dashboard with result history, WPM progression chart, and per-user stats
- Light and dark themes

## Tech Stack

| Frontend | Backend |
|---|---|
| React | Spring Boot |
| TypeScript | PostgreSQL |
| Tailwind CSS (v4) | Flyway (schema migrations) |
| Vite | Redis (token blacklisting) |
| Recharts | Bucket4j (rate limiting) |

## Getting Started

### Prerequisites

- Java 17
- Node.js 20
- PostgreSQL 14+
- Redis 6+
- Maven (wrapped via `mvnw`)

### Backend

```sh
cd backend
cp .env.example .env       # fill in secrets
./mvnw spring-boot:run
```

The API starts on `http://localhost:8080`. Flyway runs migrations on startup and the application seeds initial word lists and preset texts via `spring.sql.init.mode=always`.

### Frontend

```sh
cd frontend
npm install
npm run dev
```

The dev server starts on `http://localhost:5173`. Vite proxies `/api` requests to `http://localhost:8080`.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DB_URL` | JDBC URL for PostgreSQL |
| `DB_USERNAME` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | HMAC key for signing access and refresh tokens |
| `GITHUB_CLIENT_ID` | OAuth2 client ID for GitHub login |
| `GITHUB_CLIENT_SECRET` | OAuth2 client secret for GitHub login |
| `GOOGLE_CLIENT_ID` | OAuth2 client ID for Google login |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret for Google login |

### Frontend (`frontend/.env.production`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API for production builds |

## Scope and Limitations

- Compete and Leaderboard features exist as placeholders but are not implemented. There is no real-time multiplayer.
- Guest results are stored in localStorage only and are not synced across devices or browsers. Clearing site data will permanently remove them.
- The mobile experience is functional but the keyboard-based shortcuts (Tab to focus restart, Enter to confirm) depend on a physical keyboard.
- Word lists and phrase content are seeded at deploy time and cannot be modified or extended through the UI.
- The application has no offline support. Both the frontend and backend must be reachable for authenticated sessions.
- Token refresh is attempted once on a 401 response; concurrent refresh requests are coalesced but a second simultaneous failure is not retried.

## License

MIT
