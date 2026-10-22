# CR-10.3 - Frontend Core Web Vitals and Start Typing RUM

**Area:** Frontend observability, field performance measurement, RUM ingestion
**Architecture pattern:** Beacon-delivered browser metrics + bounded-cardinality server summaries

**Status:** Done

## Bottleneck / anti-pattern (before)

The frontend had synthetic performance coverage from Lighthouse and bundle budgets, but no field
telemetry from real browsers:

- LCP, INP, CLS, FCP, and TTFB were only visible during a Lighthouse run.
- A slow production device, network, or route could not be separated from a lab regression.
- The existing `19wpm` user-timing marks covered keystrokes and typing-render work, but not the
  journey from pressing **Start Typing** to receiving a passage.
- There was no backend endpoint for browser metrics and no server-side aggregation of RUM values.

Lighthouse answers "how fast is this build under a fixed profile?" It does not answer "how fast is
the app for actual users on actual routes?"

## Solution / enhancement (after)

### Browser metric collection

`frontend/package.json` adds `web-vitals`. `frontend/src/utils/telemetry.ts` registers `onLCP`,
`onINP`, `onCLS`, `onFCP`, and `onTTFB`, then sends each metric once per page load.

RUM is enabled in production builds by default. Local development can opt in explicitly:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_RUM_ENABLED` | unset | Set to `true` to enable RUM outside a production build |
| `VITE_RUM_ENDPOINT` | `/api/v1/telemetry/web-vitals` | Override the ingestion endpoint |

Initialization happens in `frontend/src/main.tsx` before the React tree is mounted.

### Beacon delivery and bounded payloads

Each metric is sent with `navigator.sendBeacon` when available; the fallback is
`fetch(..., { keepalive: true })`. Beacons survive page unload better than a normal fetch and do not
block navigation.

The payload contains only:

- metric name (`LCP`, `INP`, `CLS`, `FCP`, `TTFB`, or `start-typing`),
- numeric value,
- rating (`good`, `needs-improvement`, or `poor`),
- navigation type,
- pathname.

Paths are reduced to a fixed allowlist. Unknown or dynamic paths become `/other`, preventing
per-room or per-result URL values from creating unbounded metric cardinality. No user id, token,
query string, passage, or keystroke content is sent.

### Start Typing journey

The Start Typing button appears in three places:

- `frontend/src/LandingPage/Landing-page.tsx`,
- `frontend/src/Pages/Compete.tsx`,
- `frontend/src/Pages/About.tsx`.

Each click calls `markStartTyping()`, which records a user-timing mark and stores the start timestamp
in `sessionStorage`. When `TypingTest.tsx` receives its first passage, `completeTypingJourney()` records
`19wpm:start-typing` and emits a `start-typing` RUM metric in milliseconds.

The session key is consumed once, so loading subsequent passages, pressing Enter for the next test, or
restarting does not emit duplicate journey metrics. The metric is rated with the same thresholds used
for the other RUM values: `<= 1500 ms` good, `<= 3000 ms` needs improvement, above that poor.

### Backend ingestion

`TelemetryController` exposes:

```text
POST /api/v1/telemetry/web-vitals
```

The route is public in `SecurityFilterChainConfig` because visitors can start typing before signing
in. `WebVitalsRequestDTO` enforces non-blank, length-bounded fields and a non-negative value.

`WebVitalsService` validates the metric name, rating, and numeric bounds, normalizes the path, and
records a Micrometer summary named `web.vitals.<metric>` with two bounded tags:

| Tag | Values |
|---|---|
| `rating` | `good`, `needs-improvement`, `poor` |
| `path` | the fixed frontend route allowlist or `/other` |

Separate metric names preserve units: the Core Web Vitals are milliseconds except CLS, while
`web.vitals.start-typing` is always milliseconds. Accepted requests return `202 Accepted`; rejected
metrics return `400 Bad Request`.

## Verification

Frontend production build:

```powershell
cd frontend
npm run build
```

Observed result on 2026-10-23: TypeScript and Vite build passed; 868 modules transformed.

Bundle budgets:

```text
PASS Total JavaScript (gzip): 266.2 KiB / 312.5 KiB
PASS Initial JS + CSS (gzip): 87.4 KiB / 117.2 KiB
PASS Largest JavaScript chunk (gzip): 109.6 KiB / 136.7 KiB
PASS Total CSS (gzip): 6.4 KiB / 23.4 KiB
```

Changed-file lint check (the repository-wide lint command still has unrelated pre-existing errors):

```powershell
npx eslint src/utils/telemetry.ts src/main.tsx src/Pages/Compete.tsx src/Pages/About.tsx
```

Backend telemetry tests:

```powershell
cd backend
$env:JWT_SECRET = [Convert]::ToBase64String((New-Object byte[] 32))
.\mvnw.cmd -Dtest=WebVitalsServiceTest,TelemetryContextTest test
```

Observed result on 2026-10-23:

```text
WebVitalsServiceTest:   Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
TelemetryContextTest:   Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
```

`TelemetryContextTest` now also posts an unauthenticated valid metric and expects `202`, then posts an
unsupported metric and expects `400`. The backend still logs the known matchmaking scheduler Redis
connection error when Redis is absent; that is an environment limitation, not a telemetry failure.

## Impact

- Production route performance is measurable from real sessions instead of only lab runs.
- LCP, INP, and CLS regressions can be observed per route without shipping a separate analytics SDK.
- The Start Typing experience has an explicit latency metric that spans the initial click, route
  transition, and first passage render.
- The public ingress endpoint keeps metric names and tag values bounded, so Prometheus series growth
  is controlled.
- The frontend bundle remains within all committed gzip budgets.

## Limitations

- No dashboard, alert rule, or long-term RUM store is provisioned. The data is exposed through
  Micrometer summaries and `/actuator/prometheus` once a scraper is configured.
- The endpoint is intentionally unauthenticated and has no per-IP rate limiting yet. Validation and
  bounded tags limit cardinality, but an Internet-facing deployment should put rate limiting at the
  edge or add bucket-based throttling before exposing it at volume.
- `web-vitals` reports one value per metric per page load. It does not measure every interaction or
  reconstruct a session.
- The Start Typing timer assumes an SPA transition. A hard reload between the click and passage render
  loses the `performance.now()` time origin, so the stored start value is discarded if it is not
  valid for the new document.
- RUM is disabled in development unless `VITE_RUM_ENABLED=true`; local tests and Lighthouse runs do
  not populate production metrics.
- The repository-wide frontend lint command currently fails on unrelated pre-existing React hooks and
  empty-block findings; changed files pass lint independently.
- The full backend suite still needs local PostgreSQL and Redis. The targeted telemetry tests use the
  H2-backed test profile and pass without those services.

## Rollback

Revert this commit to remove the `web-vitals` dependency, the frontend telemetry module and start
markers, the backend controller/service/DTO, and the public security matcher. No database schema or
existing API contract is changed.
