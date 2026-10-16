# Refactor CR-2.4 — Preserve the cause when `logoutAll` fails

**Area:** Backend (`AuthService.logoutAll`)
**Architecture pattern:** Exception chaining (don't discard the cause)
**Status:** Done

## Issue (before)

`logoutAll` wrapped its whole body in a catch-all and rethrew a generic `IllegalArgumentException`,
dropping the original exception:

```java
try {
    // extract subject, load user, blocklist access token, revoke refresh tokens
} catch (Exception e) {
    throw new IllegalArgumentException("Could not process logout-all request.");   // cause lost
}
```

A Redis/JWT/DB failure — or a genuine "user not found" — surfaced as an opaque 400 with no stack trace
of the real cause, making the failure almost impossible to diagnose from logs.

## Solution (after)

The original exception is chained as the cause:

```java
} catch (Exception e) {
    throw new IllegalArgumentException("Could not process logout-all request.", e);
}
```

## Architecture pattern

- **Exception chaining:** when translating a low-level failure into a coarse/HTTP-facing exception,
  carry the original as the `cause` so the root condition stays in the stack trace.

## Impact

- The client-facing message is unchanged; the underlying cause is now preserved for logs and debugging.

## Files changed

- `backend/src/main/java/com/rho/backend/service/AuthService.java` — attach the cause in `logoutAll`.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).

## Rollback

Revert this commit — the catch reverts to throwing without the cause.
