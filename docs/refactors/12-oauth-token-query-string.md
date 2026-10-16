# Refactor CR-1.2 — Never place OAuth tokens in the redirect query string

**Area:** OAuth2 login handoff (`OAuth2SuccessHandler`, `AuthController`, `AuthService`, `RedisTokenStore`, `OAuth2Callback.tsx`)
**Architecture pattern:** Out-of-band handoff via a short-lived, single-use exchange code (token-off-the-URL)
**Status:** Done

## Bottleneck / anti-pattern (before)

On a successful OAuth2 login the backend put the full session into the *redirect URL*:

```java
// OAuth2SuccessHandler
String accessToken  = jwtService.generateAccessToken(user);
String refreshToken = jwtService.generateRefreshToken(user);
redisTokenStore.storeRefreshToken(user.getUserId(), refreshToken, jwtService.extractExpiration(refreshToken));

String redirectUrl = frontendUrl + "/oauth2/callback"
        + "?accessToken="  + accessToken
        + "&refreshToken=" + refreshToken;   // ← 30-day refresh token in the query string
response.sendRedirect(redirectUrl);
```

A refresh token in a URL is a durable credential leak:

- **Browser history** stores the full URL, so the tokens persist on the device after logout.
- **Referer** headers can forward the URL to third-party resources loaded by the callback page.
- **Access logs / proxies / CDNs** on `frontendUrl` record the query string verbatim.
- The tokens are also visible to any browser extension or shoulder-surfer reading the address bar
  during the redirect.

## Solution / enhancement (after)

The redirect now carries only an **opaque, short-lived, single-use code**; the tokens are minted
later and returned in the body of a POST the frontend makes itself.

```java
// OAuth2SuccessHandler — mint a code, store userId under it, redirect with the code only
String code = generateExchangeCode();                 // SecureRandom, 256-bit, Base64URL
redisTokenStore.storeOAuthCode(code, user.getUserId(), Duration.ofSeconds(60));
response.sendRedirect(frontendUrl + "/oauth2/callback" + "?code=" + code);
```

```java
// AuthService.exchangeOAuthCode — atomically consume the code, then mint the pair
Long userId = redisTokenStore.consumeOAuthCode(code)  // GETDEL: at most one success, ever
        .orElseThrow(() -> new IllegalArgumentException("Invalid or expired OAuth exchange code."));
User user = userRepository.findByIdWithRole(userId)
        .orElseThrow(() -> new ResourceNotFoundException("User not found."));
return issueTokenPair(user);                          // reuses the login/register token path
```

```tsx
// OAuth2Callback.tsx — read ?code, exchange it over POST, then load the profile
apiExchangeOAuthCode(code).then(async ({ user }) => {
  if (!user) { clearTokens(); navigate('/login?oauth_error=...', { replace: true }); return; }
  const profile = await apiGetSessionUser();
  if (profile) { await setupFromOAuth(profile); navigate('/dashboard', { replace: true }); }
});
```

## Architecture pattern

- **Out-of-band handoff (token-off-the-URL):** the authorization result travels back through a
  channel that is not the URL. The code is a *capability*, not a credential — worthless without a
  same-origin POST, expired in 60 s, and single-use.
- **Atomic single-use redemption:** `redisTemplate.opsForValue().getAndDelete(...)` (Redis `GETDEL`)
  makes concurrent redemptions impossible, so a code cannot be replayed even if it leaks.

## Impact

- The 30-day refresh token — and the access token — **never appear in a URL**, eliminating the
  history / Referer / access-log / extension leak surface for the OAuth path.
- A leaked redirect URL now exposes at most a code that expires in 60 s and works once.
- OAuth logins now share the exact token-minting path as password login/register (`issueTokenPair`),
  so the refresh token is registered in Redis identically.

## Files changed

- `backend/.../handler/oauth2/OAuth2SuccessHandler.java` — dropped `JwtService`; mints a
  `SecureRandom` code, stores it, redirects with `?code=`.
- `backend/.../redis/RedisTokenStore.java` — added `storeOAuthCode(...)` and `consumeOAuthCode(...)`
  (GETDEL); `RedisKeys.oauthCode(...)` key builder.
- `backend/.../redis/RedisKeys.java` — added the `oauth:code:` namespace.
- `backend/.../service/AuthService.java` — added `exchangeOAuthCode(String)`.
- `backend/.../controller/AuthController.java` — added `POST /api/v1/auth/oauth/exchange`.
- `backend/.../dto/auth/request/OAuthCodeExchangeRequestDTO.java` — new request record.
- `backend/.../config/SecurityFilterChainConfig.java` — `/api/v1/auth/oauth/exchange` added to permitAll.
- `frontend/src/Components/Auth/OAuth2Callback.tsx` — exchanges `?code` over POST instead of reading tokens.
- `frontend/src/services/auth.ts` — added `apiExchangeOAuthCode(...)`.
- `frontend/src/types/api.ts` — added `ApiOAuthCodeExchangeRequest`.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green); frontend `npx tsc -b` (green).
- Manual (OAuth provider): complete a GitHub/Google login → redirected to
  `/oauth2/callback?code=…` (no tokens in the URL), then landed on `/dashboard` authenticated.
- Replay: reloading the callback URL with the same `code` fails (code already consumed) and lands on
  the login error path; a code older than 60 s is likewise rejected.

## Rollback

Revert this commit — restores tokens-in-query in `OAuth2SuccessHandler` and the token-reading
`OAuth2Callback`. No persisted state migration is involved (OAuth codes are transient Redis keys).
