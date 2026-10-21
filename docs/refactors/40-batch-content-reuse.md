# Refactor 3.3 — Reuse the existing count-based batch content endpoints

**Area:** Content API (`WordController`, `TextController`, frontend passage cache)
**Architecture pattern:** Batch retrieval over an existing parameterized read endpoint
**Status:** Done (verified, no new endpoint)

## Bottleneck / anti-pattern (before)

The performance plan called for batch word/text retrieval so the typing page could fill several
passages per request instead of issuing one request per passage. Before adding a new `/batch`
route, the existing API surface was audited.

Both random-content endpoints already accept a `count` parameter:

| Endpoint | Parameters | Service method |
| --- | --- | --- |
| `GET /api/v1/words` | `language`, `difficulty`, `count` | `WordService.getRandomWords` |
| `GET /api/v1/texts` | `language`, `textType`, `count` | `TextService.getRandomTexts` |

The frontend was also already using them as batches: `passageCache.ts` requests
`wordCount * 5` words for word mode and `count=5` texts for phrase mode, then slices the response
into passages locally.

## Decision

Do **not** add a separate batch endpoint. A new route would duplicate the same query, validation,
and sampling logic while splitting the API contract across two paths.

The existing endpoints are the batch contract:

- `GET /api/v1/words?...&count=500` returns up to 500 distinct sampled words, which the client chunks
  into five 100-word passages.
- `GET /api/v1/texts?...&count=5` returns five distinct sampled texts for the phrase queue.
- Both validate `count > 0` and reject a request larger than the available pool.
- Both random paths use the indexed offset sampling from
  [`38-ordered-random-sampling.md`](38-ordered-random-sampling.md); the word path is served from the
  cached pool from [`39-word-pool-cache.md`](39-word-pool-cache.md).

This keeps one canonical random-content API and lets the client cache layer batch aggressively
without a backend contract change.

## Architecture pattern

- **Batch over a parameterized read:** a single indexed query returns `count` sampled rows. The
  client decides how to group that response into user-facing passages, so batching remains a client
  concern and the backend stays stateless.

## Notes / trade-offs

- The response is bounded by `count`; there is no unbounded "return everything" batch variant.
- Distinctness is guaranteed inside one response because the database page contains distinct rows.
  Separate requests may overlap, which is acceptable for a typing pool.
- Existing limits are unchanged: the request fails with `InvalidResourceException` when `count`
  exceeds the available words/texts.

## Files changed

- None (verification and documentation only).

## Verification

- `RandomContentIntegrationTest` covers both batch paths:
  - `returnsRequestedNumberOfDistinctWords` (`count = 3`).
  - `rejectsWordCountAboveAvailablePool` (`count = 6` with 5 available).
  - `returnsRequestedNumberOfDistinctTexts` (`count = 2`).
- Targeted run: 6 tests, 0 failures, 0 errors.
- The frontend batch sizes were confirmed in `frontend/src/services/passageCache.ts`.

## Rollback

No runtime change to revert. Delete this document if the API is later consolidated.
