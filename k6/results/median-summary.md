# k6 load-test results: median of 3 runs

Three full-suite runs of the `k6/` scripts against the local backend. Every
number below was measured; nothing is estimated.

- Date: 2026-10-19 (UTC) — runs at 16:03, 16:10, and 16:17.
- Target: `http://127.0.0.1:8080` (localhost only, never the deployed instance).
- Driver: `run-all.ps1`, all scripts in order, cleanup after every run.
- Outcome: all 6 scripts exited `0` in all 3 runs; `cleanup.sql` deleted 166
  disposable users per run and left **0** `k6.%@example.com` users behind.
- Scripts were not modified between runs (no threshold, VU, duration, or logic
  changes).

## Environment (identical for all 3 runs)

| Component | Value |
| --- | --- |
| CPU | AMD Ryzen 7 7435HS (8 cores / 16 threads, 3.1 GHz base, ~4.55 GHz boost) |
| RAM | 15.82 GB total; 80–87 % in use during the runs |
| OS | Windows 11 Pro, 24H2, build 10.0.26100, 64-bit |
| Host | ASUS TUF Gaming A15 FA507NVR |
| k6 | v2.2.0 (commit `00a9a1b7f5`, Go 1.26.5) |
| Java | 21.0.6 (backend compiled for Java 17) |
| Spring Boot | 4.0.2 |
| Database | Native PostgreSQL 18.4 on `127.0.0.1:5432`, `typing_db` |
| Redis | Portable Redis 8.10.2 on `127.0.0.1:6379` |
| Backend | Native `target/app.jar` on `127.0.0.1:8080` |
| Docker | Not used (daemon unavailable); everything ran natively |

Background load during the runs: Brave, VS Code, and this agent session were
open, so the load generator shared the CPU and RAM with them and the backend.
Each full run took ~6.7 minutes.

The backend ran with local overrides (`--spring.profiles.active=local`,
rate limiting disabled, 1-hour access tokens, dummy OAuth creds, local JWT key),
so these are local single-node numbers, not production capacity.

## Configured load per script

| Script | Executor | Configured load | VUs (pre / max) | Measured peak VUs | Duration |
| --- | --- | --- | --- | ---: | --- |
| `smoke.js` | shared-iterations | 1 full user journey | 1 / 1 | 1 | 1 iteration |
| `auth.js` | constant-arrival-rate | 5 flows/s | 10 / 30 | 10 | 30 s |
| `read-heavy.js` | constant-arrival-rate | 100 reads/s | 30 / 100 | 30 | 2 m |
| `write-heavy.js` | constant-arrival-rate | 25 writes/s | 10 / 30 | 10 | 2 m |
| `mixed.js` | constant-vus | 20 VUs (70/25/5 read/write/stats) | 20 / 20 | 20 | 2 m |
| `websocket.js` | per-vu-iterations | 3 race sessions | 3 / 3 | 3 | 1 iteration (≤45 s) |

## Main metrics per script (run values and median)

`req/s`, latency (`avg`, `p95`, `p99`) and error rate are from
`http_reqs` / `http_req_duration` / `http_req_failed`. Checks are the k6
`checks` pass rate. `p99` is `n/a` for `smoke.js` (single sample).

### smoke.js

| Run | Requests | req/s | Error rate | avg | p95 | p99 | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 15 | 33.2 | 0.00% | 16.23 ms | 97.98 ms | n/a | 100% (30/30) |
| 2 | 15 | 36.3 | 0.00% | 14.01 ms | 87.90 ms | n/a | 100% (30/30) |
| 3 | 15 | 37.3 | 0.00% | 12.93 ms | 85.75 ms | n/a | 100% (30/30) |
| **Median** | **15** | **36.3** | **0.00%** | **14.01 ms** | **87.90 ms** | **n/a** | **100%** |

### auth.js

| Run | Requests | req/s | Error rate | avg | p95 | p99 | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 755 | 25.01 | 0.00% | 38.83 ms | 97.12 ms | 100.94 ms | 100% (1510/1510) |
| 2 | 755 | 25.00 | 0.00% | 36.58 ms | 90.58 ms | 94.73 ms | 100% (1510/1510) |
| 3 | 755 | 25.02 | 0.00% | 38.52 ms | 100.49 ms | 104.54 ms | 100% (1510/1510) |
| **Median** | **755** | **25.01** | **0.00%** | **38.52 ms** | **97.12 ms** | **100.94 ms** | **100%** |

### read-heavy.js

| Run | Requests | req/s | Error rate | avg | p95 | p99 | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 12003 | 99.94 | 0.00% | 1.74 ms | 2.53 ms | 3.20 ms | 100% (24006/24006) |
| 2 | 12002 | 99.93 | 0.00% | 1.95 ms | 2.52 ms | 3.11 ms | 100% (24004/24004) |
| 3 | 12003 | 99.94 | 0.00% | 1.77 ms | 2.39 ms | 3.07 ms | 100% (24006/24006) |
| **Median** | **12003** | **99.94** | **0.00%** | **1.77 ms** | **2.52 ms** | **3.11 ms** | **100%** |

### write-heavy.js

