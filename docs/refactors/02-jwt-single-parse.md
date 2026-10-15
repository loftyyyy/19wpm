# Refactor 2.1 — Parse the JWT once and drop redundant auth lookups

**Area:** Request authentication (`JwtAuthenticationFilter`, `JwtService`, `JwtChannelInterceptor`)
**Architecture pattern:** Single-pass token validation (parse-once, reuse claims) — eliminate redundant work on the hot request path
**Status:** Done

## Bottleneck / anti-pattern (before)

`JwtAuthenticationFilter` runs on **every** authenticated HTTP request. For a single request it
verified the JWT signature **three times** and hit the database **twice**:

1. `redisTokenStore.isAccessTokenBlocked(jwt)` → 1 Redis round-trip (required).
2. `jwtService.isRefreshToken(jwt)` → **parse #1** (HMAC verification).
3. `jwtService.extractSubject(jwt)` → **parse #2**.
4. `userRepository.existsByEmail(userEmail)` → **DB query #1**.
5. `userDetailsService.loadUserByUsername(userEmail)` → **DB query #2** (`findByEmailWithRole`, with role join).
6. `jwtService.isAccessTokenValid(jwt, userDetails)` → **parse #3**.

`JwtService` exposes only string-in/boolean-out helpers, so each check has no choice but to
re-parse the token. The same double-parse pattern existed in `JwtChannelInterceptor` for STOMP
`CONNECT` (`isAccessToken` then `extractSubject`), which — worse — **never checked expiry**.

## Solution / enhancement (after)

1. **Parse once, reuse claims.** `JwtService.isAccessClaimsValid(Claims)` validates an
   already-parsed token (subject present, not expired, not-before respected, `type == ACCESS`).
   The filter calls `extractAllClaims(jwt)` exactly once and passes the resulting `Claims` around.
2. **One user load instead of exists + load.** The filter no longer calls `existsByEmail`. It
   loads the user once through `UserDetailsService` and treats `UsernameNotFoundException`
   (deleted user) as a 401, preserving the previous behaviour with half the DB work.
3. **STOMP interceptor aligned.** `JwtChannelInterceptor` now parses once and reuses the claims,
   and benefits from the added expiry/not-before validation.
4. **Dead code removed:** `JwtService.isAccessToken(String)`, `isRefreshToken(String)` and
   `isAccessTokenValid(String, UserDetails)` are gone — they only encouraged re-parsing.

## Architecture pattern

- **Single-pass validation:** parse/verify the token a single time at the boundary and thread the
  verified claims through the rest of the pipeline, rather than re-deriving them per check.

## Impact

Per authenticated request: **3 → 1** signature verifications and **2 → 1** DB queries
(plus the unchanged single Redis blocklist check). Signature verification and role-joined user
lookups were both on the critical path for *every* API call.

## Files changed

- `backend/.../service/JwtService.java` (added `isAccessClaimsValid(Claims)`; removed re-parsing helpers)
- `backend/.../filter/JwtAuthenticationFilter.java` (single parse; single user load)
- `backend/.../multiplayer/jwt/JwtChannelInterceptor.java` (single parse; expiry now enforced)

## Verification

- `./mvnw -q -DskipTests compile` → success.
- Manual: log in, hit an authenticated endpoint; confirm `/me` works. Confirm logout still blocks
  the access token (Redis blocklist) and that a refresh token is still rejected on API endpoints.

## Rollback

Revert this commit. `isAccessClaimsValid` is additive; the removed helpers can be restored from
the previous commit if any external caller depended on them (none in-repo).
