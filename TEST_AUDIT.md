# Backend Test Audit

**Date:** 2026-10-20  
**Scope:** `backend` Maven test suite, with a brief check of frontend/load-test coverage and CI readiness  
**Status:** Suite is not green — 59 tests run, 56 passed, 3 failed (0 errors, 0 skipped)

---

## Executive Summary

- The backend has **7 test files** and **59 tests**.
- Coverage is concentrated in **authentication, text CRUD, streak logic, and OAuth2 helpers**.
- Two of the three failures are **test-isolation defects**: they pass when run alone and fail when the class runs as a suite.
- The third failure is an **outdated security expectation**: the test expects `401`, but the endpoint is intentionally public and returns `200`.
- The backend can run in CI, but requires a **JWT secret**, **Docker** for Testcontainers, and preferably a **Redis-free test profile** (Redis paths are currently untested).
- No CI workflow was found at the repository root. The frontend has **no configured test runner**; it has one Puppeteer route-smoke script that is not wired into `package.json`.
- No source files were modified as part of this audit.

---

## Test Stack

| Layer | Technology | Notes |
|---|---|---|
| Unit | JUnit 5 + Mockito | Service and OAuth2 helper tests |
| Spring context | `@SpringBootTest` | Single application-context smoke test |
| Web integration | `@SpringBootTest(webEnvironment = MOCK)` + `MockMvc` + `springSecurity()` | Auth and text endpoints |
| Database integration | Testcontainers PostgreSQL 16-alpine | Streak persistence behavior |
| Test database override | H2 in MySQL mode | `application-test.properties`, `ddl-auto=create-drop`, Flyway disabled |
| Frontend route smoke | Puppeteer Core | `frontend/scripts/smoke.mjs`; not wired into npm scripts |
| Load/performance | k6 | Scripts under `k6/`; manual, requires a running backend |

Test resources:

- `backend/src/main/resources/application-test.properties` uses H2, disables Flyway, and disables rate limiting.
- `StreakPostgresIntegrationTest` overrides the datasource with Testcontainers.
- No test starts or configures Redis explicitly.

---

## Test Inventory

| Test class | Tests | Type | Coverage | Baseline result |
|---|---:|---|---|---|
| `AuthIntegrationTest` | 7 | MockMvc integration | Signup/login/auth flows | Pass |
| `BackendApplicationTests` | 1 | Context smoke | Spring context loads | Pass |
| `OAuth2TimezoneRequestResolverTest` | 4 | Unit | OAuth2 timezone resolution | Pass |
| `OAuth2SuccessHandlerTest` | 5 | Unit | OAuth2 success handling | Pass |
| `StreakServiceTest` | 21 | Unit (Mockito) | Streak calculation and transitions | Pass |
| `StreakPostgresIntegrationTest` | 7 | Testcontainers integration | Streak persistence with PostgreSQL | Pass |
| `TextIntegrationTest` | 14 | MockMvc integration | Text read/create/modify paths | **3 failed** |

**Total:** 59 tests; 56 passed, 3 failed.

---

## Baseline Run

A full non-clean run was used because `mvnw clean test` was blocked locally by a locked `backend/target/app.jar`.

PowerShell command shape (the secret is supplied only to the Maven process and is not committed):

```powershell
$env:JWT_SECRET = "<base64-encoded throwaway test secret>"
.\mvnw.cmd test
```

Observed result:

```text
Tests run: 59, Failures: 3, Errors: 0, Skipped: 0
BUILD FAILURE
```

The run required:

- Java/Maven via `mvnw.cmd`
- Docker/Testcontainers for `StreakPostgresIntegrationTest`
- `JWT_SECRET`; the application does not auto-load `backend/.env`

---

## Failure Analysis

### 1. `TextIntegrationTest.testGetUserTexts` — stale authentication cache

**Symptom**

```text
Status expected:<200> but was:<404>
```

**Evidence**

- The test passes when run alone:

