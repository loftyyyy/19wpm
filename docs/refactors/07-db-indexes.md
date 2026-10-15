# Refactor 2.3 — Indexes for content lookups

**Area:** Database schema (`V10__add_lookup_indexes.sql`)
**Architecture pattern:** Index the query predicates (match indexes to access paths) — PostgreSQL
does not auto-index anything except primary keys and unique constraints
**Status:** Done

## Bottleneck / anti-pattern (before)

The schema only carried indexes on `texts(is_custom)` and `texts(created_by)`. Every content-selection
query filters on `language` and either `difficulty` (words) or `type` (texts), so PostgreSQL had to
**sequential-scan the whole table** each time:

| Query | Predicate | Index before |
| --- | --- | --- |
| `WordRepository.findRandomByLanguageAndDifficulty` | `language = ? AND difficulty = ?` | none (PK only) |
| `TextRepository.findRandomByLanguageAndType` | `language = ? AND type = ?` | none (PK only) |
| `TextRepository.findByLanguage` | `language = ?` | none |
| `TextRepository.findByType` / `findMaxPresetIdByType` | `type = ?` | none |

With ~13k seeded words, "give me N random words for en/MEDIUM" scanned the entire `words` table.

## Solution / enhancement (after)

A new Flyway migration adds composite/leading-column indexes that match those predicates:

```sql
CREATE INDEX idx_words_language_difficulty ON words (language, difficulty);
CREATE INDEX idx_texts_language_type       ON texts (language, type);
CREATE INDEX idx_texts_type                ON texts (type);
```

- `(language, difficulty)` and `(language, type)` serve the two-column equality filters **and** the
  language-only filter (leading column), so `findByLanguage` needs no separate index.
- `(type)` serves the type-only galleries and `findMaxPresetIdByType` (PostgreSQL can bitmap-AND it
  with the existing `idx_texts_custom` for the `is_custom = false AND type = ?` queries).

## Architecture pattern

- **Index the access paths:** each index mirrors a real query predicate; columns are ordered so the
  equality columns form the most useful leading prefix. Avoids redundant indexes (the composite
  covers the single-column language case).

## Notes / trade-offs

- Indexes add write cost, so only predicates that actually appear in the repositories were indexed;
  no speculative indexes were added for `race_sessions.room_code` (never queried) etc.
- Migrations run inside Flyway's transaction, so plain `CREATE INDEX` (not `CONCURRENTLY`) is
  correct here; on a large production table the equivalent could be applied out-of-band.

## Files changed

- `backend/src/main/resources/db/migration/V10__add_lookup_indexes.sql` (new).

## Verification

- Apply the migration (`./mvnw flyway:migrate` or app startup) and confirm the three indexes exist:
  `\d words` / `\d texts`.
- `EXPLAIN` the word/text random queries and confirm an index scan is chosen over a sequential scan
  for a specific `language`/`difficulty`/`type`.

## Rollback

Revert this commit (or add a follow-up migration with the matching `DROP INDEX`).
