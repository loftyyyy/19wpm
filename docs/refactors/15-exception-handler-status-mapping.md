# Refactor CR-1.5 — Map client errors to correct HTTP statuses

**Area:** Error handling (`GlobalExceptionHandler`)
**Architecture pattern:** Centralized exception→status translation with a guarded catch-all
**Status:** Done

## Bottleneck / anti-pattern (before)

`GlobalExceptionHandler` mapped only a handful of exception types:

```java
@ExceptionHandler(AccessDeniedException.class)      // 403
@ExceptionHandler(AuthenticationException.class)    // 401
@ExceptionHandler(DuplicateResourceException.class) // 409
@ExceptionHandler(ResourceNotFoundException.class)  // 404
@ExceptionHandler(MethodArgumentNotValidException.class) // 400
@ExceptionHandler(DataAccessException.class)        // 500
```

But the services throw several domain exceptions that were **never mapped**:

- `InvalidResourceException` — thrown throughout `WordService`, `TextService`, `RaceService` for
  bad user input (empty word, null difficulty, count ≤ 0, room full, race not in progress). With no
  handler it fell through to the default `Exception` → **500** instead of **400**.
- `UnauthorizedResourceException` — thrown for "you cannot perform this action" / "you do not own
  this text" (ownership/authorization failures). → **500** instead of **403**.
- `PasswordException` — thrown for "Credentials doesn't match. Try again" on password change/verify.
  → **500** instead of **401**.

The net effect: legitimate client errors were reported as server errors — the frontend showed generic
failures, and 5xx alerting would fire on ordinary bad input. There was also no catch-all, so any
genuinely unexpected exception produced the framework's default error body.

## Solution / enhancement (after)

Add explicit handlers for the missing domain exceptions and a guarded catch-all:

```java
@ExceptionHandler(InvalidResourceException.class)      // 400 Bad Request
@ExceptionHandler(UnauthorizedResourceException.class) // 403 Forbidden
@ExceptionHandler(PasswordException.class)             // 401 Unauthorized

@ExceptionHandler(Exception.class)
public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
    if (ex instanceof ErrorResponse errorResponse) {          // 404/405/… framework HTTP exceptions
        HttpStatus status = HttpStatus.valueOf(errorResponse.getStatusCode().value());
        ...
        return ResponseEntity.status(status).body(...);
    }
    logger.error("Unhandled exception", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(...); // 500
}
```

The catch-all deliberately **checks `ErrorResponse` first**: Spring's own HTTP exceptions (e.g.
`NoResourceFoundException` for an unknown route → 404, `HttpRequestMethodNotSupportedException` → 405)
implement `ErrorResponse`, so their real status is preserved instead of being masked as 500. Only
genuinely unexpected exceptions log a stack trace and return 500 with a consistent JSON body.

## Architecture pattern

- **Centralized exception→status translation** with a **guarded catch-all**: map known domain
  exceptions to precise statuses, and make the fallback preserve framework-provided status codes
  before defaulting to 500.

## Impact

- Bad input now returns **400**, ownership failures **403**, and failed credential checks **401**
  instead of a blanket 500 — correct client behavior and meaningful frontend errors.
- Unexpected exceptions still return a consistent JSON 500 body and are logged once (with stack
  trace), while unknown routes and wrong methods keep their real 404/405 statuses.
- 5xx monitoring no longer lights up for ordinary validation/authorization failures.

## Files changed

- `backend/.../exception/GlobalExceptionHandler.java` — added handlers for
  `InvalidResourceException` (400), `UnauthorizedResourceException` (403), `PasswordException` (401),
  and a guarded `Exception` catch-all (500, preserving `ErrorResponse` statuses).

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- Manual: `POST /api/v1/words` with an empty word (admin) → 400; `PUT /api/v1/texts/{id}` for a text
  you don't own → 403; password change with a wrong current password → 401; unknown path
  `/api/v1/nope` → 404 (not 500).

## Rollback

Revert this commit — restores the previous handler set and returns unmapped exceptions to the
framework default.