```powershell
.\mvnw.cmd "-Dtest=TextIntegrationTest`$GetUserTextsTest#testGetUserTexts" test
# Tests run: 1, Failures: 0, Errors: 0
```

- It fails when the full `TextIntegrationTest` class runs.

**Cause**

- `TextIntegrationTest` is `@Transactional`; database changes are rolled back after each test (`TextIntegrationTest.java:40`, `:69-82`).
- `UserDetailsCache` is a process-level Caffeine cache with a 60-second TTL, max 10k entries (`UserDetailsCache.java:28-35`).
- The cache key is the user's email, and the cached `UserDetails` contains the old database user ID.
- `JwtAuthenticationFilter` resolves the user through the cache by email (`JwtAuthenticationFilter.java:83`).
- `TextService` then looks up the stale user ID and throws `ResourceNotFoundException("User not found")` (`TextService.java:37`, `:172-173`).
- `GlobalExceptionHandler` maps that exception to HTTP 404 (`GlobalExceptionHandler.java:43-46`).

Because the tests reuse `james@gmail.com`, a cached user from an earlier test remains valid after rollback and points at a row that no longer exists.

**Recommendation**

- Clear the user-details cache before/after each integration test, or make test emails unique per test.
- A cache invalidation method does not currently exist on `UserDetailsCache`; adding a test-support hook is the cleanest fix.
- Add a regression test that creates a user, rolls back, recreates the same email, and verifies the current database row is used.

---

### 2. `TextIntegrationTest.testCreateTextAsAdmin` — same cache contamination

**Symptom**

```text
Status expected:<201> but was:<404>
```

**Evidence**

- The test passes when run alone:

```powershell
.\mvnw.cmd "-Dtest=TextIntegrationTest`$CreateTextTest#testCreateTextAsAdmin" test
# Tests run: 1, Failures: 0, Errors: 0
```

- It fails in the full class.

**Cause**

`loginUserAdmin()` creates a user with `admin1@gmail.com` directly through the repository (`TextIntegrationTest.java:100-112`). Several tests call this helper. The JWT filter then resolves `admin1@gmail.com` through the same 60-second cache, which can still hold the rolled-back user's old ID. `TextService.saveText()` fails to find that ID and returns 404.

This is the same cache/test-transaction isolation defect as failure 1, triggered by another reused email.

---

### 3. `TextIntegrationTest.testGetPresetTextsWithoutToken` — test expectation is wrong

**Symptom**

```text
Status expected:<401> but was:<200>
```

**Evidence**

- This fails even when run alone:

```powershell
.\mvnw.cmd "-Dtest=TextIntegrationTest`$GetPresetTextsTest#testGetPresetTextsWithoutToken" test
# Tests run: 1, Failures: 1
# Status expected:<401> but was:<200>
```

- `SecurityFilterChainConfig` explicitly permits `/api/v1/texts/preset-texts` without authentication (`SecurityFilterChainConfig.java:53-69`).
- The endpoint returning 200 is consistent with the current security policy.

**Recommendation**

Decide which behavior is intended:

- If preset texts are intentionally public, update the test to expect `200`.
- If authentication is required, change the security rule and update the test accordingly.

Given the current permit-all allowlist and the root README's description of public read-only content paths, the test appears outdated.

---

### Surefire report inconsistency

`TextIntegrationTest` uses `@Nested` test classes. Surefire reports the parent suite as:

```text
Tests run: 0, Failures: 0, Errors: 0
```

while the XML still contains 14 testcase entries and the failures. The authoritative details are the testcase entries in:

- `backend/target/surefire-reports/TEST-com.rho.backend.text.TextIntegrationTest.xml`

This is a reporting/tooling issue, not a test result by itself, but it makes CI summaries confusing. Prefer Surefire XML, not the `.txt` summary, when evaluating nested tests.

---

## Coverage Map

### Controllers

| Component | Coverage | Notes |
|---|---|---|
| `AuthController` | Partial | 7 integration tests; refresh/logout/rate-limit/blocklist paths not clearly covered |
| `TextController` | Partial | Read/create/modify paths; 3 failing tests; no dedicated security-contract test |
| `TypingResultController` | None | No result create/read tests |
| `UserController` | None | No admin/user-management tests |
| `UserStatController` | None | No stats tests |
| `RaceRestController` | None | No room create/join tests |
| `RaceStompController` | None | No STOMP/WebSocket tests |
| `TimeSyncController` | None | No STOMP `/time` tests |
| `WordController` | None | No word CRUD/random-word tests |
| `RoleController` | None | Empty controller; no endpoints |

### Services and infrastructure

| Area | Coverage | Notes |
|---|---|---|
| Streak calculation/persistence | Good | Unit + PostgreSQL integration coverage |
| Text CRUD | Partial | Integration tests, currently not green |
| Auth/token filtering | Partial | Login/signup covered; broader token lifecycle not covered |
| OAuth2 helpers | Partial | Timezone resolver and success handler unit-tested |
| JWT refresh/rotation/logout | None | No tests for refresh-token behavior, rotation, or revocation |
| Redis token blocklist/race state | None | No Redis-backed tests |
| `UserDetailsCache` | None | No TTL, invalidation, or stale-entry tests |
| Security filter chain | None | No tests for public/protected route matrix |
| Rate limiting | None | Disabled in test profile; no behavioral tests |
| Error handling | None | No direct tests for `GlobalExceptionHandler` mappings |
| Scheduling/background tasks | None | No tests for scheduled cleanup or race-state tasks |
| Repository queries | Partial | Covered indirectly by integration tests; no `@DataJpaTest` slice tests |

### Other test layers

- No `@WebMvcTest` controller slice tests.
- No dedicated `@DataJpaTest` repository tests.
- No WebSocket/STOMP integration or multi-client race tests.
- No frontend unit/component tests.
- No full browser E2E suite; only the manual route-smoke script.
- k6 scripts cover smoke, auth, read-heavy, write-heavy, mixed, and WebSocket load scenarios, but require a running environment and are not part of the Maven test suite.

---

## CI Readiness

### What can run in CI

The backend test suite is CI-capable if the pipeline provides:

1. JDK 17+ and the Maven wrapper.
2. A valid Base64 `JWT_SECRET` environment variable.
3. Docker available to the CI runner for Testcontainers.
4. Network/cache access for Maven dependencies and the `postgres:16-alpine` image.

The H2-backed tests do not need an external database. Redis-backed paths are not exercised by the current tests, so Redis is not a passing-suite prerequisite today, but that also means those paths are untested.

### Current gaps

- **No CI workflow found.** No `.github` workflow directory or root `Jenkinsfile`, `.gitlab-ci.yml`, `azure-pipelines.yml`, or `bitbucket-pipelines.yml` was found.
- The test suite is currently **red**, so a CI gate would fail until the text tests are fixed.
- `JWT_SECRET` is mandatory for the current tests; there is no committed test-only default and no automatic `.env` loading.
- MockMvc tests use `.andDo(print())`, which can print generated JWTs into CI logs. Consider removing/guarding print output.
- Frontend `package.json` has `dev`, `build`, `lint`, and `preview` scripts, but **no test script** and no Vitest/Jest/Testing Library setup.
- `frontend/scripts/smoke.mjs` is a useful manual Puppeteer check, but it expects a built frontend at `http://localhost:4173` and a local Chrome executable; it is not wired into npm or CI.
- k6 load tests are manual and environment-dependent.

