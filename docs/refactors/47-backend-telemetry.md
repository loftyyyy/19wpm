# CR-10.2 - Backend request, service, and repository telemetry

**Area:** Backend observability, Actuator, Micrometer, OpenTelemetry
**Architecture pattern:** Automatic HTTP instrumentation + declarative observations at service and repository boundaries
**Status:** Done

## Bottleneck / anti-pattern (before)

The backend exposed a `Server-Timing` response header for a handful of content routes, but it had no
aggregate telemetry:

- No Actuator endpoints, so health, JVM, connection-pool, and HTTP metrics were unavailable.
- No metrics registry, so latency could not be aggregated or alerted on.
- No traces, so a slow request could not be followed from the HTTP entry point through the service
  layer and into the repository.
- Performance questions required log reading or ad-hoc timing rather than querying a time series.

`Server-Timing` is useful to an individual browser session, but it is not a production monitoring
system: it is per-response, has no history, and cannot distinguish a cache hit from a database call.

## Solution / enhancement (after)

### Dependencies

`backend/pom.xml` adds:

| Dependency | Purpose |
|---|---|
| `spring-boot-starter-actuator` | Health, JVM, cache, HTTP, and metrics endpoints |
| `spring-boot-starter-aspectj` | Enables Micrometer's `@Observed` aspect and the repository aspect |
| `micrometer-registry-prometheus` | Prometheus scrape format at `/actuator/prometheus` |
| `spring-boot-starter-opentelemetry` | OpenTelemetry tracing bridge and OTLP trace/metric exporters |

Spring Boot 4 renamed the AOP starter: `spring-boot-starter-aop` does not exist in this version;
`spring-boot-starter-aspectj` is the correct artifact. The OpenTelemetry starter also replaces the
older explicit `micrometer-tracing-bridge-otel` plus `opentelemetry-exporter-otlp` pair.

### Automatic HTTP telemetry

Actuator's HTTP server observation records `http.server.requests` for every request with the route
template, status, and outcome. `application-prod.properties` enables:

```properties
management.metrics.distribution.percentiles-histogram.http.server.requests=true
management.metrics.distribution.slo.http.server.requests=50ms,100ms,250ms,500ms,1s,2s
```

The histogram makes Prometheus percentile queries possible; the SLO buckets keep useful latency
buckets without the cardinality cost of per-route configuration.

The Caffeine caches now call `recordStats()`, so Actuator's cache meters include hit and miss counts,
not just entry size. This is required for judging whether the text catalogue and word-pool caches are
actually serving traffic.

### Service observations

`ObservedAspect` is registered in `ObservationConfig`. Service methods use `@Observed` so timings are
recorded under stable, purpose-named observations rather than method names:

| Observation | Boundary |
|---|---|
| `texts.random.batch` | Random passage batch |
| `texts.by.id` | Passage lookup by id |
| `texts.preset` | Preset catalogue |
| `texts.random.type` | Random passage by text type |
| `texts.short`, `texts.medium`, `texts.long`, `texts.thicc` | Typed catalogue lists |
| `texts.random` | Random preset passage |

Names are low-cardinality and stable, so they can be graphed and alerted on without a per-request tag.
User ids, passage ids, code values, and other unbounded values are deliberately not tagged.

OAuth code redemption is not a controller annotation because it mutates a one-time Redis code and
issues tokens inside `AuthService.exchangeOAuthCode`. It creates `auth.oauth.exchange` manually with
`flow=oauth2-code`, marks failures with `observation.error(...)`, and always stops the observation.
This keeps the existing transaction and exception behavior unchanged.

### Repository observations

`RepositoryObservationAspect` wraps `com.rho.backend.repository` calls with `db.repository`. The
contextual name is `<Repository>.<method>` (for example `Text.findByIsCustomFalse`), and the
low-cardinality tags are `repository` and `operation`. This separates time spent in the service layer
from time spent in the persistence layer when reading a trace.

The aspect is intentionally narrow: it observes repository proxy calls only. It does not tag SQL,
parameters, or result sizes, so it does not introduce unbounded tag cardinality or leak content.

### Actuator exposure and health

Production exposes `health`, `info`, `metrics`, and `prometheus`. Health probes and details are
configured explicitly:

```properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoint.health.probes.enabled=true
management.endpoint.health.show-details=never
```

`SecurityFilterChainConfig` permits only `/actuator/health` and `/actuator/health/**` without
authentication; the remaining actuator endpoints stay behind the existing security chain. A public
load balancer or container platform can use the health endpoint, while metrics remain protected.

### Tracing and export

The application name is attached to every observation:

```properties
management.observations.key-values.application=19wpm-backend
management.tracing.sampling.probability=${OTEL_TRACING_SAMPLING_PROBABILITY:0.1}
```

Production export is controlled by environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `OTEL_TRACING_ENABLED` | `true` | Enable OTLP trace export |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://localhost:4318/v1/traces` | Trace collector endpoint |
| `OTEL_METRICS_ENABLED` | `true` | Enable OTLP metric export |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | `http://localhost:4318/v1/metrics` | Metric collector endpoint |
| `OTEL_TRACING_SAMPLING_PROBABILITY` | `0.1` | Trace sampling ratio |

The local/default profile disables OTLP export so tests and local runs do not attempt to reach a
collector. Production enables it by default and expects the deployment to point the endpoints at an
OTLP-compatible collector, or to set `OTEL_TRACING_ENABLED=false` and `OTEL_METRICS_ENABLED=false`
until one exists.

### Verification

`TelemetryContextTest` starts the full application context with the `test` profile, registers an
in-memory `ObservationHandler`, calls `TextService.getPresetTexts()`, and asserts that both
`texts.preset` and `db.repository` observations were stopped.

The backend test context requires a valid Base64-encoded 32-byte JWT secret:

```powershell
cd backend
$env:JWT_SECRET = [Convert]::ToBase64String((New-Object byte[] 32))
.\mvnw.cmd -Dtest=TelemetryContextTest test
```

Observed result on 2026-10-23:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
```

## Impact

- Every HTTP request contributes latency metrics without controller changes.
- Passage catalog and random-passage paths have named service timings, including cache-backed calls.
- Repository time is visible as its own span instead of being hidden inside a service span.
- OAuth exchange failures are traceable without logging token or code values.
- Health and metrics endpoints exist for the deployment platform and Prometheus.

## Limitations

- No OTLP collector or Prometheus server is provisioned by this change. The production defaults assume
  an OTLP endpoint; without one, disable export or set the endpoint environment variables.
- Metrics and Prometheus scrape endpoints remain authenticated. A scraper needs credentials or a
  network path that satisfies the existing security chain.
- The in-memory test handler verifies observation names, not backend export. OTLP delivery is verified
  only when a collector is configured.
- Trace sampling is 10% by default. This is appropriate for low-overhead production tracing but is not
  a complete request audit; increase sampling temporarily when investigating an incident.
- The repository aspect uses a pointcut rather than decorating every repository, so a future
  repository implementation that bypasses the Spring proxy is not observed automatically.
- The full integration suite still depends on local PostgreSQL and Redis. Without them, the auth and
  text integration tests fail on Redis or Flyway connection refusal; the telemetry test itself only
  needs the H2-backed test profile and passes in isolation.

## Rollback

Revert this commit to remove the Actuator and OpenTelemetry dependencies, the observation aspect and
annotations, and the actuator configuration. No database schema or API contract changes are involved.
