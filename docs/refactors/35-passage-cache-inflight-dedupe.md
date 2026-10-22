# Add a TTL passage cache with in-flight deduplication

**Area:** Frontend (`passageCache`, `usePassageQueue`)
**Architecture pattern:** TTL cache-aside with request coalescing
**Status:** Done

## Issue (before)

Every `usePassageQueue` batch fetched `/words` or `/texts` directly. A landing-page prefetch and
the typing page could therefore request the same preference set at the same time, and a rerender or
rapid preference change could start duplicate work.

The fetch also lived inside the hook. That made the network response unavailable to any other
screen and forced the landing page to duplicate the request shape if it wanted to warm the route.

## Solution (after)

`frontend/src/services/passageCache.ts` now owns word and phrase fetching behind a keyed cache:

- Cached batches expire after five minutes.
- Keys contain only inputs that change the response: word count and difficulty for words, duration
  and difficulty for timed tests, and phrase length for texts. Language stays fixed at `en`.
- `getCachedPassages` is synchronous, so a consumer can inspect memory without waiting on a promise.
- `prefetchPassages` coalesces concurrent requests in a `Map<string, Promise<Passage[]>>`. Callers
  for the same key share one network request.
- Only successful network batches are cached. A failed refresh leaves the previous batch in place.
- `force` bypasses a fresh cache entry for queue refills, but still joins an in-flight request so a
  refill never appends a duplicate of the batch it just consumed.
- Network work is bounded to 10 seconds with one 250 ms retry. A hung request cannot occupy the
  in-flight map indefinitely.

`usePassageQueue` keeps its 1.5-second deadline and local fallback, but now races that deadline
against `prefetchPassages` instead of owning `fetch`. It no longer aborts shared network work; a
shared request can be useful to the next consumer even when this screen has already fallen back.

The hook requests a forced batch. Cache-first rendering is intentionally separate so queue refills
cannot be satisfied by the same cached passages.

## Impact

- Landing and typing consumers can share one network request for the same preferences.
- Repeated batches within five minutes avoid a redundant backend call where a fresh batch is not
  required.
- Deadline fallback is unchanged for the typist, and late responses still populate the cache for the
  next visit.
- No stale response can append to the queue because the existing request-id guard remains in place.

## Files changed

- `frontend/src/services/passageCache.ts` - cache, keys, coalescing, fetch policy, TTL.
- `frontend/src/hooks/usePassageQueue.ts` - uses the cache fetch path and races it against the
  existing deadline.

## Verification

- `npx tsc -b` (green).
- `npm run build` (green).
- `npm run lint` remains at the pre-existing repository baseline.

## Rollback

Revert this commit. Passage fetching returns to `usePassageQueue`, landing cannot share an in-flight
request, and there is no memory cache.
