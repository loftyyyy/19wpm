# Distributed race operations runbook

This runbook covers operating the Redis-backed multiplayer race stack introduced in Phase 9:
distributed room state, cross-replica STOMP fan-out, replica-safe countdowns, skill-based
matchmaking, and server-side anti-cheat. It is written for the current deployment
(`deploy/container-app.yaml`) and the shared PostgreSQL + Redis dependencies.

Related documents:

- [Race REST and STOMP contract](../api/race-contract.md)
- [Race room store seam](../refactors/17-race-room-store-seam.md)
- [Matchmaking event-driven design](../refactors/11-matchmaking-event-driven.md)
- [Server-authoritative anti-cheat](../refactors/49-server-authoritative-anti-cheat.md)

## Architecture in one page

- Live race rooms are stored in Redis under `race:room:{code}` as `PersistedRaceRoom`
  JSON. The passage is stored by `textId`, not embedded, and is rehydrated from the text
  catalogue with a Caffeine cache.
- Every room mutation is serialized cluster-wide with a Redis lock
  (`race:lock:{code}`, 5 s TTL, 2 s wait). The room is re-read inside the lock, changed,
  saved, and the lock is released with compare-and-delete Lua.
- The countdown deadline is a member of the `race:countdown` sorted set. Any replica polls
  the set every 500 ms; exactly one removes the due member and transitions the room under
  the room lock. A replica crash does not strand a countdown.
- Each replica has a process-local Spring STOMP simple broker. `RaceEventBus` delivers a
  broadcast locally and publishes it on Redis Pub/Sub `race:events`; peers deliver it to
  their own sessions. The originating instance ignores its own echo by instance id.
- Matchmaking queues are Redis lists keyed by text type, with a per-player presence key,
  a pending-room key, and a per-text-type distributed lock. Two-player queues pair
  immediately; queues of three to five use a 5-second fallback and larger queues use 20
  seconds. A persisted `matchNow` flag lets a player request any available opponent.
- Race results are persisted to PostgreSQL when the room reaches `FINISHED`. Redis rooms
  are ephemeral and expire.

## Prerequisites and configuration

All replicas must share:

| Requirement | Why |
|---|---|
| The same Redis logical database | Rooms, locks, countdowns, queues, pending codes. |
| The same PostgreSQL database | Results, race sessions, stats, streaks. |
| The same `JWT_SECRET` | A token minted by one replica must validate on another. |
| Flyway `V12` applied | `race_results` audit columns must exist before new code writes them. |
| Ingress WebSocket support | `/ws` must upgrade; `transport: auto` in the manifest is correct. |
| Idle timeout greater than the 25 s heartbeat | Prevent proxies from trimming idle race sockets. |

Session affinity/sticky sessions are **not required**. A client may reconnect to a
different replica; it rejoins the room and receives `/user/queue/race-resume`. Affinity is
harmless but does not replace shared Redis.

The current manifest intentionally remains at `minReplicas: 1` / `maxReplicas: 1`.
Phase 9 removes the code blockers; changing the replica count is a separate, explicit
operator change, not part of the application rollout.

## Redis key inventory

| Key | Type | TTL | Purpose / owner |
|---|---|---|---|
| `race:room:{code}` | String (JSON) | 10 min public, 30 min private, refreshed on every save | `RaceRoomRepository`; live room snapshot. |
| `race:lock:{code}` | String | 5 s | `RedisLock` via `RedisRaceRoomStore`; mutation mutual exclusion. |
| `race:countdown` | Sorted set | No key TTL | `RaceCountdownScheduler`; member `roomCode`, score = due time in epoch ms. |
| `race:events` | Pub/Sub channel | n/a | `RaceEventBus`; cross-replica STOMP fan-out. |
| `matchmaking:queue:{TYPE}` | List (JSON entries) | No key TTL; entries pruned after 5 min | `MatchmakingService`; oldest-first after the loader reverses the newest-first list. Entries may carry `matchNow: true`. |
| `matchmaking:player:{userId}` | String (`TYPE`) | 5 min | Presence/queue membership; blocks duplicate joins. |
| `matchmaking:pending:{userId}` | String (`roomCode`) | 2 min | Consumed once by `GET /api/v1/race/matchmaking/pending`. |
| `matchmaking:lock:{TYPE}` | String | 10 s | `RedisLock` around pairing and dequeue. |