| Run | Requests | req/s | Error rate | avg | p95 | p99 | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3011 | 24.91 | 0.00% | 4.27 ms | 5.43 ms | 7.17 ms | 100% (6022/6022) |
| 2 | 3012 | 24.90 | 0.00% | 4.16 ms | 5.27 ms | 7.41 ms | 100% (6024/6024) |
| 3 | 3011 | 24.90 | 0.00% | 4.13 ms | 4.81 ms | 7.45 ms | 100% (6022/6022) |
| **Median** | **3011** | **24.90** | **0.00%** | **4.16 ms** | **5.27 ms** | **7.41 ms** | **100%** |

### mixed.js

| Run | Requests | req/s | Error rate | avg | p95 | p99 | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 11853 | 98.51 | 0.00% | 2.98 ms | 9.53 ms | 17.08 ms | 100% (23706/23706) |
| 2 | 11904 | 98.96 | 0.00% | 2.27 ms | 4.04 ms | 4.89 ms | 100% (23808/23808) |
| 3 | 11796 | 97.99 | 0.00% | 2.41 ms | 4.18 ms | 14.47 ms | 100% (23592/23592) |
| **Median** | **11853** | **98.51** | **0.00%** | **2.41 ms** | **4.18 ms** | **14.47 ms** | **100%** |

### websocket.js

`req/s` here is HTTP requests/s only (5 HTTP calls per run); the scenario is a
functional STOMP race flow, not a throughput test.

| Run | Requests | req/s | Error rate | avg | p95 | p99 | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 5 | 0.82 | 0.00% | 37.00 ms | 88.84 ms | 89.19 ms | 100% (23/23) |
| 2 | 5 | 0.82 | 0.00% | 39.15 ms | 94.31 ms | 94.33 ms | 100% (23/23) |
| 3 | 5 | 0.81 | 0.00% | 42.06 ms | 101.83 ms | 101.92 ms | 100% (23/23) |
| **Median** | **5** | **0.82** | **0.00%** | **39.15 ms** | **94.31 ms** | **94.33 ms** | **100%** |

## Suite totals

| Run | Total HTTP requests |
| --- | ---: |
| 1 | 27642 |
| 2 | 27693 |
| 3 | 27585 |
| **Median** | **27642** |

Total across the median run = 27,642 requests (15 smoke + 755 auth + 12,003
read + 3,011 write + 11,853 mixed + 5 websocket), spread over ~6.7 minutes.

## Run-to-run variance

- Throughput was stable: fixed-rate scripts held within ~0.1 % of target
  (read 99.93–99.94/s, write 24.90–24.91/s, auth 25.00–25.02/s).
- Error rate was 0.00 % and checks 100 % in all 18 script-runs (6 scripts × 3).
- Latency spread (min–max across the 3 runs):

| Script | avg | p95 | p99 |
| --- | --- | --- | --- |
| smoke | 12.93–16.23 ms | 85.75–97.98 ms | n/a |
| auth | 36.58–38.83 ms | 90.58–100.49 ms | 94.73–104.54 ms |
| read-heavy | 1.74–1.95 ms | 2.39–2.53 ms | 3.07–3.20 ms |
| write-heavy | 4.13–4.27 ms | 4.81–5.43 ms | 7.17–7.45 ms |
| mixed | 2.27–2.98 ms | 4.04–9.53 ms | 4.89–17.08 ms |
| websocket | 37.00–42.06 ms | 88.84–101.83 ms | 89.19–101.92 ms |

The widest spread is `mixed.js` (p95 4.04–9.53 ms, p99 4.89–17.08 ms), which
mixes reads and writes on the same connection pool; one `mixed_write_duration`
outlier of 189.72 ms occurred in run 1 (vs 13.18 / 20.44 ms in runs 2 / 3).
Read-heavy is the most stable.

## Scenario-specific metric medians

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

## What these numbers support (and do not)

**Safe to claim:**

- Sustained ~100 reads/s for 2 minutes at p95 ≈ 2.5 ms and p99 ≈ 3.1 ms, with
  0 % HTTP errors.
- Sustained ~25 typing-result writes/s for 2 minutes at p95 ≈ 5.3 ms and
  p99 ≈ 7.4 ms, with 0 % HTTP errors.
- ~5 auth flows/s (signup → login → refresh → logout) at a p95 flow time of
  ≈ 208 ms.
- 20 concurrent mixed read/write VUs for 2 minutes at overall p95 ≈ 4.2 ms,
  p99 ≈ 14.5 ms (write path slower than reads).
- A working STOMP multiplayer race flow; measured countdown ≈ 3.52 s matches
  the server's ~3.5 s setting.
- 0 % HTTP errors and 100 % check pass rate across all 18 script-runs.
- A disposable-user test harness that leaves 0 test accounts behind after each
  run.

**Not supported by this data (do not claim):**

- Maximum capacity or saturation limits — every rate was fixed by k6; no run
  pushed the backend to failure.
- Production or cloud performance — single machine, load generator shares CPU
  and RAM with the backend, database, and Redis; rate limiting disabled; 1-hour
  tokens; localhost only, no TLS.
- Concurrency beyond the stated VUs (max 30 concurrent for reads).
- Soak, spike, or distributed (multi-generator) results — none were run.
- WebSocket load characteristics — only 3 race sessions, one iteration each.
- Anything about the deployed (Azure) instance.

## Reproduce

```powershell
# 3 times, cleanup runs automatically after each
powershell -ExecutionPolicy Bypass -File .\run-all.ps1
```

Raw per-run summaries and k6 logs for these measurements live locally in
`run1/`, `run2/`, and `run3/`; they are git-ignored and not part of the
committed report.
