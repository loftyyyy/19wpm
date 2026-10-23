# 50 — Queue-size-aware matchmaking and immediate matches

Matchmaking optimized for match quality, but it treated every queue the same. A third player
joining a sparse queue made the only two players wait for the 20-second fallback, and a player
who cared more about starting than about skill proximity had no way to say so.

## Area and pattern

- **Area:** backend matchmaking policy and queue mutation.
- **Pattern:** deadline-bounded sparse-queue pairing plus a persisted player preference.
- **Status:** implemented; no database migration.

## Before

`SkillMatchmaker` had one fallback deadline, `FORCE_PAIR_AFTER_MS = 20_000`. Two players were
paired immediately only if their WPM gap was within the base tolerance. If a third player
joined, the closest pair was still selected first; if no pair was eligible, everyone waited
until the oldest entry reached 20 seconds. The client had no way to request a faster,
lower-quality match.

## Queue-size policy

`SkillMatchmaker` now chooses the fallback deadline from the queue size:

| Queue size | Behavior |
|---|---|
| 2 | Pair immediately, regardless of WPM gap. There is no third candidate to wait for. |
| 3–5 | Prefer an eligible pair, then force-pair the oldest two after 5 seconds. |
| 6+ | Keep the existing 20-second fallback so a larger queue can find a closer pair. |

The eligibility pass still runs first. The deadline only applies when no pair is within the
current WPM tolerance, so increasing queue size never makes a good match wait longer.

## Immediate-match request

`MatchmakingEntry` adds a persisted `matchNow` boolean. `POST
/api/v1/race/matchmaking/now` marks the caller's queued entry and runs matching under the same
per-text-type lock. The flag does not reset `enqueuedAt` and survives until the next player
joins, so a lone player's request is honored later.

A flagged entry is paired before normal tolerance checks. It chooses the closest available
opponent rather than whichever entry happens to be first. If the player is the only entry,
matching returns no pair and the flag remains set.

The service replaces the exact serialized queue entry with a small Lua script instead of
using a list index. A concurrent `LPUSH` can shift indices between a read and a write; the
script finds the old value and `LSET`s it atomically. Matching also moved into a
`matchQueued` helper, because `RedisLock` is not reentrant and `requestImmediateMatch` already
holds the queue lock.

The endpoint returns `202` with `Waiting for any opponent...` when the request is accepted and
`409` with `Not queued for matchmaking` when the caller has no live queue entry. A lock timeout
is logged and also returns `409`; the client can retry. It does not delete the presence key,
because the player may have left and re-queued between the presence read and the lock.

## Trade-offs

- Immediate match gives up skill proximity by design. The UI labels the action as matching with
  anyone.
- A 5-second sparse-queue deadline trades some match quality for a noticeably faster start.
  Larger queues keep the 20-second window.
- The `matchNow` flag is stored in the same JSON entry as the queue profile. Older code should
  ignore the unknown field, but rolling back while queues are populated is not a supported
  cross-version contract; clear matchmaking keys if the old image cannot read them.
- The existing `createMatchedRoom` partial-failure gap is unchanged: a failed room join can
  still leave a one-participant room.

## Verification

```powershell
cd backend
.\mvnw.cmd -q -Dtest=SkillMatchmakerTest test
.\mvnw.cmd -q -DskipTests test-compile
```

`SkillMatchmakerTest` covers immediate two-player pairing, the 5-second sparse deadline, the
20-second large-queue deadline, tolerance growth, immediate-match selection, and singleton
queues.

Rollback: remove the endpoint and revert the matcher thresholds and `matchNow` handling. No
migration is involved.
