# Bound passage loading with a deadline and local fallback

**Area:** Frontend (`usePassageQueue`, `api.get`)
**Architecture pattern:** Deadline-bounded remote read with an immediate local fallback
**Status:** Done

## Issue (before)

The first passage request had no end-to-end time bound. `fetchBatch` could wait indefinitely on
`/words` or `/texts`, retried recursively without a time check, and its fallback called the
API-backed `generateTestPassage` again. A slow backend therefore left the typing page on its loading
state with no passage to type.

The fetch also had no cancellation path, so a request that finished after a preference change or
unmount could still append stale passages to the queue.

## Solution (after)

`usePassageQueue` now bounds each batch to 1.5 seconds with an `AbortController`:

- The request is aborted at the deadline and the hook appends a passage from the synchronous local
  generator in `utils/passages.ts`.
- A failed attempt may retry once after 250 ms, but only if enough of the deadline remains.
- Every batch carries a request id. A newer preference change or unmount invalidates the older id
  and aborts its controller, preventing stale queue writes and state updates.
- The existing background refill uses the same bounded path, and `isLoading` clears only when the
  current request has a non-empty queue.

`api.get` accepts optional `RequestInit` as its third argument so callers can pass `signal` without
changing existing two-argument calls.

## Impact

- A slow `/words` or `/texts` request can delay the first passage by at most 1.5 seconds.
- Network failure falls back locally without making a second API attempt.
- Preference changes and unmounts cannot append stale passages or update unmounted state.
- The local fallback is synchronous and does not depend on the backend being reachable.

## Files changed

- `frontend/src/hooks/usePassageQueue.ts` - deadline, retry policy, request guard, local fallback.
- `frontend/src/services/api.ts` - optional `RequestInit` on `api.get`.
- `frontend/src/utils/passages.ts` - existing synchronous generator used as the fallback.

## Verification

- `npx tsc -b` (green).
- `npm run build` (green; the typing route remains a separate lazy chunk).
- `npm run lint` still reports pre-existing repository errors; this change introduces no new lint
  error and removes the existing `usePassageQueue` exhaustive-deps warning.

## Rollback

Revert this commit. Passage batches return to unbounded API calls with the API-backed recursive
fallback and no request cancellation.