`race:room` TTL is refreshed by each successful mutation, including progress ticks, so an
active room stays alive while players are sending progress. A room with no activity expires
and its clients receive `404`; there is no archive in Redis.

Do not use `KEYS *` in production. Use `SCAN` with a pattern, or `redis-cli --scan`.

## Health and observability

| Check | Expected |
|---|---|
| `GET /actuator/health` | `status: UP`. Production sets `show-details=never`, so component details are not returned; a dependency failure surfaces as overall `DOWN`. |
| `GET /actuator/health/liveness` | `UP` while the process is alive. |
| `GET /actuator/health/readiness` | `UP` when the application is ready to serve. |
| `GET /actuator/prometheus` | Metrics; requires authentication because only health is permitted anonymously. |
| `PUBSUB NUMSUB race:events` | Subscriber count should equal the number of live replicas. |
| `SCAN 0 MATCH race:room:* COUNT 100` | Active room keys; inspect TTLs for leaks. |
| `ZRANGE race:countdown 0 -1 WITHSCORES` | Only imminent/active countdowns; due members should be removed within ~500 ms. |

Logs to search:

- `Room {code} entering COUNTDOWN` - start accepted.
- `Room {code} transitioned to RACING` - countdown settlement.
- `Could not transition room {code} to RACING` - room missing/lock/Redis error.
- `Matched {n} players into room {code}` - matchmaking success.
- `Could not acquire matchmaking lock` / `Timed out acquiring lock` - contention or Redis
  latency.
- `Failed to publish race event` / `Failed to process race event` - Pub/Sub bridge degraded.

Telemetry is emitted through Actuator, Prometheus, and OTLP according to
`application-prod.properties`. Verify the `OTEL_*` environment variables on the Container
App; the defaults point at `localhost:4318`, and collectors are not provisioned by this
repository.

## Deployment and rollback

### Before deploying

1. Confirm PostgreSQL and Redis are reachable from the new revision and use the same
   logical database as the current revision.
2. Confirm `JWT_SECRET` is unchanged. Rotating it during a race rollout logs everyone out
   and invalidates in-flight reconnect attempts.
3. Confirm Flyway migrations through `V12` are present in the image. The app runs Flyway on
   startup; the migration is additive and backfills
   `claimed_wpm`/`server_wpm` from `final_wpm` and sets `anti_cheat_status = 'VALID'`.
4. Build and publish the image, then render the manifest with `deploy/render.ps1` and the
   expected environment variables. Never commit the rendered file.

### Deploy

`activeRevisionsMode: Single` means a deployment creates a new revision and shifts traffic
to it; old WebSocket sessions are dropped. That is acceptable because clients rejoin and
resume from Redis. Brief countdown/room events may need a REST refresh (`GET
/api/v1/race/rooms/{code}`) if a client misses a lifecycle broadcast.

For a blue/green rollout, switch the revision mode to `Multiple` and split traffic, but
that is an infrastructure change outside this runbook. Do not assume zero-downtime
WebSocket handover in `Single` mode.

The Azure revision restart API has returned `500` in this environment. To restart, deploy a
new revision (image or template change) rather than relying on a restart call.

### Scaling above one replica

This is supported by the Phase 9 code path when the prerequisites above are met:

1. Keep `minReplicas: 1` to avoid cold starts unless cost/availability policy says
   otherwise.
2. Raise `maxReplicas` above 1 in the manifest (or via the Container App scale settings).
3. Ensure the ingress idle timeout exceeds the 25 s heartbeat and that WebSocket upgrades
   are allowed. `transport: auto` is already set.
4. Roll out, then verify `PUBSUB NUMSUB race:events` equals the replica count.
5. Run the two-client verification below, ideally with clients landing on different
   replicas (scale to 2 and connect from separate networks/devices).

No room-to-replica routing is required. Do not add sticky sessions as a substitute for
shared Redis.

### Rollback

