# CR-10.1 - Gate pull requests on bundle size and Lighthouse metrics

**Area:** Frontend build, GitHub Actions, Lighthouse CI
**Architecture pattern:** Automated performance budgets in continuous integration
**Status:** Done

## Bottleneck / anti-pattern (before)

The repository had a production build and a bundle visualizer, but no automated gate:

- No `.github/workflows` directory existed, so a pull request could increase the initial JavaScript
  payload without any failing check.
- Lighthouse was not configured. Core Web Vitals, total blocking time, and TTI were only observable
  manually.
- The default Vite warning threshold is advisory and does not assert a repository-specific budget.

Performance work that is not enforced regresses. The gate needs to fail the pull request, not print a
warning that reviewers can ignore.

## Solution / enhancement (after)

### Bundle budget

`frontend/scripts/check-bundle-size.mjs` reads the production `dist` output, gzip-compresses every
JavaScript and CSS asset, and compares four budgets from `frontend/performance-budgets.json`:

| Budget | Limit | Why |
|---|---:|---|
| Total JavaScript | 320,000 B gzip | Catches aggregate growth across lazy routes |
| Initial JS + CSS referenced by `index.html` | 120,000 B gzip | Protects the landing-page critical path |
| Largest JavaScript chunk | 140,000 B gzip | Prevents one route from becoming a monolith |
| Total CSS | 24,000 B gzip | Catches utility/CSS regressions |

The script prints the actual value against each budget and exits non-zero on the first failed budget.
Run it after a build:

```powershell
cd frontend
npm run build
npm run perf:bundle
```

Local baseline on 2026-10-22:

```text
PASS Total JavaScript (gzip): 263.5 KiB / 312.5 KiB
PASS Initial JS + CSS (gzip): 84.8 KiB / 117.2 KiB
PASS Largest JavaScript chunk (gzip): 109.6 KiB / 136.7 KiB
PASS Total CSS (gzip): 6.4 KiB / 23.4 KiB
```

### Lighthouse CI

`frontend/lighthouserc.json` serves the built `frontend/dist` directory with LHCI's static server and
runs three desktop Lighthouse passes. The median run is asserted:

| Metric | Failing threshold | Notes |
|---|---:|---|
| Performance score | >= 0.85 | Aggregate guardrail |
| Largest Contentful Paint (LCP) | <= 2,500 ms | Core Web Vital |
| Cumulative Layout Shift (CLS) | <= 0.10 | Core Web Vital |
| Total Blocking Time (TBT) | <= 200 ms | Lab proxy for INP/FID responsiveness |
| Time to Interactive (TTI) | <= 5,000 ms | Still present in Lighthouse JSON |
| First Contentful Paint (FCP) | <= 1,800 ms | Warning only |
| Speed Index | <= 3,400 ms | Warning only |

FID is no longer collected by Lighthouse, and lab INP is not equivalent to field INP. The CI gate uses
TBT as the deterministic lab responsiveness proxy; the client RUM work in CR-10.3 reports field
LCP/INP/CLS from real sessions.

The measured URL is pinned to `http://localhost/` rather than letting LHCI autodiscover
`/index.html`. The React SPA router has no `/index.html` route, so navigating there produces a blank
page and a `NO_FCP` Lighthouse error. The static server still serves the same `index.html` at `/`.

Lighthouse runs with `--no-sandbox --disable-dev-shm-usage` for the GitHub-hosted runner. Reports are
uploaded to Lighthouse CI temporary public storage for seven days and saved as workflow artifacts.
No Lighthouse server or secret is required.

Local autorun on 2026-10-22 passed every assertion. Median of three desktop runs:

| Metric | Median |
|---|---:|
| Performance score | 0.99 |
| First Contentful Paint | 532 ms |
| Largest Contentful Paint | 922 ms |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0.01 |
| Time to Interactive | 924 ms |
| Speed Index | 580 ms |

### GitHub Actions workflow

`.github/workflows/performance.yml` runs on every pull request that changes `frontend/**` or the
workflow itself, on pushes to `main`, and on manual dispatch:

1. Check out the repository and install Node.js 22 with npm caching.
2. `npm ci` in `frontend`.
3. `npm run build` (TypeScript project build plus Vite production build).
4. `npm run perf:bundle` (hard bundle-budget failure).
5. `treosh/lighthouse-ci-action@v12` with `frontend/lighthouserc.json` (hard Lighthouse assertion
   failure).

The workflow uses read-only repository permissions and cancels superseded runs for the same ref.

## Impact

- A pull request that grows the initial payload past 120 KB gzip, any single chunk past 140 KB gzip,
  or the total JavaScript past 320 KB gzip fails before review.
- A regression in LCP, CLS, TBT, TTI, or the aggregate performance score fails the Lighthouse step.
- The gate is path-scoped to frontend changes but the workflow file itself is also a trigger path, so
  edits to the gate are exercised by the same pull request.

## Limitations

- Budgets are based on the current build, not a statistical distribution of real-user data. They need
  periodic review when a deliberate feature adds payload.
- Lighthouse runs against the static build without the backend. API-dependent states are not part of
  this audit; the landing page is the measured entry point.
- Lighthouse lab measurements are noisy on shared runners. Three runs with median aggregation reduce
  noise, but a failing result should be reproduced locally before assuming a product regression.
- Field FID/INP requires RUM and is not covered by this workflow.

## Rollback

Revert this commit to remove the workflow, Lighthouse config, and budget script. The application build
itself is unchanged.
