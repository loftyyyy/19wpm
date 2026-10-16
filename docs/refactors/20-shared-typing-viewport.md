# Refactor CR-2.1 — Extract a shared typing viewport

**Area:** Frontend (`TypingTest.tsx`, `Race.tsx`, new `TypingViewport`, new `useTypingActivity`)
**Architecture pattern:** Extract a shared presentational component; hoist repeated hook logic
**Status:** Done

## Issue (before)

`TypingTest.tsx` and `Race.tsx` (`RaceTypingInput`) each carried their own copy of the same typing
surface: word/character layout, the caret-position effect, the line-tracking scroll animation, the
idle-blink flag with its 500 ms reset timer, and the per-word render loop. The two copies drifted —
the race view had a `block` extra-character variant and no restart key — and any fix to the caret or
scrolling had to be applied twice.

```tsx
// TypingTest.tsx  AND  Race.tsx — duplicated almost verbatim
const cursorRef = useRef<HTMLDivElement>(null);
const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const [isTypingActive, setIsTypingActive] = useState(false);
const isFirstPositionRef = useRef(true);
// …+ caret RAF effect, scroll layout effect, TypedWord loop, idle timer…
```

## Solution (after)

Two small modules own the shared behaviour, and each page keeps only what is genuinely page-specific
(its container, its keydown policy, its engine wiring):

- **`Components/TypingTest/TypingViewport.tsx`** — a presentational component that owns the caret,
  word layout, scroll animation, and the `TypedWord` loop. It takes the engine-derived state as props
  (`charsText`, `typedChars`, `currentIndex`, `lockedIndex`, `mistakeWordIndices`, `extraChars`,
  `isFinished`, `isTypingActive`) plus an `extraVariant` (`'plain'` for the solo test, `'block'` for
  the race), a `resetKey` to restart the viewport, and a `measureKey` to re-measure the lines when the
  passage changes.
- **`hooks/useTypingActivity.ts`** — the idle-blink state machine: `markActive()` sets the active
  flag and resets a 500 ms timer; the timer is cleared on unmount. Returns
  `{ isTypingActive, markActive }`.

```tsx
// TypingTest.tsx / Race.tsx — now just wiring
const { isTypingActive, markActive } = useTypingActivity();
// …in the keydown handler, after the page's own Tab/Enter/Escape policy…
markActive();
handleKeyDown(e);

<TypingViewport charsText={passage.text} typedChars={state.typedChars} … />
```

`TypingTest` keeps its `containerRef`, its restart/next/reset key policy, and bumps a `resetKey` on
each restart; `Race` keeps its Tab/Escape suppression and passes `extraVariant="block"`.

## Architecture pattern

- **Single presentation component as the seam:** the volatile part of the surface (caret geometry,
  line scrolling, blink timing) lives in one place; callers pass data in and stay ignorant of layout.
- **Hook extraction for the timer:** the idle-blink timer becomes a unit that both pages share instead
  of a ref-and-timer pair copied into each.

## Impact

- Removes ~300 duplicated lines; a caret/scroll fix now lands once for both the solo test and the race.
- Behaviour is unchanged: the solo view still uses the default `plain` variant, the race keeps `block`,
  and each page retains its own keyboard policy.

## Files changed

- `frontend/src/Components/TypingTest/TypingViewport.tsx` — **new** shared viewport.
- `frontend/src/hooks/useTypingActivity.ts` — **new** idle-blink hook.
- `frontend/src/Components/TypingTest/TypingTest.tsx` — use `TypingViewport` + `useTypingActivity`.
- `frontend/src/Pages/Race.tsx` — `RaceTypingInput` uses `TypingViewport` + `useTypingActivity`.

## Verification

- Types: `npx tsc -b` (clean).
- Lint: no new findings (only the pre-existing `TypingTest.tsx` and `Race.tsx` warnings).

## Rollback

Revert this commit — both pages regain their inlined viewport and idle-blink timer.
