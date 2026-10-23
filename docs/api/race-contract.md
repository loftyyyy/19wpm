# Race REST and STOMP contract

This document is the client-facing contract for multiplayer races as of Phase 9
(2026-10-23). It covers HTTP room/matchmaking endpoints, the STOMP destinations, the
payload shapes, and the anti-cheat fields a client may receive. The implementation is the
source of truth; this document records what clients can rely on.

Related documents:

- [Server-authoritative anti-cheat](../refactors/49-server-authoritative-anti-cheat.md)
- [Distributed race operations runbook](../runbooks/distributed-race-operations.md)
- [Race room store seam](../refactors/17-race-room-store-seam.md)

## Transport and authentication

| Item | Value |
|---|---|
| HTTP base path | `/api/v1` |
| Race REST base path | `/api/v1/race` |
| HTTP auth | `Authorization: Bearer <access-token>` |
| WebSocket endpoint | `/ws` (SockJS) |
| STOMP endpoint | `/app` (client to server), `/user` (server to one user), `/topic` (broadcast) |
| STOMP auth | `token: <access-token>` native header on `CONNECT` |
| SockJS heartbeat | 25 s |
| Allowed origins | All (`setAllowedOriginPatterns("*")`) |

The HTTP upgrade to `/ws` is permitted by Spring Security, but the STOMP `CONNECT` frame
is not. A missing, expired, malformed, or non-access token is rejected before the session
can subscribe or send. The token is validated once at `CONNECT`; it is not revalidated on
every subsequent frame, so an access token that expires mid-session stays usable until the
socket closes. Clients must reconnect with a fresh access token after a disconnect.

The frontend uses the SockJS WebSocket transport URL
`ws://127.0.0.1:8080/ws/websocket` locally. In production the same path is used behind the
Container Apps ingress with TLS (`wss://`). Do not assume a bare WebSocket URL without the
SockJS transport suffix.

## REST endpoints

All request and response bodies are JSON unless noted. `text/plain` responses are literal
room codes or status strings, not quoted JSON strings.

| Method | Path | Request body | Success | Errors |
|---|---|---|---|---|
| `POST` | `/api/v1/race/rooms` | `CreateRoomRequestDTO` | `201`, `text/plain` 6-character room code | `400`, `401` |
| `POST` | `/api/v1/race/rooms/{code}/join` | none | `200`, `RaceRoom` | `400` (room full), `401`, `404` |
| `GET` | `/api/v1/race/rooms/{code}` | none | `200`, `RaceRoom` | `401`, `404` |
| `POST` | `/api/v1/race/matchmaking/join` | `{ "textType": "SHORT" }` | `200`, `text/plain` `Searching...` | `400`, `401` |
| `POST` | `/api/v1/race/matchmaking/now` | none | `202`, `text/plain` `Waiting for any opponent...` | `401`, `409` when not queued |
| `POST` | `/api/v1/race/matchmaking/leave` | none | `200` empty body | `401` |
| `GET` | `/api/v1/race/matchmaking/pending` | none | `200`, `text/plain` room code | `204` when no match, `401` |

`CreateRoomRequestDTO`:

```json
{
  "textType": "SHORT",
  "isPrivate": false
}
```

- `textType` is one of `SHORT`, `MEDIUM`, `LONG`, `THICC`. `null` lets the server pick.
- `isPrivate` defaults to `false` when omitted. It controls the idle TTL: private rooms get
  30 minutes, public rooms get 10 minutes.
- A room created through this endpoint always records the caller as `hostUserId`, including
  when `isPrivate` is `false`. Only `hostUserId: null` marks a room as hostless; that happens
  for matchmaking-created rooms. The distinction matters for who may start the race.
- Room codes are six uppercase alphanumeric characters.

Matchmaking is skill-based. The queue payload only carries the text type; the server
resolves the player's average WPM and accuracy from stored stats, with defaults of 50 WPM
and 90% for new players. Pairing happens on join, with a 10-second safety-net sweep. Two
players pair immediately; a queue of three to five players force-pairs after 5 seconds when
no pair is within the WPM tolerance; larger queues keep the 20-second fallback.

