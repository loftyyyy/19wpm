# Warm passages from the landing page on idle and start intent

**Area:** Frontend (`Landing-page`)
**Architecture pattern:** Idle-time cache warming tied to the current preference state
**Status:** Done

## Issue (before)

The landing page warmed the `/solo` route chunk, but it did not warm the passage request. The first
passage therefore still waited for `/words` or `/texts` after navigation. Users who paused on the
configuration screen had already expressed their preference but that time could not be used.

## Solution (after)

`LandingPage` now derives the active preference set and prefetches it through `passageCache`:

- After mount, the prefetch runs in `requestIdleCallback` with a 1200 ms timeout. Browsers without
  `requestIdleCallback` use an 800 ms timeout, matching the existing route preload window.
- Any mode, duration, word-count, phrase-length, or difficulty change cancels the pending idle work
  and schedules a prefetch for the new key.
- The Start button's pointer, focus, and touch intent paths warm both the route chunk and the passage
  cache. The click path reuses the same intent handler before navigation.
- Prefetch failures are ignored on the landing page. The typing hook keeps its deadline and local
  fallback, so a failed warm-up cannot block or break the test.

The landing prefetch is non-forced. A fresh cache entry answers immediately; an expired or missing
entry starts one shared request.

## Impact

- A configured landing visit can arrive at `/solo` with the exact passage batch already in memory.
- Preference changes update the warmed key instead of leaving the default key warm.
- Concurrent route preload, landing prefetch, and typing-page fetch coalesce through the cache's
  in-flight map.

## Files changed

- `frontend/src/LandingPage/Landing-page.tsx` - preference-aware idle and intent prefetch.
- `frontend/src/services/passageCache.ts` - existing shared prefetch entry point.

## Verification

- `npx tsc -b` (green).
- `npm run build` (green).
- `npm run lint` remains at the pre-existing repository baseline.

## Rollback

Revert this commit. The landing page still warms the route chunk, but passage requests begin only
after the typing page mounts.