1. Scale back to one replica **before** rolling back to a pre-Phase-9 image. Older code
   keeps rooms in process memory and assumes a single instance.
2. Deploy the previous image. `V12` is additive, so the old application can ignore the new
   columns; do not drop them during an incident.
3. Redis state is not a cross-version contract. If the previous image cannot read the new
   room or matchmaking JSON, clear the ephemeral keys and let players re-create/rejoin:
   - `SCAN`/delete `race:room:*`, `race:countdown`, and `race:lock:*`.
   - Delete `matchmaking:queue:*`, `matchmaking:player:*`, `matchmaking:pending:*`, and
     `matchmaking:lock:*`.
   Deleting active rooms ends those races without a persisted result. Announce this before
   doing it.
4. Confirm health and a single-replica race before restoring traffic.

## Verification after deployment

1. `GET /actuator/health` reports `status: UP`; logs show no Redis or database health
   failures. Component details are hidden in production.
2. Create a private room over REST; the response is a six-character code.
3. Join with a second authenticated session over STOMP; both sessions receive the full
   room on `/topic/room/{code}` and each receives `/user/queue/race-resume`.
4. Start from the host. Both see `COUNTDOWN`, then `RACING` with the same `startTime`.
   `ZRANGE race:countdown 0 -1 WITHSCORES` no longer contains the room once it transitions.
5. Send progress from one client and confirm the other receives
   `/topic/room/{code}/progress`; Redis `TTL` on the room key remains positive.
6. Finish both clients. Confirm the room becomes `FINISHED`, results appear in PostgreSQL,
   and a clean run is `VALID`.
7. Join matchmaking with two users. Confirm they pair immediately with a shared room code,
   pending codes are readable once, and the matchmaking keys are removed. With three users,
   confirm `POST /api/v1/race/matchmaking/now` returns `202` and pairs the requester without
   waiting for the 5-second sparse-queue deadline; a user who is not queued gets `409`.
8. With two replicas, repeat steps 2-7 and confirm cross-replica delivery. Check
   `PUBSUB NUMSUB race:events` and the replica logs for Pub/Sub warnings.

## Incident procedures

### Redis unavailable or degraded

Symptoms: room REST calls return `500`, STOMP `CONNECT`/joins fail, matchmaking logs lock
timeouts, `/actuator/health` flips to `DOWN` (component details are hidden in production),
and `RedisConnectionFailureException` appears in logs.

1. Confirm the Redis endpoint, TLS, password, and logical database from the Container App
   configuration.
2. Check Redis latency and connection limits. The application uses a 2 s command/connect
   timeout, a Lettuce pool of 8, and Hikari-independent Redis connections.
3. Do not delete locks while Redis is failing; the TTL is the safety net.
4. Once Redis recovers, rooms that were never persisted are gone. Clients should refresh
   with `GET /rooms/{code}`; if `404`, recreate the room. Finished results already written
   to PostgreSQL are unaffected.
5. If Redis data loss is confirmed, clear the matchmaking keys before players retry so
   presence keys do not block re-queueing.

### Countdown stuck in `COUNTDOWN`

1. Inspect the room:
   ```text
   GET race:room:{code}
   ZSCORE race:countdown {code}
   GET race:lock:{code}
   ```
2. If the score is in the past and the member still exists, the scheduler should settle it
   on the next 500 ms poll. Check for `Could not transition` warnings; a missing room key
   or a lock timeout is the usual cause.
3. If the member was lost while the room is still `COUNTDOWN`, re-add a due member to let a
   replica perform the normal transition:
   ```text
   ZADD race:countdown <now-minus-1000-ms> {code}
   ```
   Confirm the room key exists and its `state` is `COUNTDOWN` first. Do not run this against
   a `RACING`/`FINISHED` room.
4. If the room key is corrupt or missing, there is no result to recover. Delete
   `race:room:{code}` and `race:countdown` member, then have clients recreate the room.
5. Avoid manually deleting `race:lock:{code}`. It expires in 5 s; deleting it can allow two
   replicas to mutate the same room concurrently.

### Matchmaking stuck, duplicate, or one-sided match

