# Refactor CR-1.4 — Authorize user-scoped content endpoints

**Area:** HTTP authorization (`SecurityFilterChainConfig`, `TextController`)
**Architecture pattern:** Deny-by-default authorization with an explicit public read allowlist + method guards
**Status:** Done

## Bottleneck / anti-pattern (before)

The filter chain blanket-permitted whole subtrees:

```java
.requestMatchers(
        "/ws/**",
        "/api/v1/texts/**",   // every text endpoint, including writes
        "/api/v1/words/**"
).permitAll()
.anyRequest().authenticated()
```

`/api/v1/texts/**` also matched the **user-scoped** handlers in `TextController`:

- `POST /api/v1/texts/custom-text` creates a text owned by a user but had **no** `@PreAuthorize`, so
  with the subtree permitted it was a fully **unauthenticated write path**.
- `PUT /api/v1/texts/{textId}`, `GET /api/v1/texts/{textId}`, and `GET /api/v1/texts/user-texts` all
  dereference `@AuthenticationPrincipal CustomUserDetails`. With authentication not required the
  principal is `null`, so `customUserDetails.getUserId()` throws a **NullPointerException → 500**.

Net effect: an anonymous caller could write content, and could turn any of those reads into a 500
instead of a clean 401/403.

## Solution / enhancement (after)

Replace the subtree wildcard with an explicit allowlist of the *read-only, non-user-scoped* paths,
and mark the principal-dependent handlers with `@PreAuthorize("isAuthenticated()")` as
defense-in-depth.

```java
.requestMatchers(
        ...auth/oauth/ws...,
        "/api/v1/words",                 // random word lists
        "/api/v1/texts",                 // random passages by language/type
        "/api/v1/texts/preset-texts",
        "/api/v1/texts/random",
        "/api/v1/texts/language",
        "/api/v1/texts/short",
        "/api/v1/texts/medium",
        "/api/v1/texts/long",
        "/api/v1/texts/thicc"
).permitAll()
.anyRequest().authenticated()
```

```java
@PreAuthorize("isAuthenticated()")
@PostMapping("/custom-text")
public ResponseEntity<TextResponseDTO> createCustomText(...) { ... }
```

`GET /texts/{textId}`, `GET /texts/user-texts`, `POST /texts/custom-text`, and `PUT /texts/{textId}`
now fall through to `anyRequest().authenticated()` and additionally carry an explicit
`isAuthenticated()` guard.

Word endpoints required no change: every write (`POST`, `POST /bulk`, `DELETE`) already declares
`@PreAuthorize("hasRole('ADMIN')")`, so the subtree wildcard never exposed a write there — tightening
the matcher simply makes that intent explicit.

## Architecture pattern

- **Deny-by-default authorization with an explicit public allowlist:** permit exactly the endpoints
  that are safe to serve anonymously (read-only content browsing) and require authentication for
  everything else, keeping method-level `@PreAuthorize` as a second layer.

## Impact

- The anonymous write path to `POST /api/v1/texts/custom-text` is closed (401 before the controller).
- `GET /texts/{id}` and `GET /texts/user-texts` can no longer 500 on a null principal — they require a
  token first.
- Guest/solo typing is unaffected: every endpoint it calls (`/words`, `/texts`, `/texts/random`,
  `/texts/preset-texts`, `/texts/{short|medium|long|thicc}`, `/texts/language`) stays public.
- `apiFetchTextById` / `apiFetchUserTexts` are not called anywhere in the frontend, so nothing
  client-side regresses.

## Files changed

- `backend/.../config/SecurityFilterChainConfig.java` — allowlist of public content reads replaces the
  `/api/v1/texts/**` + `/api/v1/words/**` wildcards.
- `backend/.../controller/TextController.java` — `@PreAuthorize("isAuthenticated()")` on
  `getTextById`, `getUserTexts`, `createCustomText`, `modifyText`.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- Manual: `POST /api/v1/texts/custom-text` with no token → 401; `GET /api/v1/texts/1` with no token →
  401; `GET /api/v1/texts/random` and `GET /api/v1/words?language=en&difficulty=EASY&count=10` with no
  token → 200.

## Rollback

Revert this commit — restores the subtree `permitAll` and removes the four method guards.