### CI recommendation

Minimum viable backend CI job:

```yaml
# Illustrative shape; no workflow currently exists in the repository.
- run: ./mvnw test
  env:
    JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
```

Add Docker availability for Testcontainers and publish `backend/target/surefire-reports` as an artifact. Do not run `clean` if a local process holds `target/app.jar`; CI runners normally will not have that lock.

---

## Missing Coverage — Prioritized

### P0 — Fix the current red suite

1. Isolate `UserDetailsCache` between integration tests or use unique emails.
2. Align `testGetPresetTextsWithoutToken` with the intended security policy.
3. Make Surefire nested-class reporting understandable or add an explicit test-result check that reads XML.

### P1 — High-value untested backend behavior

1. JWT refresh, rotation, expiry, logout, and Redis blocklist behavior.
2. Rate limiting (currently disabled in tests).
3. `UserController`, `WordController`, `TypingResultController`, and `UserStatController` happy paths plus authorization failures.
4. Race room lifecycle and Redis-backed state transitions.
5. STOMP/WebSocket connect, join, progress, finish, and disconnect flows with multiple clients.
6. Security filter-chain contract tests: public vs authenticated vs admin routes.

### P2 — Test infrastructure and broader coverage

1. `@WebMvcTest` slices for controller validation/status mapping.
2. `@DataJpaTest` for custom repository queries.
3. Direct tests for `GlobalExceptionHandler`, cache invalidation, and scheduler behavior.
4. Frontend unit/component tests (introduce Vitest + Testing Library).
5. Browser E2E coverage for login, solo test, results, and race flow.
6. CI pipeline with backend tests, frontend lint/build/smoke, and optional k6 smoke.

---

## Reproduction Notes

- Full backend run: `.\mvnw.cmd test` from `backend`, with `JWT_SECRET` set in the process environment.
- Single nested test: use the nested class name, for example:

