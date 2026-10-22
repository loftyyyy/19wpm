# Render cached passages first and revalidate without replacing the active test

**Area:** Frontend (`usePassageQueue`)
**Architecture pattern:** Stale-while-revalidate with an append-only passage queue
**Status:** Done

## Issue (before)

The queue always started empty and waited for a network batch, even when the landing page had just
prefetched the exact same preference set. The cache existed after the previous change, but no
consumer read it on mount.

## Solution (after)

`usePassageQueue` now checks the cache synchronously before its first render decision:

- A cached batch fills the queue immediately and clears the loading state, so the typing page can
  select a passage without waiting for the network.
- A missing entry follows the existing bounded fetch path.
- A stale entry is served immediately and revalidated in the background. Fresh work is appended to
  the queue; it never replaces the passage the user is already typing.
- A fresh entry avoids a duplicate mount request. The normal queue refill still requests a new batch
  when the queue falls below its threshold, so the cached batch is extended without blocking the
  first passage.
- The existing request-id guard, 1.5-second deadline, and local fallback remain in force. A late
  revalidation can warm the cache and extend the queue but cannot mutate the active passage.

The queue is append-only after selection. Cache-first data and refreshed data only populate the
upcoming queue; the active passage comes from `next()` and is held by the typing view.

## Impact

- Landing-page warm-up now produces an instant first passage instead of an unused cache entry.
- A stale batch does not block the test while it refreshes.
- Revalidation cannot reset progress, swap text, or change the active test.
- Cache misses and failures behave exactly as they did before the cache was introduced.

## Files changed

- `frontend/src/hooks/usePassageQueue.ts` - synchronous cache read, background revalidation,
  append-only queue behavior.

## Verification

- `npx tsc -b` (green).
- `npm run build` (green).
- Headless Edge smoke test with intercepted network delays: both a fresh cache hit and a forced
  stale entry rendered the first batch in about 60 ms, while the delayed background refill ran
  separately and left the active passage unchanged.
- `npm run lint` remains at the pre-existing repository baseline.

## Rollback

Revert this commit. The cache still warms from the landing page and captures queue fetches, but the
typing page ignores cached entries and waits for a fresh batch.
