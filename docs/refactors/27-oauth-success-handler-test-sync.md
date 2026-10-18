# Build fix — Sync `OAuth2SuccessHandlerTest` with the exchange-code handler

**Area:** Backend test (`OAuth2SuccessHandlerTest`)
**Architecture pattern:** Test double aligned to the collaborator's current seam
**Status:** Done

## Issue (before)

CR-1.2 removed token-minting from `OAuth2SuccessHandler` — it now takes `(RedisTokenStore, UserRepository)`
and hands the browser a short-lived exchange code instead of JWTs. The companion unit test was not
updated, so it still constructed the handler with a `JwtService`:

```java
handler = new OAuth2SuccessHandler(jwtService, redisTokenStore, userRepository);
```

This compiled locally (`./mvnw -DskipTests compile` only builds `src/main`) but broke the container
image build, whose `maven.test-compile` stage fails on the stale constructor:

```
constructor OAuth2SuccessHandler cannot be applied to given types;
  required: RedisTokenStore,UserRepository
  found:    JwtService,RedisTokenStore,UserRepository
```

## Solution (after)

Drop the `JwtService` mock/stubbing and assert against the real collaborator — the exchange code
written to Redis — so the test verifies the code-path the handler actually runs:

```java
handler = new OAuth2SuccessHandler(redisTokenStore, userRepository);
...
verify(redisTokenStore).storeOAuthCode(anyString(), any(), any(Duration.class));
verify(response).sendRedirect(startsWith("http://localhost:5173/oauth2/callback"));
```

## Impact

- The repository compiles end to end again, so `dockerfile`'s test-compile stage (and any
  `mvn package`) succeeds.
- The test now guards the exchange-code redirect contract instead of a token contract the handler
  no longer has.

## Files changed

- `backend/src/test/java/com/rho/backend/handler/oauth2/OAuth2SuccessHandlerTest.java` — construct
  with `(RedisTokenStore, UserRepository)`; remove unused `JwtService` mock/import; assert
  `storeOAuthCode` instead of refresh-token storage.

## Verification

- `./mvnw clean test-compile -DskipTests` (green).

## Rollback

Revert this commit — the test reverts to the stale `JwtService` constructor and fails test-compile.
