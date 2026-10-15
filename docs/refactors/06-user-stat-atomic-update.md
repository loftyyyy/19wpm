# Refactor 4.2 — Atomic user-stats update

**Area:** Statistics (`UserStatService.updateUserStats`, `UserStatRepository`)
**Architecture pattern:** Atomic state transition — perform the read-modify-write in a single SQL
statement instead of loading the row, mutating it in Java, and saving it back (consistent with the
existing atomic streak update in `StreakService`)
**Status:** Done

## Bottleneck / anti-pattern (before)

`updateUserStats` loaded the `user_stats` row, recomputed `average_speed`, `best_speed`,
`last_speed` and `text_completed` in Java, and wrote the whole row back:

```java
UserStat userStat = userStatRepository.findByUser_UserId(userId).orElseThrow(...);
int oldCount = userStat.getTextCompleted();
int newCount = oldCount + 1;
userStat.setLastSpeed(newWpm);
if (newWpm.compareTo(userStat.getBestSpeed()) > 0) userStat.setBestSpeed(newWpm);
BigDecimal totalWpm = userStat.getAverageSpeed().multiply(BigDecimal.valueOf(oldCount)).add(newWpm);
userStat.setAverageSpeed(totalWpm.divide(BigDecimal.valueOf(newCount), 2, RoundingMode.HALF_UP));
userStat.setTextCompleted(newCount);
userStatRepository.save(userStat);
```

This is a **lost-update race**: two results submitted at nearly the same time both read the same
`text_completed`/`average_speed`, and the second write clobbers the first — so the completion count
undercounts and the running average drifts. It is also the *odd one out*: `StreakService` already
guards its update with an atomic, condition-checked `UPDATE`, but stats were still read-modify-write.

## Solution / enhancement (after)

Push the whole computation into one atomic `UPDATE`, evaluated by the database against the row's
current values:

```java
@Modifying
@Query(value = """
        UPDATE user_stats
        SET last_speed = :wpm,
            best_speed = GREATEST(COALESCE(best_speed, 0), :wpm),
            average_speed = ROUND((COALESCE(average_speed, 0) * text_completed + :wpm)
                                  / (text_completed + 1), 2),
            text_completed = text_completed + 1
        WHERE user_id = :userId
        """, nativeQuery = true)
int applyResult(@Param("userId") Long userId, @Param("wpm") BigDecimal wpm);
```

```java
@Transactional
public void updateUserStats(long userId, BigDecimal newWpm) {
    int updatedRows = userStatRepository.applyResult(userId, newWpm);
    if (updatedRows == 0) { throw new ResourceNotFoundException("User Statistics not found"); }
}
```

In a SQL `UPDATE`, every right-hand side reads the row's **old** values, so `text_completed + 1`
and the running-average expression are computed against the same version of the row in a single,
row-locked statement — concurrent submissions can no longer overwrite each other's increments. The
`GREATEST`/`COALESCE` calls also make the best-speed comparison null-safe (the previous Java path
would NPE on a null `best_speed`). The "not found" contract is preserved via `updatedRows == 0`.

## Architecture pattern

- **Atomic state transition:** keep counter/last-value/aggregate updates inside one SQL statement so
  the database serializes concurrent writers. Mirrors the condition-checked update already used for
  streaks, so both side-effects of saving a result are handled the same way.

## Notes / trade-offs

- The query is native PostgreSQL (`GREATEST`, `ROUND(numeric, int)`). That is consistent with this
  codebase's PostgreSQL deployment; the H2 test profile (`application-test.properties`) also
  supports these functions.
- `average_speed` remains a denormalized rolling average; it is now updated atomically but is still
  maintained incrementally. Recomputing it from `typing_results` remains a possible future step if
  the aggregate is ever suspected of drift.

## Files changed

- `backend/.../repository/UserStatRepository.java` — added `applyResult(...)` (`@Modifying` atomic
  `UPDATE`).
- `backend/.../service/UserStatService.java` — `updateUserStats` now issues the single atomic update
  (removed the entity load/mutate/save and the now-unused `RoundingMode` import).

## Verification

- `./mvnw -q -DskipTests compile` → success.
- Manual/logic review: submitting two results in quick succession must increment `text_completed` by
  two (previously could be one) and yield the correct running average.

## Rollback

Revert this commit; `updateUserStats` returns to the load/mutate/save implementation.
