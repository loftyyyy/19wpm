# 49 — Server-authoritative race anti-cheat

Race finishes used to trust the WPM reported by the client. A client could publish any
`finalWpm`, and that value flowed into the room broadcast, `race_results.final_wpm`, and the
winner display. The finish payload now carries keystroke intervals, and the server computes the
persisted WPM from `correctChars` and the room's own race duration.

## Verdict model

`AntiCheatService` returns a verdict with one of three statuses:

- `VALID` — accepted, ranked, persisted, and eligible for streak credit.
- `QUARANTINED` — suspicious but not conclusive; ranked and persisted with flags, but no streak
  credit so a flagged run cannot extend a streak.
- `DISQUALIFIED` — finished for room-lifecycle purposes, but `finishRank = 0`, it does not consume
  a finishing position, and it receives no streak credit.

`serverWpm` is always `round((correctChars / 5) / elapsedMinutes)`, where `elapsed` is measured from
`RaceRoom.startTime` to the server's finish timestamp. The client value is stored separately as
`claimedWpm` for audit.

## Signals

Severe signals produce `DISQUALIFIED`:

- `IMPOSSIBLE_WPM` — server or claimed WPM at or above 300.
- `RACE_TOO_SHORT` — less than 3 seconds elapsed with more than 10 correct characters.
- `IMPOSSIBLE_INTERVAL` — more than 10% of intervals below 10 ms.
- `AUTOMATED_INTERVAL_SIGNATURE` — coefficient of variation below 0.03 over at least 30 intervals.
- `REPETITIVE_INTERVAL_SIGNATURE` — more than 80% of adjacent intervals are identical.

Moderate signals produce `QUARANTINED`:

- `HIGH_WPM` — server WPM at or above 220 (but below the severe threshold).
- `WPM_MISMATCH` — claimed WPM is more than 25 above the server value and more than 25% higher.
- `MISSING_KEYSTROKE_TELEMETRY` — fewer than 10 intervals at 150 WPM or above.
- `LOW_INTERVAL_VARIANCE` — coefficient of variation below 0.08 over at least 30 intervals.
- `REPETITIVE_INTERVALS` — more than 65% of adjacent intervals are identical.

Intervals are capped at 2,000 entries server-side. Absent or short telemetry alone is not evidence
of cheating: a slow finish with no intervals stays `VALID`.

## Persistence and protocol

`FinishMessageDTO` adds `List<Integer> keyIntervalsMs`; older clients that omit it still deserialize
with `null` and are judged on server WPM alone. `RaceParticipant` gains `serverWpm`, `claimedWpm`,
`antiCheatStatus`, and `antiCheatFlags`, all serialized to clients. `V12` adds
`claimed_wpm`, `server_wpm`, `anti_cheat_status`, and `anti_cheat_flags` to `race_results`, and
backfills existing rows from `final_wpm`.

The frontend records non-repeat printable `keydown` intervals with `performance.now()` in the race
input and sends them with the finish message. A pending finish that cannot be sent immediately
(retry queue) retains its intervals. `RaceResults` renders disqualified rows as `DQ` and sorts them
after ranked participants.

## Trade-offs

- Thresholds are heuristics. A very fast legitimate typist can be quarantined; the flag set is
  persisted for later review, and quarantine preserves the rank.
- `WPM_MISMATCH` compares client word-based WPM with server character-based WPM. Texts dominated by
  one- and two-letter words could widen that gap; normal race passages keep it well inside 25%.
- There is no review queue yet. Quarantined and disqualified rows are visible in the database with
  `anti_cheat_status` and `anti_cheat_flags`.
- Disconnect-driven finishes bypass `AntiCheatService` because there is no finish payload to assess;
  they remain unranked DNFs.

Verification: `.\mvnw.cmd -q -Dtest=AntiCheatServiceTest test` (6 tests), `.\mvnw.cmd -q -DskipTests
test-compile`, and `npm run build` are green.
