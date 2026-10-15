# Refactor 3.1 — Turn off SQL logging and scope the Hibernate session to the transaction

**Area:** Application configuration (`application.properties`, `application-dev.properties`, `UserStatService`, `TypingResultService`)
**Architecture pattern:** Transaction-scoped persistence context (OSIV off) + bounded connection pool; environment-specific config via Spring profiles
**Status:** Done

## Bottleneck / anti-pattern (before)

`application.properties` shipped development-friendly defaults straight into every environment:

- `spring.jpa.show-sql=true` — Hibernate logged **every** SQL statement (and the app also ran with
  `format_sql` defaults), producing large log volume and I/O on the request hot path.
- `spring.jpa.open-in-view` was left at the Spring Boot default of **`true`** (Open Session In View).
  OSIV keeps the Hibernate `Session` — and therefore a database connection — open for the **entire
  HTTP request**, including controller execution and JSON serialization. The connection is not
  returned to the pool until the response is fully written, so under load the pool is held far
  longer than the work actually requires.
- No explicit HikariCP sizing, so the pool used defaults that were neither documented nor tunable
  per environment.

## Solution / enhancement (after)

1. **`spring.jpa.show-sql=false`** in the committed configuration. SQL logging now lives only in
   `application-dev.properties` (`show-sql=true` + `format_sql=true`), so developers opt in by
   activating the `dev` profile instead of every environment paying for it.
2. **`spring.jpa.open-in-view=false`.** The `Session` now opens at transaction start and closes when
   the transaction ends, so the DB connection is released as soon as the data work is done rather
   than being pinned through view rendering/serialization.
3. **Explicit HikariCP config** (`pool-name`, `maximum-pool-size`, `minimum-idle`,
   `connection-timeout`, `idle-timeout`, `max-lifetime`), with the pool sizes overridable via
   `DB_POOL_MAX` / `DB_POOL_MIN`.
4. **Compensating lazy-load fixes** — turning OSIV off means any lazy association touched *outside*
   a transaction now fails. All such accesses were audited; the only real one was
   `UserStatResponseDTO`, which reads the lazy `UserStat.user`. Added
   `@Transactional(readOnly = true)` to `UserStatService.getStat` (and to
   `TypingResultService.getResultsByUser` for consistency). Every other lazy `User.role` access
   already happens on a fetch-joined/real entity.

## Architecture pattern

- **Transaction-scoped persistence context:** bind the ORM session to the unit of work (the
  transaction), not to the transport (the HTTP request). The boundary that owns the connection is
  the transaction.
- **Environment-specific configuration via profiles:** keep production-safe defaults in the shared
  `application.properties` and move developer conveniences into a profile-specific file.

## Why this is safe (lazy-loading audit)

Lazy associations in the model: `User.role`, `TypingResult.user`, `UserStat.user`,
`RaceResult.session`, `UserOAuthProvider.user`. With OSIV previously on, these could be touched at
serialization time. After disabling OSIV:

- `User.role` — read in `CustomUserDetails`, `CustomOAuth2User`, `JwtService.generateAccessToken`,
  and the `assertAdmin` helpers; in every case the `User` comes from `findByIdWithRole` /
  `findByEmailWithRole` (fetch join) or is a real (non-proxy) entity → initialized.
- `TypingResult.user` — read by `TypingResultResponseDTO`; both call sites are now inside a
  transaction and/or backed by the `findByUserWithUser` fetch join.
- `UserStat.user` — read by `UserStatResponseDTO`; `getStat` is now `@Transactional(readOnly = true)`.
- `RaceResult.session` / `UserOAuthProvider.user` — not dereferenced during serialization.

## Impact

- No SQL logging on the hot path in non-dev environments.
- DB connections are released at transaction end instead of at end of request, improving pool
  utilisation under concurrency.
- Pool size/timeouts are explicit and tunable without a code change.

## Files changed

- `backend/src/main/resources/application-prod.properties` (`open-in-view=false`, HikariCP block; `show-sql=false` was already set)
- `backend/src/main/resources/application-dev.properties` (dev-only `show-sql=true`, `format_sql=true`)
- `backend/.../service/UserStatService.java` (`getStat` now `@Transactional(readOnly = true)`)
- `backend/.../service/TypingResultService.java` (`getResultsByUser` now `@Transactional(readOnly = true)`)

> Note: `application.properties` is listed in `backend/.gitignore`, so it is a developer-local file
> and is **not** part of this commit. The same three settings were applied to it locally so the
> default (no-profile) run matches; the versioned source of truth for these settings is
> `application-prod.properties` (with `application-dev.properties` opting back into SQL logging).

## Verification

- `./mvnw -q -DskipTests compile` → success.
- Manual: exercise every read endpoint (esp. `GET /api/user-stats/{id}`, `GET /api/typing-results`
  and `/auth/me`) with OSIV off to confirm no `LazyInitializationException`.

## Rollback

Revert this commit. Re-enabling OSIV (`spring.jpa.open-in-view=true`) makes the two added
`@Transactional` annotations harmless (idempotent), so the change is safe to back out as one unit.
