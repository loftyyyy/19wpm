# Refactor CR-3.3 — Uniform random text selection without the id-probe double query

**Area:** Backend (`TextService` + `TextRepository`)
**Architecture pattern:** Let the database do the sampling (single query) instead of a biased id probe
**Status:** Done

## Issue (before)

`getRandomTextByType` (and its twin `getRandomText`) picked a random id in `[1, maxId]` and then fetched
the *first* row with `textId >= randId`, retrying from `1` when the probe fell past the last row:

```java
Long maxId = textRepository.findMaxPresetIdByType(type)
        .orElseThrow(() -> new ResourceNotFoundException("No texts found for type: " + type));

Long randId = ThreadLocalRandom.current().nextLong(1, maxId + 1);
List<Text> results = textRepository.findFirstPresetByIdGreaterThanEqualAndType(randId, type, PageRequest.of(0, 1));

if (results.isEmpty()) {
    results = textRepository.findFirstPresetByIdGreaterThanEqualAndType(1L, type, PageRequest.of(0, 1));
}
```

Two flaws:

1. **Mis-weighted selection.** Probability is proportional to the *gap* in ids, not to the number of
   rows. A row whose id follows a large gap is far more likely than one packed next to the previous
   id, and a row at the top is never selected at all. Deletes and non-preset ids widen the gaps.
2. **Double query on the wrap.** When the probe lands after the last matching id the code issues a
   second query, so some callers pay two round-trips.

## Solution (after)

Sampling is delegated to the database with `ORDER BY random() LIMIT 1`, mirroring the pattern already
used by `findRandomByLanguageAndType`:

```java
@Query(value = "SELECT * FROM texts WHERE is_custom = false ORDER BY random() LIMIT 1", nativeQuery = true)
Optional<Text> findRandomPreset();

@Query(value = "SELECT * FROM texts WHERE is_custom = false AND type = :type ORDER BY random() LIMIT 1", nativeQuery = true)
Optional<Text> findRandomPresetByType(@Param("type") String type);
```

```java
public TextResponseDTO getRandomTextByType(TextType type) {
    if (type == null) {
        throw new InvalidResourceException("Type cannot be null");
    }
    Text text = textRepository.findRandomPresetByType(type.name())
            .orElseThrow(() -> new ResourceNotFoundException("No texts found for type: " + type));
    return new TextResponseDTO(text);
}
```

The four now-unused id-probe queries (`findMaxPresetId`, `findMaxPresetIdByType`,
`findFirstPresetByIdGreaterThanEqual`, `findFirstPresetByIdGreaterThanEqualAndType`) and the unused
`ThreadLocalRandom`/`PageRequest` imports are removed.

## Architecture pattern

- **Push sampling into the datastore:** `ORDER BY random()` gives an unbiased pick in one round-trip;
  the application no longer has to reason about id density.
- **One pattern, one place:** the catalogue already sampled this way for language+type; the preset
  lookups now follow suit instead of a bespoke probe.

## Impact

- Uniform selection across all presets; single query on every call; ~25 lines of probing logic and
  four dead repository methods removed. The text catalogue is small, so `ORDER BY random()` cost is
  negligible (already accepted by the existing language+type query).

## Files changed

- `backend/src/main/java/com/rho/backend/repository/TextRepository.java` — add `findRandomPreset` /
  `findRandomPresetByType`; drop the id-probe queries and the unused `Pageable` import.
- `backend/src/main/java/com/rho/backend/service/TextService.java` — simplify `getRandomTextByType`
  and `getRandomText`; drop unused imports.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).
- No other caller referenced the removed repository methods (grep across `src/main` + `src/test`).

## Rollback

Revert this commit — the id-probe queries and both service methods return to their previous form.