`POST /matchmaking/now` marks the caller's queued entry as willing to match with anyone. The
server still pairs immediately when possible and honors a lone request when the next player
joins. The flag does not reset the queue timer and expires with the five-minute queue entry.
`409` means the caller has no live queue entry, or the queue lock timed out; retry after
joining.

`GET /matchmaking/pending` is a consuming read: when it returns a code, the pending entry
is deleted, so a retry can return `204`.

Errors use the global handler shape:

```json
{
  "error": "Forbidden",
  "message": "Only the room creator can start the race"
}
```

Status meanings used by race endpoints:

- `400` - invalid state or request (for example, fewer than two connected players when
  starting).
- `401` - missing or invalid bearer token.
- `403` - authenticated user is not allowed to perform the action.
- `404` - room or participant not found.
- `409` - duplicate resource, or an immediate-match request with no live queue entry.

## `RaceRoom` snapshot

Every full snapshot has this shape. `private` is the JSON name of the Java `isPrivate`
property; clients should read `private`, not `isPrivate`.

```json
{
  "roomCode": "A1B2C3",
  "state": "LOBBY",
  "private": false,
  "textType": "SHORT",
  "text": {
    "textId": 12,
    "isCustom": false,
    "createdBy": null,
    "title": "A short passage",
    "author": null,
    "source": null,
    "language": "english",
    "content": "The passage the players type...",
    "wordCount": 40,
    "charLength": 210,
    "createdAt": "2026-10-01T12:00:00",
    "updatedAt": "2026-10-01T12:00:00"
  },
  "hostUserId": null,
  "participants": [],
  "startTime": null,
  "finishCount": 0,
  "countdownStartTime": null,
  "countdownDurationMs": 0,
  "durationSeconds": 0
}
```

| Field | Notes |
|---|---|
| `state` | `LOBBY`, `COUNTDOWN`, `RACING`, or `FINISHED`. |
| `private` | Public matchmaking rooms and quick races are `false`; private code rooms are `true`. |
| `text` | Immutable passage snapshot. The durable room stores only `textId` and rehydrates this from the text catalogue. |
| `hostUserId` | Set for REST-created rooms (even public ones); `null` for matchmaking rooms, which any authenticated caller may start. |
| `startTime` | Server instant when `RACING` began. The anti-cheat WPM denominator is measured from this. |
| `finishCount` | Number of ranked finishes. Disqualified finishes do not increment it. |
| `countdownStartTime` / `countdownDurationMs` | Server-authoritative countdown window; the production duration is 3500 ms. |
| `durationSeconds` | Set when the room reaches `FINISHED`. |

`startTime`, `countdownStartTime`, and `createdAt`/`updatedAt` are ISO-8601 strings in the
serialized payload; the exact precision is Jackson's default for `Instant`/`LocalDateTime`.

## `RaceParticipant` shape

```json
{
  "userId": 42,
  "username": "ada",
  "ready": false,
  "finished": true,
  "disconnected": false,
  "connected": true,
  "progressPercent": 100.0,
  "currentWpm": 84,
  "errors": 3,
  "correctChars": 210,
  "accuracy": 99,
  "finishRank": 1,
  "serverWpm": 84,
  "claimedWpm": 92,
  "antiCheatStatus": "VALID",
  "antiCheatFlags": []
}
```

- `sessionId` and `latestStreak` are `@JsonIgnore` and never appear on the wire.
- Before a finish, `currentWpm` is the client-reported live WPM from progress ticks and
  `serverWpm`/`claimedWpm` are `0`.
- After a finish, `currentWpm` is overwritten with `serverWpm`. `claimedWpm` is retained for
  audit only.
- `accuracy` is `round(correctChars * 100 / (correctChars + errors))`, or `0` when there
  are no characters.
- `antiCheatFlags` is an array; it is empty for a clean finish. Flags are stable string
  identifiers, not user-facing text.
- A disqualified participant keeps `finished: true` and `progressPercent: 100.0` so the
  room can complete, but has `finishRank: 0` and is ordered last by the results view.

## State machine

```text
LOBBY --start--> COUNTDOWN --server deadline--> RACING --all active finished--> FINISHED
                                                        \--disconnect finishes----^
```

