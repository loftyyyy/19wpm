# 56 — Group matchmaking for public races

Public matchmaking could only ever return a pair. Every join triggered a match attempt, so as
soon as a second player entered a queue, the first two arrivals were paired off before the rest
of a group could arrive. Four friends who searched together were split into two separate 1v1
rooms.

## Area and pattern

- **Area:** backend matchmaking policy and the race page's search copy.
- **Pattern:** gather-window batch matching over a skill-clustered queue.
- **Status:** implemented; no database migration.

## Before

`SkillMatchmaker.selectPair` returned exactly two queue indices. `MatchmakingService.joinQueue`
runs a match attempt immediately, so `queue size == 2` matched instantly. The scheduler was a
10-second safety net, reinforcing the pair-first behavior. Race rooms already supported up to
eight participants; only the matcher was pair-only.

## After

`SkillMatchmaker.selectGroup` returns two to five indices, and every matched group is joined to
one room by the existing `createMatchedRoom` path.

| Queue state | Behavior |
|---|---|
| 1 player | Wait. |
| 2–4 players, oldest wait < 3.5 s | Wait for near-simultaneous joins so a group searching together is not split. |
| 2–4 players, oldest wait ≥ 3.5 s | Match everyone waiting as one smaller room. |
| Exactly 5 players | Match all five immediately. |
| More than 5 players, a five-player group is within tolerance | Match the five closest by WPM. |
| More than 5 players, no group is within tolerance | Wait, then force the oldest player plus the four closest after 20 s. |
| Any `matchNow` request | Match the requester immediately with the closest racers, up to five, ignoring tolerance. |

The five-player cap keeps a public race readable and skill-competitive while covering a group
of four friends plus one stranger. The room itself still accepts up to eight players for private
rooms; change `SkillMatchmaker.MAX_GROUP_SIZE` to adjust only public matchmaking.

## Scheduling

The gather window is evaluated from the oldest entry's `enqueuedAt`. Because a partial queue
cannot match on the join that created it, the safety-net sweep moved from 10 seconds to 1 second.
The window is therefore observed within about a second of expiring instead of up to a full poll
later. The per-text-type distributed lock still serializes matching across replicas.

## Verification

```powershell
cd backend
.\mvnw.cmd -q "-Dtest=SkillMatchmakerTest,MatchmakingServiceTest,MatchmakingServiceGroupTest" test
```

`SkillMatchmakerTest` now covers the gather window, four-player grouping, immediate full-group
matching, closest-five selection from a larger queue, the 20-second fallback, and immediate-match
requests. `MatchmakingServiceGroupTest` verifies that a four-player queue creates one room and
joins every player to it.

## Trade-offs

- Two players now wait up to 3.5 seconds before their 1v1 room forms. That is the cost of not
  splitting a larger group whose members join a moment apart.
- A queue of five groups regardless of skill spread: without waiting for a sixth player there
  is no alternative composition.
- A public room still auto-starts five seconds after the second client connects, so a matched
  player who connects very late can miss the start. The existing DNF handling covers that case.

Rollback: restore `selectPair`/`Pair` and the 10-second scheduler interval. No data or schema
changes are involved.
