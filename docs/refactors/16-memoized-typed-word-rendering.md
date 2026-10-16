# Refactor CR-1.1 — Memoize per-word passage rendering

**Area:** Typing surface rendering (`TypingTest.tsx`, `Race.tsx`)
**Architecture pattern:** Memoized leaf components with hoisted render invariants
**Status:** Done

## Bottleneck / anti-pattern (before)

Both typing surfaces (`TypingTest.tsx` and `Race.tsx`) inlined the entire passage render inside the
keystroke-driven component. Every keypress replaced `state.typedChars`, so the component re-rendered
and the passage map rebuilt **every word and every character** on each key — O(n) work over the whole
passage per keystroke, even though only the current word can change:

```tsx
{passageWords.map((word, wi) => (
  <span key={wi} ...>
    {chars.map(({ char, globalIdx }) => {
      const typed = state.typedChars[globalIdx];
      const passageLength = passage?.text.length ?? 0;   // recomputed per char
      const passageText = passage?.text ?? '';           // recomputed per char
      ...
      if (currentIndexOnSpace) useRightEdgeRef.current = true; // ref mutated during render
      ...
    })}
  </span>
))}
```

Two problems compounded the cost:

1. **No memoization boundary.** Every word's DOM/subtree was reconciled on every keystroke; there
   was no way for an untouched word to bail out.
2. **Render-time ref mutation.** `useRightEdgeRef` was written from inside the `chars.map()` callback
   during render, plus per-char recomputation of `passageLength` / `passageText` and per-char
   `chars.filter(...)` (to find `wordEnd`).

## Solution / enhancement (after)

Extract a single memoized leaf, `TypedWord`, shared by both surfaces, and hoist the per-render
invariants once:

```tsx
// TypedWord.tsx — React.memo with a custom comparator
function areEqual(prev, next) {
  if (prev.chars !== next.chars) return false;
  if (prev.isPastWord !== next.isPastWord || prev.hasError !== next.hasError) return false;
  if (prev.showExtra !== next.showExtra) return false;
  if (prev.activeGlobalIdx !== next.activeGlobalIdx) return false;
  ...
  for (let i = prev.start; i < prev.end; i++) {           // only this word's slice
    if (prev.typedChars[i] !== next.typedChars[i]) return false;
  }
  return true;
}
export default memo(TypedWord, areEqual);
```

Each parent now renders `<TypedWord>` with precomputed props:

- `start` / `end` derived from `chars[0].globalIdx` and `chars.length` (replaces the per-char
  `chars.filter(...)` word-end scan).
- `isPastWord = state.lockedIndex >= end`, `hasError = state.mistakeWordIndices.has(wi)`,
  `showExtra = wi === currentWordIndex`.
- `activeGlobalIdx` / `lastGlobalIdx` computed **once** above the map instead of per character.
- `extraChars={showExtra ? state.extraChars : NO_EXTRA_CHARS}` where `NO_EXTRA_CHARS` is a
  module-level constant, so the prop reference is stable for non-current words.
- Stable `useCallback` ref setters (`setCurrentCharRef` / `setLastCharRef`) replace the inline
  closures.

The render-time `useRightEdgeRef` mutation is removed entirely: the value is now derived where it is
consumed, `shouldUseRightEdge = isAtEnd || passageText[state.currentIndex] === ' '`, which is
equivalent (it equals the old flag for the render that produced `currentIndex`).

## Architecture pattern

- **Memoized leaf component** with a **custom comparator** keyed on a per-word slice of
  `typedChars`, so an untouched word is a no-op on the next keystroke.
- **Hoisted render invariants**: compute once above the loop rather than once per character.
- **Derive, don't store**: replace render-time ref mutation with a value derived at the point of use.

## Impact

- Per-keystroke render work drops from **O(n)** across the whole passage to **O(word length)** — only
  the current word (and the previously-current word) reconcile; every other word bails out of
  `memo` after an O(word length) comparator check.
- The `chars.filter(...)` per word and the per-char `passageLength`/`passageText` recomputation are
  gone.
- One shared component now backs both the solo test and the race input, removing ~200 lines of
  duplicated render logic.

## Files changed

- `frontend/src/Components/TypingTest/TypedWord.tsx` — **new** memoized word component with
  `areEqual` comparator and `extraVariant` (`plain` for the solo test, `block` for the race).
- `frontend/src/Components/TypingTest/TypingTest.tsx` — render map replaced with `<TypedWord>`;
  invariants hoisted; `useRightEdgeRef` removed.
- `frontend/src/Pages/Race.tsx` — same for `RaceTypingInput`.

## Verification

- Type-check: `npx tsc -b` (green).
- Compile: `./mvnw -q -DskipTests compile` (green — no backend change).
- Behavior parity: `activeGlobalIdx`/`lastGlobalIdx` reproduce the old `isCurrent`/`isLastChar`
  conditions (including the "cursor on the trailing space uses the previous char's right edge" case),
  and `isPastWord = lockedIndex >= end` matches the old `lockedIndex > wordEnd`.

## Rollback

Revert this commit — restores the inline per-keystroke passage render in both `TypingTest.tsx` and
`Race.tsx`.
