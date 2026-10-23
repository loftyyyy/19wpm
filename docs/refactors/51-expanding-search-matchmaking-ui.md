# 51 — Matchmaking search feedback and an immediate-match action

The matchmaking screen showed one generic spinner and a 30-second help message. Players could
not tell whether the server was still looking for a close match or had already widened the
search, and they could not trade match quality for a faster start.

## Area and pattern

- **Area:** frontend race matchmaking UI and API client.
- **Pattern:** timed search stages plus an explicit user override.
- **Status:** implemented; no backend schema change.

## Before

While `isMatchmaking` was true, the page rendered `Finding a match...`, the selected text type,
and elapsed seconds. The only explanation appeared after 30 seconds, when it suggested sharing
the lobby URL with a friend. Matchmaking itself widened the WPM tolerance over time and forced a
pair after a deadline, but none of that was visible.

## After

The search panel derives a title and detail line from `matchmakingSeconds`:

| Elapsed | Title | Detail |
|---|---|---|
| 0–4s | Searching for a close match... | Looking within 15 WPM of your pace. |
| 5–19s | Expanding the search... | The WPM range grows the longer you wait. |
| 20s+ | Matching with anyone available... | No close match yet, so the next available racer will be paired with you. |

The 30-second friend-invite hint is hidden once an immediate match has been requested, because
the server is now intentionally ignoring the skill range.

A `Match me with anyone now` button calls `POST /api/v1/race/matchmaking/now` through
`requestImmediateMatch()`. While the request is in flight the button reads `Requesting...`;
after a `202` it becomes disabled and reads `Waiting for any available racer`. The detail line
explains that the skill range is ignored for the next opponent. A failed request shows a retry
message but leaves the player queued.

The cancel path now calls the existing `leaveMatchmaking()` client instead of duplicating the
`fetch` call in the page. The button state and error reset when matchmaking ends, when the
player cancels, and when the page resets for another race, so a new search never starts with a
stale request.

## Trade-offs

- The stage boundaries are client timers, not server state. A match can arrive while the UI is
  still in an earlier stage; the server is authoritative.
- `matchNow` is a one-way flag for the current queue entry. The UI cannot cancel the preference
  without leaving and re-joining the queue.
- A `409` is treated as a generic failure. It can mean the queue entry expired or the lock
  timed out; the player remains queued unless the entry itself expired.
- The button does not make a lone player matchable. It only removes the skill filter for the
  next opponent.

## Verification

```powershell
cd frontend
npm run build
```

The build passes. Matchmaking UI behavior has no component test; it is covered by the build and
manual race-flow verification.

Rollback: revert the service helper and the search/button block in `Race.tsx`. The backend
endpoint can remain without affecting older clients.