```powershell
.\mvnw.cmd "-Dtest=TextIntegrationTest`$GetUserTextsTest#testGetUserTexts" test
```

- `mvnw clean test` was blocked locally by a locked `target/app.jar`; non-clean runs work.
- `-Dsurefire.reportsDirectory=...` did not redirect reports in this setup; reports remained in `target/surefire-reports`.
- The full-run counts above were captured before the single-test reruns; those reruns overwrite the text test report.

---

## Audit Limitations

- No source code was changed and no commit was created.
- The full suite was run once at baseline; individual text tests were then rerun to isolate the failures.
- Frontend coverage was assessed from configuration and file inventory, not by executing a frontend test suite (none is configured).
- Root `README.md` was checked for test/CI mentions but was not exhaustively audited.

---

## Phase 5 update (2026-10-22)

- Backend compile is green: `.\mvnw.cmd -q -DskipTests compile`.
- Redis now uses a pooled Lettuce client with bounded command/connect timeouts; Hikari fail-fast
  timeouts were added. These changes are not covered by the existing 59 tests.
- The deployment template pins `minReplicas: 1` and `maxReplicas: 1`; the race-room multi-replica
  P0 gaps above are unchanged. A dummy render parsed successfully and contained no unresolved
  placeholders; it was not applied to Azure.
- All six k6 scripts pass `k6 inspect`. The suite was not rerun because local PostgreSQL, Redis, and
  the backend were not running.
- `BackendApplicationTests` passed as a targeted context-load smoke test with
  `SPRING_PROFILES_ACTIVE=test` and dummy JWT/OAuth environment values. This constructs the pooled
  Redis client but does not open a Redis connection.
- The full backend test suite was not rerun for this update. The 56/59 baseline and the three known
  failures remain current until a full suite run is performed.

---

## Phase 6 update (2026-10-23)

Phase 6 added CI performance gates, backend Actuator/OpenTelemetry instrumentation, and frontend
Core Web Vitals RUM with a public Micrometer-backed ingestion endpoint. This update records the
verification performed for those changes; it does not replace a full backend-suite run.

### Verification performed

| Check | Result |
|---|---|
| Backend compile (`.\mvnw.cmd -q -DskipTests compile`) | Pass |
| `WebVitalsServiceTest` | 5/5 pass |
| `TelemetryContextTest` | 3/3 pass |
| `npm run build` | Pass (868 modules transformed) |
| `npm run perf:bundle` | Pass (all four gzip budgets) |
| Repository-wide `npm run lint` | Fails: 12 errors, 8 warnings |

`TelemetryContextTest` now verifies the public telemetry contract in addition to observation
registration:

- `POST /api/v1/telemetry/web-vitals` without authentication returns `202`.
- An unsupported metric name returns `400`.

The backend still logs a `RedisConnectionFailureException` from the matchmaking scheduler when Redis
is absent. The targeted tests pass because the scheduler failure is logged asynchronously; this is an
environment limitation, not a telemetry test failure.

The Phase 6 frontend bundle remains within budget:

```text
PASS Total JavaScript (gzip): 266.2 KiB / 312.5 KiB
PASS Initial JS + CSS (gzip): 87.4 KiB / 117.2 KiB
PASS Largest JavaScript chunk (gzip): 109.6 KiB / 136.7 KiB
PASS Total CSS (gzip): 6.4 KiB / 23.4 KiB
```

The repository-wide lint failures are pre-existing and outside the Phase 6 changed-file set. They
include React purity/refs findings in `Countdown.tsx`, `TypingViewport.tsx`, and `TypingTest.tsx`,
fast-refresh export findings in the context providers, unused binding findings in `auth.ts` and
`passages.ts`, and empty-block findings in `TypingTest.tsx` and `Landing-page.tsx`. Changed telemetry
files pass targeted ESLint checks.

### Current test inventory

- Previous baseline: 59 tests across 7 files.
- Added `TelemetryContextTest`: 3 tests.
- Added `WebVitalsServiceTest`: 5 tests.
- Expected full-suite total if all classes run: 67 tests.

The three `TextIntegrationTest` failures documented above have not been fixed or re-run. The full
suite remains unverified and is expected to be red until the cache-isolation issue and the outdated
public-preset-text expectation are resolved.

### CI and remaining gaps

- `.github/workflows/performance.yml` exists and runs `npm ci`, `npm run build`,
  `npm run perf:bundle`, and Lighthouse CI on frontend pull requests and pushes to `main`.
- There is still no backend test workflow, no frontend unit/component test runner, and no full
  browser E2E suite.
- RUM ingress is public and has no per-IP rate limiting; edge throttling or bucket-based throttling
  should be added before high-volume Internet exposure.
- No Prometheus scraper, OTLP collector, RUM dashboard, or alert rule is provisioned, so telemetry
  is emitted but not yet centrally stored or alerted on.
- k6 performance scenarios remain manual and environment-dependent.
- Docker/Testcontainers, PostgreSQL, and Redis are still required for a complete backend-suite run.
