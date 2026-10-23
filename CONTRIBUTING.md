# Contributing to 19wpm

19wpm is a typing-test app: solo practice modes plus real-time multiplayer races. Stack: React 19 +
TypeScript + Tailwind v4 + Vite on the frontend, Spring Boot 4.0.2 (Java 17 language level) +
PostgreSQL/Flyway + Redis + STOMP/SockJS on the backend.

This document is the project-specific rulebook. It is intentionally stricter than "open a PR and
hope" — the history is organised for reviewability and independent rollback, and contributions are
expected to follow the same shape.

## Ground rules

1. **One logical change per commit.** Every commit must be independently revertible.
2. **Document every behaviour/architecture change** in `docs/refactors/` and in `README.md` (see
   [Documentation requirement](#documentation-requirement)).
3. **Never commit secrets.** `.env` and local property files are git-ignored for a reason.
4. **Keep practice and race semantics identical.** They are two surfaces over the same typing engine;
   divergence is treated as a bug.
5. **Update tests in the same commit** whenever you change a constructor or collaborator signature.
6. **Don't mix formatting churn with behaviour changes.** No drive-by reformatting.

## Prerequisites

| Tool | Version |
|---|---|
| Java | 17+ (Maven targets 17; the container image builds/runs on 21) |
| Node.js | 20 |
| PostgreSQL | 14+ |
| Redis | 6+ |
| Docker | Only for the backend test suite (Testcontainers) |

## Local setup

### Backend

`backend/.env` is loaded by `Dotenv` in `BackendApplication` and copied into system properties. Create
it locally (never commit it) with the keys the committed `application-prod.properties` expects:

```dotenv
SPRING_PROFILES_ACTIVE=dev
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/typing_db
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=
JWT_SECRET=<at least 32 random bytes, base64 or hex>
FRONTEND_URL=http://localhost:5173
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:8080/login/oauth2/code/github
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8080/login/oauth2/code/google
```

**Important:** the base `backend/src/main/resources/application.properties` is **git-ignored**, so a
fresh clone does not contain it. Create it locally with the datasource/Redis/JWT placeholders (use the
committed `application-prod.properties` as the template), set `app.frontend-url=http://localhost:5173`,
and leave `spring.jpa.open-in-view=false`. Do not commit it.

```sh
cd backend
./mvnw spring-boot:run          # macOS/Linux/Git Bash
.\mvnw.cmd spring-boot:run      # PowerShell
```

Flyway migrates on startup; word lists and preset texts are seeded by the migrations. The `dev`
profile only turns SQL logging on (`application-dev.properties`).

### Frontend

```sh
cd frontend
npm install
```

Create `frontend/.env.local` (ignored) with:

```dotenv
VITE_API_BASE_URL=http://localhost:8080
```

Then `npm run dev` (port 5173, proxies `/api` to `:8080`). Do **not** modify the committed
`frontend/.env.production` for local work — it points at the deployed Azure backend.

## Repository layout

```
backend/
  src/main/java/com/rho/backend/
    controller/   HTTP + STOMP endpoints
    service/      business logic and transactions
    repository/   Spring Data repositories
    dto/          request/response records (grouped by feature)
    model/        JPA entities
    config/       security, CORS, Redis, cache, OAuth2 wiring
    exception/    typed exceptions + global handler
    filter/       JWT filter
    handler/      OAuth2 success handler
    multiplayer/  matchmaking
    race/         room store seam and live-room types
    redis/        token store / Redis-backed state
    scheduler/    background jobs
    enums/
  src/main/resources/db/migration/   Flyway V1..Vn
  src/test/java/com/rho/backend/     package-mirrored tests
frontend/src/
  Pages/        route-level containers
  Components/   shared presentation (incl. Race/)
  hooks/        useTypingEngine, useRaceSocket, ...
  services/     HTTP clients (api.ts, ...)
  context/      auth/session state
  types/        shared TypeScript types
  utils/
docs/refactors/ numbered per-change write-ups
```

## Coding conventions

### Backend

- **Java 17 features, Boot 4 conventions.** Records for DTOs, constructor injection only, no field
  injection or `new`-ing collaborators that the container should own.
- **Jackson 3 only.** Inject `tools.jackson.databind.ObjectMapper`. `com.fasterxml.jackson.databind.ObjectMapper`
  (Jackson 2) has **no bean** and previously crash-looped production — do not reintroduce it.
- **Transactions and OSIV.** `spring.jpa.open-in-view=false`. Do not dereference lazy associations
  outside a transaction; use `@Transactional(readOnly = true)` for read paths that touch them.
- **Exceptions.** Client errors get explicit `exception → HTTP status` mappings in the global handler.
  Never swallow a cause: chain the original exception (`new RuntimeException("...", cause)`).
- **Caching.** If a write path changes data served by a `@Cacheable` read, add the matching
  `@CacheEvict`. Don't cache random-selection paths.
- **Security.** The filter chain is deny-by-default. To expose a public endpoint, add it to the
  **explicit `permitAll` allowlist** in `SecurityFilterChainConfig` — never widen a whole subtree such
  as `/api/v1/texts/**`. User-scoped handlers also carry `@PreAuthorize`.
- **STOMP.** Authentication is enforced on `CONNECT` only; the `Principal` is the user id as a string.
  Every room action must still validate ownership/participation server-side.
- **Query design.** Paginate unbounded reads, project only the columns you need, and add an index for
  each new predicate; push random sampling and atomic counters into the database.
- **Comments.** Keep them sparse; explain non-obvious intent (why), not mechanics (what). Match the
  surrounding file's style.

### Frontend

- **React 19 function components and hooks.** No class components. Keep state in the existing hooks
  (`useTypingEngine`, `useRaceSocket`) rather than duplicating logic in pages.
- **HTTP goes through `services/` or the existing API modules.** Don't scatter `fetch` calls in
  components.
- **Share, don't copy, the typing surface.** `TypingViewport` is the single presentational component
  for both solo and race; add props/variants instead of forking it.
- **Hot-path rendering.** Memoize leaf components and keep prop identities stable (the `TypedWord`
  comparator relies on this).
- **Real-time only through `useRaceSocket`.** Don't open ad-hoc STOMP clients.
- **Tailwind v4 utilities.** No new CSS frameworks or component libraries without discussion.
- **Type safety.** `tsc -b` must pass; avoid `any` and non-null assertions unless justified.

## Domain invariants (do not regress)

- **Accuracy is cumulative.** `accuracy = totalCorrect / (totalCorrect + totalIncorrect)`; a mistake
  that is corrected still counts. Practice and race must use the same definition — never recompute
  accuracy from the final typed string positionally.
- **Race timing uses the server clock.** Countdowns render against `serverOffsetMs` from
  `useRaceSocket`; do not render against raw `Date.now()`.
- **Text is stored once.** `texts` owns passage content; durable race rooms persist `textId` and
  rehydrate on load.
- **Live race state is shared, not process-local.** Rooms live in Redis under `race:room:{code}` and
  must be mutated through `RaceRoomRepository` under the room lock; never hold mutable room state in
  a replica-local field. Broadcast through `RaceEventBus` so other replicas receive the event.
- **The server owns final results.** Clients submit progress/counts; the server computes `serverWpm`,
  applies anti-cheat, and broadcasts. `finalWpm` is stored for audit only and must not drive ranking,
  accuracy, or streaks.

## Database changes

- Flyway only; files live in `backend/src/main/resources/db/migration/`.
- Name new files `V<n>__snake_case_description.sql`, where `<n>` is the highest existing number **+1**.
  Never reuse or skip numbers.
- **Never edit a migration that has been applied.** Add a new one.
- `spring.jpa.hibernate.ddl-auto=validate`: a new field/table requires the matching migration.
- Seed data belongs in migrations, not in application code.

## Commit messages

Format:

```
<type>(<scope>): <imperative summary>
```

- Types used here: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`.
- Summary is lowercase, imperative, and has no trailing period.
- Keep the subject under ~72 characters; put the reasoning in the body.

Examples from the history:

```
fix: sync race countdown to server clock via STOMP time offset
fix: count corrected mistakes in race accuracy to match practice mode
perf(result): paginate typing-result history in the database
refactor: CR-1.3 - Make refresh-token rotation atomic
fix: CR-2.5 follow-up - Inject Boot 4's Jackson 3 mapper in RaceRoomRepository
```

**Code-review items** use the review's ID: `refactor: CR-<area>.<n> - <summary>`. Follow-up fixes to a
review item use `fix: CR-<area>.<n> follow-up - <summary>`. One review item per commit.

## Documentation requirement

Every behaviour or architecture change ships with documentation in the **same commit**:

1. **Write-up:** `docs/refactors/<NN>-<kebab-title>.md`, numbered sequentially from the highest
   existing file (next free number is **50**). Never reuse or skip.
2. **README table row:** add to the matching table —
   - performance work → `## Backend Performance Refactors`
   - review/fix work → `## Code Review Remediation`
3. **README subsection:** a matching `###` entry using the project's **Before / After / Impact**
   structure.

Use `docs/refactors/29-server-clock-offset-sync.md` and `30-race-accuracy-keystroke.md` as templates.
A useful write-up states area/pattern/status, the issue, the solution, the impact, files changed,
verification, and rollback.

Docs-only changes still get their own `docs:` commit.

## Testing and verification

### Backend

- Unit tests: JUnit 5 (`service/`, `handler/`).
- Integration tests: Spring Boot Test + Testcontainers Postgres (`auth/`, `text/`, `streak/`),
  exercising Flyway and real HTTP.
- The full suite needs **Docker**; Redis-backed paths need **Redis** too.
- If Docker/Redis are unavailable, the mandatory minimum is:

  ```sh
  cd backend
  ./mvnw clean test-compile -DskipTests
  ```

  This mirrors the image build's compile stage and must stay green.
- Use Testcontainers (not H2) when the behaviour depends on PostgreSQL — random sampling, atomic
  updates, streak SQL. `application-test.properties` (H2) is only for lightweight context tests.
- A signature change is not complete until every test using it is updated: a previous image build
  broke on a stale unit test, and a previous production crash-loop came from injecting the Jackson 2
  `ObjectMapper` instead of Boot 4's Jackson 3 mapper.

### Frontend

```sh
cd frontend
npx tsc -b
npm run lint
npm run build
```

There is no frontend test runner configured. Don't add one as a drive-by; raise it first.

### Pre-push checklist

- [ ] `./mvnw clean test-compile -DskipTests` passes (run the full suite if Docker/Redis are available)
- [ ] `npx tsc -b`, `npm run lint`, `npm run build` pass
- [ ] `git diff --cached` contains no secrets, `.env`, local `application.properties`, `target/`, `dist/`
- [ ] Migration added if the schema changed (`V<n+1>`)
- [ ] `docs/refactors/NN-*.md` + README table row + subsection added
- [ ] The commit is a single, independently revertible change
- [ ] UI changes include a screenshot in the PR

## Pull requests

- External contributors: fork, create a short-lived branch, and open a PR against `main`. The
  maintainer commits to `main` directly; keep that history linear and atomic.
- PR description must cover: what and why, linked issue, the `docs/refactors/` link, the verification
  commands and their results, screenshots for UI changes, and any migration/deployment notes.
- Rebase on `main`; don't force-push branches others may have checked out.
- Reviewers look for: correct HTTP statuses, security allowlist changes, Jackson 3 usage, transaction
  boundaries, practice/race consistency, and revertibility.
- Do not include unrelated cleanup. Open a separate PR/commit for it.

## Security

- Never commit `.env`, credentials, local `application.properties`, or `application-dev.properties`
  changes containing secrets. `.gitignore` already excludes them; don't add exceptions.
- Tokens must never travel in URLs — use the short-lived OAuth exchange-code flow.
- Report vulnerabilities privately via **GitHub Security Advisories**, not a public issue.

## Deployment (maintainers)

- **Frontend:** pushing `main` auto-deploys on Vercel (~30 s).
- **Backend:** build remotely and roll the Container App (no local Docker daemon required):

  ```sh
  cd backend
  az acr build -r 19wpmregistry -t 19wpm-backend:v<N> -f dockerfile .
  az containerapp update -n app-19wpm-backend -g 19wpm-rg \
    --image 19wpmregistry.azurecr.io/19wpm-backend:v<N>
  ```

  Increment `v<N>` for every deploy. Note: `az acr build` uploads the working tree, so required local
  config (including the git-ignored base `application.properties`) must be present.
- **Verify after rollout:** the replica reports `ready: true`, `started: true`, `restartCount: 0`, and
  `GET /api/v1/texts/random` plus `/api/v1/texts/preset-texts` return 200.
- **Replicas are opt-in.** The template still runs one replica. Phase 9 makes race rooms and
  matchmaking multi-replica-safe, but scaling requires shared Redis/PostgreSQL, the same `JWT_SECRET`,
  Flyway `V12`, and a WebSocket-capable ingress. Follow the
  [distributed race operations runbook](docs/runbooks/distributed-race-operations.md) before raising
  `maxReplicas` above 1; rolling back to a pre-Phase-9 image requires scaling back to one replica.

## License

19wpm is MIT-licensed. By contributing, you agree your changes are released under the same license.
