# Refactor 3.4 — Expose Server-Timing on content endpoints

**Area:** Content API (`WordController`, `TextController`, CORS)
**Architecture pattern:** Response-header instrumentation for per-route service timing
**Status:** Done

## Bottleneck / anti-pattern (before)

Content latency was visible only as a total fetch time in the browser. When a word or text request
was slow, there was no way to tell whether the time was spent in the service (database, cache,
sampling) or in Security, JSON serialization, or the network. Cache wins from
[`39-word-pool-cache.md`](39-word-pool-cache.md) were therefore hard to confirm in a live
environment, and a k6 run could not distinguish backend work from transport overhead.

## Solution / enhancement (after)

Add a small `ServerTiming` helper and emit a W3C `Server-Timing` response header from the
content endpoints:

```text
Server-Timing: words;dur=2
Server-Timing: texts;dur=4
Server-Timing: text;dur=1
```

```java
public static String measure(String metric, long startNanos) {
    long elapsedMillis = (System.nanoTime() - startNanos) / 1_000_000;
    return metric + ";dur=" + elapsedMillis;
}
```

Instrumented routes:

| Route | Metric |
| --- | --- |
| `GET /api/v1/words` | `words` |
| `GET /api/v1/texts` | `texts` |
| `GET /api/v1/texts/{textId}` | `text` |
| `GET /api/v1/texts/random` | `text` |

`Server-Timing` is also added to the CORS exposed headers, so the separate frontend origin can read
it from `PerformanceResourceTiming.serverTiming` or a raw response header. Without that exposure,
cross-origin JavaScript could see the header in devtools but not read it.

## Architecture pattern

- **Per-route instrumentation at the controller boundary:** the timer starts immediately before the
  service call and stops immediately after it. This isolates service work (database, cache,
  sampling, serialization into DTOs) from Spring Security, HTTP serialization, and network time.
- **A response header rather than a response wrapper:** no `ResponseBodyAdvice`, no changes to
  payload shape, and existing controller return types stay intact. The header can be aggregated by
  a reverse proxy, logged from access logs, or read by the browser.

## Notes / trade-offs

- The measured window excludes JSON serialization and network transfer, which keeps the metric
  focused on backend work. Total request time still comes from the client or the k6 report.
- Millisecond resolution is intentional: sub-millisecond precision is not useful for these routes
  and integer values keep the header compact.
- Cache hits and misses are not separately labelled. A follow-up could emit
  `words;dur=0;desc="cache"` by returning a hit flag from the service, but that would change the
  service contract for marginal value.
- The header reveals timing but no data, user identifiers, or cache keys. It is exposed only to the
  same allowed CORS origins already permitted by `CorsConfig`.
- `Server-Timing` is a standard HTTP response header; no custom status codes or payload fields are
  introduced.

## Files changed

- `backend/src/main/java/com/rho/backend/util/ServerTiming.java` — header constant and measurement
  formatter.
- `backend/src/main/java/com/rho/backend/controller/WordController.java` — timing around
  `getRandomWords`.
- `backend/src/main/java/com/rho/backend/controller/TextController.java` — timing around the batch,
  single-random, and by-id text routes.
- `backend/src/main/java/com/rho/backend/config/CorsConfig.java` — expose `Server-Timing` to allowed
  origins.
- `backend/src/test/java/com/rho/backend/util/ServerTimingTest.java` — header formatting.
- `backend/src/test/java/com/rho/backend/content/RandomContentIntegrationTest.java` — HTTP-level
  assertions for the word and text batch headers.

## Verification

- Compile: `.\mvnw.cmd -q -DskipTests compile` (green).
- Tests: `ServerTimingTest` (1/1) and `RandomContentIntegrationTest` (8/8) pass, including:
  - `wordEndpointEmitsServerTimingHeader` asserts `words;dur=<digits>` on `GET /api/v1/words`.
  - `textBatchEndpointEmitsServerTimingHeader` asserts `texts;dur=<digits>` on `GET /api/v1/texts`.
- Full-suite runs still require Redis for unrelated race tests; targeted tests avoid that dependency.

## Rollback

Revert this commit. Controllers return the plain `ResponseEntity.ok(body)` responses, the helper and
its test disappear, and CORS stops exposing `Server-Timing`.
