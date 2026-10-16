# Refactor CR-1.6 — Cache resolved user details on the auth hot path

**Area:** Authentication (`JwtAuthenticationFilter`, `JwtChannelInterceptor`, new `UserDetailsCache`)
**Architecture pattern:** Short-TTL read-through cache in front of `UserDetailsService`
**Status:** Done

## Bottleneck / anti-pattern (before)

Every authenticated HTTP request and every STOMP `CONNECT` resolved the principal from scratch:

```java
// JwtAuthenticationFilter
userDetails = userDetailsService.loadUserByUsername(userEmail);   // DB hit + role JOIN per request

// JwtChannelInterceptor (per STOMP CONNECT)
var userDetails = userDetailsService.loadUserByUsername(email);
```

`loadUserByUsername` runs `UserRepository.findByEmailWithRole(...)` — a database query with a role
`JOIN FETCH` — on **every request**, even though the user's identity and role change only rarely.
For a typing app that fires many small requests and opens a socket per race, this is a constant,
avoidable database load on the read path.

## Solution / enhancement (after)

A small dedicated component caches resolved `UserDetails` per email behind a short TTL:

```java
@Component
public class UserDetailsCache {
    private static final Duration TTL = Duration.ofSeconds(60);
    private final Cache<String, UserDetails> cache = Caffeine.newBuilder()
            .maximumSize(10_000).expireAfterWrite(TTL).build();

    public UserDetails get(String email) {
        UserDetails cached = cache.getIfPresent(email);
        if (cached != null) return cached;
        UserDetails loaded = delegate.loadUserByUsername(email);   // throws if unknown
        cache.put(email, loaded);
        return loaded;
    }
}
```

Only the two **read-only** consumers use it — `JwtAuthenticationFilter` and `JwtChannelInterceptor`.
Both call `getUserDetails().getUserId()` / `getAuthorities()` and never mutate the entity, so sharing
a cached instance across requests is safe.

The **login flow is deliberately not cached.** `AuthService.login` pulls the principal from the
authentication manager and then mutates it (`user.setTimezone(...)` + `save`), so it must keep
resolving a fresh, managed entity. The cache wraps the filter/interceptor paths only and leaves
`CustomUserDetailService` itself untouched, so Spring Security's `DaoAuthenticationProvider` still
loads fresh.

Failures are never cached: `UsernameNotFoundException` propagates out of `get` without storing
anything, so a deleted/unknown user is still rejected on every request. Account or role changes
propagate within the 60 s TTL.

## Architecture pattern

- **Read-through cache with a short TTL:** trades strict read-after-write freshness for a large drop
  in repeated authentication reads, while keeping the failure path (unknown user) uncached.

## Impact

- Removes one DB query (with a role join) from every authenticated request and every STOMP connect;
  the cost drops to a Caffeine lookup after the first hit per user per 60 s.
- Deleted users are still rejected immediately (no negative caching); role/account changes take
  effect within the TTL.

## Files changed

- `backend/.../config/UserDetailsCache.java` — **new** short-TTL read-through cache.
- `backend/.../filter/JwtAuthenticationFilter.java` — resolve the principal via `UserDetailsCache`.
- `backend/.../multiplayer/jwt/JwtChannelInterceptor.java` — resolve the principal via `UserDetailsCache`.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).

## Rollback

Revert this commit — the filter and channel interceptor return to calling
`userDetailsService.loadUserByUsername(...)` directly.
