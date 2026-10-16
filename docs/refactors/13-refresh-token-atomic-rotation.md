# Refactor CR-1.3 — Atomic refresh-token rotation

**Area:** Token refresh (`AuthService.refresh`, `RedisTokenStore`)
**Architecture pattern:** Atomic check-and-consume (single-use token via Redis GETDEL) — remove the TOCTOU window
**Status:** Done

## Bottleneck / anti-pattern (before)

`AuthService.refresh` checked the refresh token and rotated it with **two separate** Redis calls:

```java
// AuthService.refresh
if (!redisTokenStore.isRefreshTokenValid(user.getUserId(), refreshToken)) {   // EXISTS
    redisTokenStore.revokeAllRefreshTokens(user.getUserId());
    throw new IllegalArgumentException("Refresh token is invalid or has already been used.");
}
// ... generate new pair ...
redisTokenStore.rotateRefreshToken(user.getUserId(), refreshToken, newRefreshToken, newRefreshExpiry); // DEL + SET
```

`isRefreshTokenValid` is an `EXISTS` and `rotateRefreshToken` is `DEL` + `SET`. Between the check and
the delete, two requests presenting the *same* refresh token can both pass the check and both mint a
new session:

- **Double-spend:** the token is single-use in intent but redeemable twice under a concurrent
  double-submit — two tabs, a retried request, or a race between the legitimate client and an
  attacker who holds a copy.
- **Broken theft detection:** the "revoke all on missing token" branch never fires when both readers
  win, so a stolen token can be spent alongside the real one without tripping the alarm.

## Solution / enhancement (after)

The check *is* the consume: a single `GETDEL` verifies the token exists and removes it in one
operation, so exactly one caller can succeed.

```java
// RedisTokenStore
public boolean consumeRefreshToken(Long userId, String token) {
    return redisTemplate.opsForValue()
            .getAndDelete(RedisKeys.refreshToken(userId, token)) != null;   // atomic GETDEL
}

// AuthService.refresh
if (!redisTokenStore.consumeRefreshToken(user.getUserId(), refreshToken)) {
    logger.warn("Refresh token not found ... Possible token theft — revoking all.");
    redisTokenStore.revokeAllRefreshTokens(user.getUserId());   // loser / replayer → theft
    throw new IllegalArgumentException("Refresh token is invalid or has already been used.");
}
// ... generate ...
redisTokenStore.storeRefreshToken(user.getUserId(), newRefreshToken, newRefreshExpiry);
```

`isRefreshTokenValid(Long, String)` and `rotateRefreshToken(...)` are removed — their work is now a
single atomic primitive.

## Architecture pattern

- **Atomic check-and-consume (single-use token):** collapse the existence check and the mutation into
  one server-side atomic operation (`GETDEL`) so the decision and its effect cannot interleave.

## Impact

- A refresh token is redeemable **exactly once**, even under concurrent requests.
- The theft/revoke-all branch is now reliable: a replay of an already-spent token always loses the
  race and revokes every session.
- One fewer Redis round-trip per refresh (`EXISTS` + `DEL`+`SET` → one `GETDEL` + `SET`).

## Notes / trade-offs

- `GETDEL` removes the old token *before* the new one is written, so a Redis failure in that window
  would leave the user without a refresh token (they re-authenticate). The old `DEL`+`SET` rotation
  had the same window; this change does not widen it.
- The JWT-level pre-check (`jwtService.isRefreshTokenValid`) is unchanged and still runs first; only
  the Redis check-and-rotate was collapsed.

## Files changed

- `backend/.../redis/RedisTokenStore.java` — added `consumeRefreshToken` (GETDEL); removed
  `isRefreshTokenValid` and `rotateRefreshToken`.
- `backend/.../service/AuthService.java` — `refresh` consumes atomically, then stores the new pair.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- Manual: two concurrent `POST /api/v1/auth/refresh` calls with the same token — exactly one returns
  200; the other 400s and revokes all sessions. A normal single refresh still rotates successfully.

## Rollback

Revert this commit — restores the `EXISTS` then `DEL`+`SET` sequence and the two `RedisTokenStore`
methods.
