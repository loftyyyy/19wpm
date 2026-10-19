# 19wpm Backend Load Tests (k6)

Reproducible load tests for the `19wpm` Spring Boot backend, written for
[k6](https://k6.io). Every number in this README was measured on the machine
described below; nothing here is estimated.

## Scope and intent

- Exercise the real HTTP and STOMP APIs the frontend uses: auth, texts, words,
  stats, typing results, and multiplayer races.
- Measure latency, throughput, and error rate under a few realistic workloads.
- Fail loudly: each script has `check()` assertions, thresholds, and custom
  `Trend`/`Counter` metrics.
- Produce a machine-readable and human-readable summary per run.

## Environment

All results were measured on this exact setup:

| Component | Value |
| --- | --- |
| CPU | AMD Ryzen 7 7435HS (8 cores / 16 threads, 3.1 GHz) |
| RAM | 15.82 GB |
| OS | Microsoft Windows 11 Pro, build 10.0.26100, 64-bit |
| Host | ASUS TUF Gaming A15 FA507NVR |
| k6 | v2.2.0 (commit `00a9a1b7f5`, Go 1.26.5) |
| Java | 21.0.6 (backend compiled for Java 17) |
| Spring Boot | 4.0.2 |
| Database | Native PostgreSQL 18.4 on `127.0.0.1:5432`, database `typing_db` |
| Redis | Portable Redis 8.10.2 on `127.0.0.1:6379` |
| Backend | Native `target/app.jar` on `127.0.0.1:8080` |
| k6 target | `http://127.0.0.1:8080`, ws `ws://127.0.0.1:8080/ws/websocket` |

Docker was not used; the daemon was unavailable, so PostgreSQL, Redis, and the
backend all ran natively.

### Seed data present during the run

- `texts`: 4917 (`en`: SHORT 1358, MEDIUM 568, LONG 128, THICC 2863)
- `words`: 13874 (`en`: EASY 874, MEDIUM 5000, HARD 5000, EXPERT 3000)

## Local test configuration (differs from production)

The backend was started with overrides so tests could run without external
services:

- `--spring.profiles.active=local`
- Local PostgreSQL and Redis.
- `--jwt.access-token.expiration-ms=3600000` (1 hour; production is 90s).
- `--security.rate-limit.enabled=false` (production enables login/refresh rate limits).
- Dummy OAuth client credentials.
- A local JWT signing key.

These differences mean the absolute numbers below describe a local, single-node,
rate-limit-disabled deployment. They are not production capacity claims.

The refresh endpoint uses Redis `GETDEL`, so it requires Redis 6.2+. The machine
originally had Redis 5.0.14.1, which made `POST /api/v1/auth/refresh` return
`500`; it was replaced with portable Redis 8.10.2.

## Layout

```
k6/
  config.js        shared base URL, run id, identities, headers
  lib/api.js       auth/read/result/race helpers used by every script
  lib/summary.js   handleSummary -> results/<name>-<timestamp>.json/.txt
  smoke.js         1 VU, 1 full user journey
  auth.js          signup/login/refresh/logout arrival-rate load
  read-heavy.js    uniform read-only arrival-rate load
  write-heavy.js   typing-result write arrival-rate load
  mixed.js         70% read / 25% write / 5% stats constant-VU workload
  websocket.js     3-VU STOMP race flow
  run-all.ps1      runs every script in order, cleans up afterwards
  cleanup.sql      deletes disposable k6 users
  .gitignore       ignores raw k6 logs and debug captures
  results/         committed median-summary.md; per-run output is git-ignored
```

## How to run

Prerequisites: PostgreSQL with `typing_db`, Redis 6.2+, the backend running on
`:8080`, and k6 installed.

```powershell
# Everything, in order, with cleanup
powershell -ExecutionPolicy Bypass -File .\run-all.ps1

# One script (smoke | auth | read-heavy | write-heavy | mixed | websocket)
powershell -ExecutionPolicy Bypass -File .\run-all.ps1 -Script smoke

# One script, directly
k6 run smoke.js

# Fast validation override (does not change the measured defaults)
k6 run -e READ_RATE=20 -e READ_DURATION=8s read-heavy.js
```

If `k6` / `psql` aren't on your PATH, pass `-K6` / `-Psql` to `run-all.ps1`
or set the `K6_PATH` / `PSQL_PATH` environment variables.

The default test password (`Loadtest123!`) is a disposable, local-only
credential used only for the throwaway `k6.*@example.com` accounts. Override it
with the `TEST_PASSWORD` environment variable; do not reuse it anywhere real.

Most scripts accept environment overrides so you can smoke-test them quickly
without editing the committed defaults:

| Script | Overrides | Defaults |
| --- | --- | --- |
| `auth.js` | `AUTH_RATE`, `AUTH_DURATION` | 5/s, 30s |
| `read-heavy.js` | `READ_RATE`, `READ_DURATION` | 100/s, 2m |
| `write-heavy.js` | `WRITE_RATE`, `WRITE_DURATION` | 25/s, 2m |
| `mixed.js` | `MIXED_VUS`, `MIXED_DURATION` | 20 VUs, 2m |
| `websocket.js` | — | 3 VUs, 1 iteration |

All scripts include `summaryTrendStats: ['avg','min','med','max','p(90)','p(95)','p(99)']`,
so p99 is reported whenever there is enough data. `smoke.js` runs a single
iteration, so its p99 is legitimately `n/a`.

## Measured results

Three full-suite runs on 2026-10-19 (all scripts exited `0`, all thresholds
PASS, cleanup left 0 test users after each). Numbers below are the **median of
the 3 runs**; the full per-run breakdown, configured VUs/durations, run-to-run
variance, and safe-vs-unsafe claim list are in
[`results/median-summary.md`](results/median-summary.md).

| Scenario | Requests (median) | req/s | Error rate | avg | p95 | p99 | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| smoke | 15 | 36.3 | 0.00% | 14.01 ms | 87.90 ms | n/a | 100% |
| auth | 755 | 25.01 | 0.00% | 38.52 ms | 97.12 ms | 100.94 ms | 100% |
| read-heavy | 12003 | 99.94 | 0.00% | 1.77 ms | 2.52 ms | 3.11 ms | 100% |
| write-heavy | 3011 | 24.90 | 0.00% | 4.16 ms | 5.27 ms | 7.41 ms | 100% |
| mixed | 11853 | 98.51 | 0.00% | 2.41 ms | 4.18 ms | 14.47 ms | 100% |
| websocket | 5 | 0.82 | 0.00% | 39.15 ms | 94.31 ms | 94.33 ms | 100% |

Total across the median run: **27,642 HTTP requests** over ~6.7 minutes. All 6
scripts passed 100% of checks and produced 0% HTTP errors in every run.

Scenario-specific custom metric medians:

| Metric | Median of 3 runs |
| --- | --- |
| `smoke_flow_duration` | avg/p95 114 ms |
| `auth_flow_duration` | avg 192.72 ms, p95 207.50 ms, p99 212.50 ms |
| `auth_flows_completed` | 151 |
| `read_request_duration` | avg 1.77 ms, p95 2.52 ms, p99 3.11 ms |
| `read_requests_completed` | 12001 |
| `write_result_duration` | avg 3.86 ms, p95 5.16 ms, p99 6.88 ms |
| `write_results_created` | 3000 |
| `mixed_read_duration` | avg 1.84 ms, p95 3.37 ms, p99 3.95 ms |
| `mixed_write_duration` | avg 4.38 ms, p95 13.38 ms, p99 17.33 ms |
| `mixed_reads_completed` / `mixed_writes_completed` | 8860 / 2972 |
| `ws_connect_duration` | avg 7.67 ms, p95 8.80 ms |
| `ws_countdown_duration` | avg 3523 ms (server config ~3500 ms) |
| `ws_race_duration` | avg 5872 ms |
| `ws_races_completed` / `ws_errors` | 3 / 0 |

Raw per-run summaries and k6 logs are kept locally in `run1/`, `run2/`,
`run3/` but are git-ignored; only this median report is committed.

## Interpretation

- Throughput was deliberately fixed by k6 arrival rates (100 reads/s, 25
  writes/s, 5 auth flows/s). These are achieved request rates, not the maximum
  the backend can serve. No saturation testing was performed.
- Latencies are low and stable on this machine: the slowest sustained p95 is
  `mixed_write_duration` at 13.38 ms. The auth scenario is the slowest end to
  end because each iteration hashes passwords and issues tokens
  (`auth_flow_duration` p95 207.50 ms).
- No HTTP errors occurred in any scenario, and every `check()` passed.
- The websocket sample is small (3 race sessions, one race each). It validates
  the flow (STOMP connect/auth, join, countdown, RACING broadcast, progress,
  finish) rather than load; the measured countdown of ~3523 ms matches the
  server's configured 3500 ms `countdownDurationMs`.
- `write-heavy` writes are spread across 10 users with deliberately unique
  `finishedAt` values. The endpoint rejects exact duplicates of
  `(user, textId, finishedAt, wpm, accuracy)`, so uniqueness is required to
  measure raw write throughput.

### Bug/constraint found during the work

`TypingResultRequestDTO` validates `wpm` and `accuracy` with
`@Digits(integer = 3, fraction = 2)`. Sending more than two decimal places
returns `400 Validation Failed`. The load scripts round these values to two
decimals. This is a real API contract detail worth knowing for any client.

## Limitations and honest caveats

- Single machine hosts the load generator, backend, database, and Redis, so the
  numbers include resource contention across all four.
- Rate limiting was disabled and access tokens were long-lived; production
  behavior under those controls is not represented.
- No saturation, spike, soak, or distributed tests were run.
- There is no leaderboard endpoint in the backend, so no leaderboard scenario
  exists.
- `cleanup.sql` removes `race_results` for test users and then deletes the users
  (cascading `typing_results` and `user_stats`). `race_sessions` has no user
  foreign key, so historical empty race sessions are intentionally left behind.
- Do not point these tests at the deployed Azure instance without explicit
  approval: it would incur cost and is not intended for load testing.

## Cleanup

Test accounts use emails of the form `k6.<runid>.<label>.<n>@example.com` and
usernames prefixed `k6_`. Cleanup only matches that pattern, so the original
developer account and any other non-k6 users are never touched.

```powershell
psql -U postgres -d typing_db -f cleanup.sql
```

`run-all.ps1` runs cleanup automatically unless `-SkipCleanup` is passed.

## Resume-ready summary

Built a reproducible k6 load-test suite (smoke, auth, read-heavy, write-heavy,
mixed, and WebSocket/STOMP race scenarios) for a Spring Boot 4 / PostgreSQL /
Redis backend, with per-scenario thresholds and custom metrics. Ran the full
suite 3 times against localhost with cleanup between runs and reported medians:
~100 reads/s (p95 2.52 ms, p99 3.11 ms), ~25 result writes/s (p95 5.27 ms,
p99 7.41 ms), and ~5 auth flows/s (p95 207.50 ms), with 0% HTTP errors and 100%
check pass rates on a local single-node setup (median run: 27,642 requests).
