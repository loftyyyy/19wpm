# Fix — Derive the current streak on read (stop showing stale streaks)

**Area:** Backend (`StreakService`, user read DTOs, auth/stat services)
**Architecture pattern:** Read-time derived view (CQRS-lite read model over stored streak state)
**Status:** Done

## Issue (before)

`users.streak` is a **write model**: `StreakService.recordActivity` updates it only when a typing result
or race finishes. Every read path returned that stored value raw:

- `/auth/me` via `dto.user.response.UserResponseDTO(User)`
- login / register / refresh / OAuth responses via `dto.user.request.UserResponseDTO.from(User)`
- the user-stat endpoint via `UserStatResponseDTO`

A user with a 10-day streak who skipped a day kept seeing `10 Day Streak` until their next result —
even though the streak was already broken. The stored value is intentionally not reset on a missed
day (the next play resets it to 1), so the write model alone cannot answer "what is the streak right
now?".

## Solution (after)

`StreakService` now exposes a pure read method:

```java
int currentStreak(User user)
int currentStreak(StreakState state)
```

It derives the visible value without touching the database:

- no `lastPlayedDate` → `0`
- last play today or yesterday (or in the future after a backwards timezone move) → `max(stored, 1)`
- anything earlier → `0`

`today` is computed in the user's own IANA timezone with the injected `Clock`, matching
`recordActivity`; blank/invalid zones fall back to UTC.

The read paths now pass the derived value into their DTOs instead of the raw entity field:
`/auth/me`, user update response, admin user list, login/register/refresh/OAuth auth responses, and
the user-stat endpoint. The persisted `streak` / `lastPlayedDate` columns are unchanged, so the next
play still increments or resets exactly as before.

No schema change and no API shape change — the existing `streak` field simply carries the correct
current value.

## Impact

- A broken streak reads as `0` immediately after the missed local day, without waiting for the next
  result or race.
- No extra query, write, or background job: the value is computed from columns already loaded.
- Writes remain authoritative; `recordActivity` still increments consecutive days and resets to `1`
  after a gap.
- Admin listings and stat responses are consistent with the dashboard.
- Limitation: an already-open SPA tab refreshes the value on the next `/auth/me`, login, or stat
  fetch; it does not auto-expire at local midnight (UI live-update remains a later phase).

## Files changed

- `backend/.../service/StreakService.java` — `currentStreak` derivation (pure read).
- `backend/.../dto/user/response/UserResponseDTO.java` — constructor takes the derived streak.
- `backend/.../dto/user/request/UserResponseDTO.java` — `from(User, int)` takes the derived streak.
- `backend/.../dto/userStat/response/UserStatResponseDTO.java` — constructor takes the derived streak.
- `backend/.../service/UserService.java` — `/auth/me`, update, and user list use the derived value.
- `backend/.../service/AuthService.java` — auth responses use the derived value.
- `backend/.../service/UserStatService.java` — stat reads use the derived value.
- `backend/src/test/.../service/StreakServiceTest.java` — read-model unit tests.
- `backend/src/test/.../streak/StreakPostgresIntegrationTest.java` — read-model DB tests.

## Verification

- `.\mvnw.cmd -q -DskipTests compile` (green).
- `.\mvnw.cmd -q -Dtest=StreakServiceTest test` (green; 21 unit tests).
- `.\mvnw.cmd -q -DskipTests test-compile` (green).
- `StreakPostgresIntegrationTest` covers alive-yesterday and stale-gap-without-mutation reads; it
  requires Docker/Testcontainers and was not run in this environment.

## Rollback

Revert this commit — reads return the stored `streak` again and the dashboard can show a stale value
until the next activity.