- `LOBBY`: joins are accepted up to eight participants. The room can be started once at
  least two participants are connected. Start is rejected with `400` for fewer than two
  connected participants and `403` when the caller is not the host of a hosted room.
- `COUNTDOWN`: no new joins are added. The server writes the deadline to the
  `race:countdown` sorted set; any replica may perform the transition when it is due.
- `RACING`: progress and finish frames are accepted. Joining is idempotent but does not
  add a new participant.
- `FINISHED`: terminal. The room remains readable until its Redis TTL expires; results are
  persisted to PostgreSQL when the room finishes.

## Client-to-server STOMP frames

All destinations are prefixed with `/app`. All payloads are JSON except where noted.
Subscribe to the corresponding server destinations before publishing the first frame.

### Time sync

| Destination | Payload | Response |
|---|---|---|
| `/app/time` | `{ "clientSentAt": 1760000000000 }` | `/user/queue/time` |

```json
{
  "clientSentAt": 1760000000000,
  "serverReceivedAt": 1760000000012,
  "serverSentAt": 1760000000012
}
```

The frame relies on the authenticated STOMP session and takes no token in its body. Clients
should keep the lowest-round-trip sample and use it to correct countdown rendering.

### Join or reconnect

| Destination | Payload |
|---|---|
| `/app/room/{code}/join` | `{}` |

Semantics:

- Idempotent for an existing participant in `LOBBY`. A non-participant is added only in
  `LOBBY` and only while the room has fewer than eight participants; otherwise the
  participant list is unchanged. A non-participant who joins a started race receives the
  current snapshot but is not added and cannot send progress or finish.
- For an existing participant, marks them connected, updates the session id, and clears the
  disconnected flag. The room code is recorded in the WebSocket session attributes; a
  session is associated with one room at a time.
- Broadcasts the full room to `/topic/room/{code}` and sends a targeted full snapshot to
  the caller on `/user/queue/race-resume`.
- Clients must call this after every reconnect, even if they already have a room snapshot.

### Start

| Destination | Payload |
|---|---|
| `/app/room/{code}/start` | `{}` |

- Hosted room (`hostUserId` set): only that user may start. This includes REST-created rooms
  with `private: false`.
- Hostless room (`hostUserId: null`, created by matchmaking): any authenticated caller may
  start; in practice the matched clients are the callers.
- Requires at least two connected participants.
- For a caller allowed to start, if the room is not in `LOBBY` the call is a no-op and still
  rebroadcasts the room. The host check runs first, so a non-host still receives `403`.
- On success the server broadcasts `COUNTDOWN` and schedules the transition. The client
  must not start typing until it receives `RACING` with `startTime`.

### Progress

| Destination | Payload |
|---|---|
| `/app/room/{code}/progress` | `{ "progressPercent": 42.5, "currentWpm": 76, "errors": 2 }` |

- Accepted only in `RACING`; otherwise the server raises an error.
- The caller must be a participant in the room.
- `errors` is the cumulative incorrect-keystroke count, matching practice mode; it does
  not roll back when a mistake is corrected.
- The server stores the values and broadcasts a delta on
  `/topic/room/{code}/progress`. It does not echo a full room snapshot per tick.
- Progress is advisory and client-reported. The server never uses it to rank a finish.

### Finish

| Destination | Payload |
|---|---|
| `/app/room/{code}/finish` | `{ "finalWpm": 92, "errors": 3, "correctChars": 210, "keyIntervalsMs": [120, 98, 105] }` |

- Accepted only in `RACING`; otherwise the server raises an error.
- The caller must be a participant. A second finish from the same participant is ignored.
- `finalWpm` is retained as `claimedWpm` for audit. Ranking uses `serverWpm`, computed from
  `correctChars` and the server-observed elapsed time since `startTime`.
- `keyIntervalsMs` is optional at the JSON level, but omitting it (or sending fewer than 10
  samples) when the server computes at least 150 WPM adds `MISSING_KEYSTROKE_TELEMETRY`.
  Send the real inter-key intervals; the server analyzes at most the first 2000.
- On success the server broadcasts the full room and, for a `VALID` finish with a streak,
  sends `/user/queue/race-finish`.

