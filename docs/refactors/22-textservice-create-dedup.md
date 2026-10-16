# Refactor CR-2.3 — Collapse duplicated create paths in `TextService`

**Area:** Backend (`TextService`)
**Architecture pattern:** Extract a shared private method (parameterized by intent)
**Status:** Done

## Issue (before)

`saveText` (admin content) and `saveCustomText` (per-user content) were byte-for-byte identical apart
from one field and one guard:

```java
public TextResponseDTO saveText(TextRequestDTO dto, Long id){
    User user = …; if (!admin) throw …;                 // admin-only guard
    // …validate content/title/language…
    Text text = Text.builder().isCustom(false)…build(); // <- only difference
    return new TextResponseDTO(textRepository.save(text));
}

public TextResponseDTO saveCustomText(TextRequestDTO dto, Long id){
    // …the exact same validation and build…
    Text text = Text.builder().isCustom(true)…build();  // <- only difference
    return new TextResponseDTO(textRepository.save(text));
}
```

Every validation rule and every builder field was maintained twice, so a new field (say, a tag) or a
changed rule had to be added in two places or silently diverge.

## Solution (after)

The identical body is extracted to a private `buildAndSaveText(dto, id, isCustom)`. `saveText` keeps
only its admin guard and delegates with `isCustom = false`; `saveCustomText` delegates with `true`:

```java
public TextResponseDTO saveText(TextRequestDTO dto, Long id){
    User user = …; if (!admin) throw …;
    return buildAndSaveText(dto, id, false);
}

public TextResponseDTO saveCustomText(TextRequestDTO dto, Long id){
    return buildAndSaveText(dto, id, true);
}

private TextResponseDTO buildAndSaveText(TextRequestDTO dto, Long id, boolean isCustom){
    // validation + Text.builder()… + save  (single copy)
}
```

Both public methods keep their own `@CacheEvict`, so eviction semantics are unchanged.

## Architecture pattern

- **Extract the invariant, parameterize the variance:** the shared create logic lives once; the only
  thing that differs between an admin text and a custom text — `isCustom` — becomes an argument.

## Impact

- Removes ~35 duplicated lines and a second copy of every validation rule; the two create paths can no
  longer drift. Behaviour and cache eviction are unchanged.

## Files changed

- `backend/src/main/java/com/rho/backend/service/TextService.java` — extract `buildAndSaveText`.

## Verification

- Compile: `./mvnw -q -DskipTests compile` (green).

## Rollback

Revert this commit — the two methods become self-contained copies again.