1. Inspect:
   ```text
   LRANGE matchmaking:queue:{TYPE} 0 -1
   GET matchmaking:player:{userId}
   GET matchmaking:pending:{userId}
   PTTL matchmaking:lock:{TYPE}
   ```
2. Prefer the application path: `POST /api/v1/race/matchmaking/leave`, then join again.
   `leaveQueue` takes the same distributed lock and removes the user's serialized entries.
   If players are waiting but not paired, `POST /api/v1/race/matchmaking/now` sets the
   requester's `matchNow` flag and retries matching under the queue lock.
3. If the presence key exists but the queue entry does not, call leave and rejoin; a stale
   presence key also expires after 5 minutes.
4. A pending code is single-use. If the client lost it, the match already exists; both
   players can join the room code directly if it is known, otherwise leave and re-queue.
5. Known gap: if `createMatchedRoom` fails after creating the room, one player can be left
   in a one-participant room. Treat this as a lost match: leave the queue, delete the
   partial room key only after confirming no active race, and re-queue. A future fix should
   clean up the room transactionally.

### Participant appears connected after a replica crash

A graceful socket close marks the participant `disconnected` and can finish the room. A hard
replica/pod death cannot deliver the close event, so the participant may remain
`connected`/`disconnected: false` until the room expires. If the room then cannot reach
`allActiveFinished`, it remains `RACING` until TTL.

1. Check the participant's `connected`, `disconnected`, and room `state` in Redis.
2. Ask the participant to reconnect and rejoin; a new session updates the participant and
   restores the normal disconnect path.
3. If the participant is gone, the room cannot be completed without an administrative
   mutation. There is no admin endpoint. Options are to wait for the room TTL or delete the
   room key (losing the unpersisted result) and recreate. Record the incident; a future
   improvement is a liveness sweep or heartbeat lease per participant.

### Anti-cheat triage

1. Query the durable results:
   ```sql
   SELECT id, user_id, final_wpm, claimed_wpm, server_wpm, anti_cheat_status,
          anti_cheat_flags, finish_rank
   FROM race_results
   WHERE anti_cheat_status <> 'VALID'
   ORDER BY id DESC
   LIMIT 50;
   ```
2. `QUARANTINED` results are ranked but did not credit a streak. `DISQUALIFIED` results
   have `finish_rank = 0`, were excluded from `finish_count`, and did not credit a streak.
3. Interpret flags with the tables in
   [`49-server-authoritative-anti-cheat.md`](../refactors/49-server-authoritative-anti-cheat.md).
   `WPM_MISMATCH` compares the claimed WPM to the server-computed WPM; a high claimed value
   alone is not used for ranking.
4. `MISSING_KEYSTROKE_TELEMETRY` is expected from old clients that do not send
   `keyIntervalsMs`; it is a moderate signal, not proof of cheating. Encourage clients to
   upgrade.
5. There is no admin endpoint to reclassify a result or re-credit a streak. Correcting a
   false positive requires a deliberate database update plus the normal streak policy, and
   should be handled as a reviewed one-off, not a hotfix. Do not bulk-update
   `anti_cheat_status` without preserving flags and an audit trail.
6. Rows migrated by `V12` are `VALID` and have `claimed_wpm = server_wpm = final_wpm`;
   their flags are null because the data predates telemetry.

### Room expired mid-race

`GET /rooms/{code}` returns `404`; STOMP progress/finish calls fail because the room is
gone. The room TTL is refreshed on each accepted mutation, so this usually means no
progress/keepalive reached Redis for the full TTL, or the room was deleted during an
incident. Ask clients to recreate; no result was persisted unless the room had reached
`FINISHED`.

## Post-incident checks

- Confirm `/actuator/health` and both dependencies are `UP`.
- Confirm `PUBSUB NUMSUB race:events` matches the live replica count.
- Confirm no orphaned `race:lock:*` keys survive beyond their TTL.
- Confirm `race:countdown` has no due members older than a few seconds.
- Confirm matchmaking queues do not contain entries older than 5 minutes.
- Confirm completed races produced `race_sessions`/`race_results` rows and that
  `anti_cheat_status` is populated.
- Re-run the two-client verification before declaring the service healthy.