The anti-cheat summary is covered below; the thresholds and rationale are in the
[anti-cheat write-up](../refactors/49-server-authoritative-anti-cheat.md).

## Server-to-client STOMP frames

| Destination | Payload | When |
|---|---|---|
| `/topic/room/{code}` | `RaceRoom` | Join, start, transition to `RACING`, finish, disconnect-driven finish. |
| `/topic/room/{code}/progress` | `{ "userId": 42, "progressPercent": 42.5, "currentWpm": 76, "errors": 2 }` | Each accepted progress tick. |
| `/user/queue/time` | `{ "clientSentAt", "serverReceivedAt", "serverSentAt" }` | Reply to `/app/time`. |
| `/user/queue/race-resume` | `RaceRoom` | After a successful join/reconnect. |
| `/user/queue/race-finish` | `{ "streak": 7 }` | After a `VALID` finish when a streak value is available. |
| `/user/queue/matchmaking` | `"A1B2C3"` (plain text body) | When matchmaking creates a room for the user. |

Delivery notes:

- The Spring broker is process-local. In a multi-replica deployment, `RaceEventBus` copies
  room broadcasts and targeted race/matchmaking messages through Redis Pub/Sub
  (`race:events`) so sessions attached to other replicas receive them. Direct replies such
  as `/user/queue/time` stay on the originating session. Clients do not need sticky sessions.
- Full snapshots are authoritative. Progress deltas are best-effort and can arrive out of
  order relative to deltas published by another replica; merge them into the latest
  snapshot and do not use them to reconstruct the room.
- `/user/queue/matchmaking` uses `SimpMessagingTemplate.convertAndSendToUser`, so the body
  is the raw code string; it is not JSON-encoded. `/user/queue/race-finish` is JSON.
- STOMP handler failures are delivered as STOMP `ERROR` frames and may close the
  connection, depending on the failure. There is no stable structured error body yet;
  clients should surface the message, refresh the room over REST, and rejoin.

## Anti-cheat fields

`antiCheatStatus` is one of:

| Status | Ranking | Streak | Meaning |
|---|---|---|---|
| `VALID` | Ranked | Credited | No severe or moderate signal. |
| `QUARANTINED` | Ranked | Not credited | At least one moderate signal; result is kept and flagged. |
| `DISQUALIFIED` | Not ranked (`finishRank: 0`) | Not credited | At least one severe signal; `finishCount` is not incremented. |

Flags are subsets of:

| Severe (`DISQUALIFIED`) | Moderate (`QUARANTINED`) |
|---|---|
| `IMPOSSIBLE_WPM` | `HIGH_WPM` |
| `RACE_TOO_SHORT` | `WPM_MISMATCH` |
| `IMPOSSIBLE_INTERVAL` | `MISSING_KEYSTROKE_TELEMETRY` |
| `AUTOMATED_INTERVAL_SIGNATURE` | `LOW_INTERVAL_VARIANCE` |
| `REPETITIVE_INTERVAL_SIGNATURE` | `REPETITIVE_INTERVALS` |

Severe flags are listed first, followed by non-duplicate moderate flags. A disconnect that
ends a race bypasses anti-cheat and remains an unranked did-not-finish; it is not a
disqualification.

## Compatibility

- New fields are additive. Clients must ignore unknown fields and unknown
  `antiCheatStatus` values rather than failing to parse.
- `keyIntervalsMs` is optional for backward compatibility, but new clients should always
  send it.
- The durable result schema (`V12`) is additive: `claimed_wpm`, `server_wpm`,
  `anti_cheat_status`, and `anti_cheat_flags`. Older clients are unaffected because those
  fields are only exposed through race snapshots and history responses.
- There is no explicit API version negotiation beyond the `/api/v1` path. Treat this
  document as the current contract and check the code when in doubt.

## Known gaps

- `MatchmakingService.createMatchedRoom` creates the room and then joins each matched
  player. If one join fails, the exception propagates and a one-participant room can be
  left behind. The pending code is already written, so a client may still fetch it.
- STOMP errors do not have a documented machine-readable envelope.
- Access-token revocation is not rechecked per frame; closing the socket is the reliable
  revocation point.
