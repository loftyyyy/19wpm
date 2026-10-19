# Fix — Count corrected mistakes in race accuracy (match practice mode)

**Area:** Frontend (`Race.tsx`, `useRaceSocket`) + Backend (`ProgressUpdateDTO`, `RaceService`)
**Architecture pattern:** Single accuracy definition shared across modes (cumulative keystroke stats)
**Status:** Done

## Issue (before)

Practice and race used **two different accuracy models**.

**Practice** (`useTypingEngine`) counts keystrokes cumulatively:
`accuracy = round(totalCorrect / (totalCorrect + totalIncorrect) * 100)`. `totalIncorrect` is bumped on
every wrong keystroke and is **not rolled back** when the mistake is corrected (BACKSPACE adjusts
`incorrectChars` only; only deleting extra chars/words lowers `totalIncorrect`). Any mistake therefore
lowers accuracy permanently.

**Race** derived its numbers positionally from the final typed string:

- `Race.tsx` `calcErrors(typed)` / `calcCorrectChars(typed)` compared `typed[i]` with `passage[i]`.
- The server's live path did the same via `RaceService.calculateErrors(typedContent, passage)`.

A wrong character that was backspaced and retyped correctly made `typed[i] === passage[i]`, so the
error **disappeared** — accuracy stayed at 100%. Only a mistake left uncorrected (or one that shifted
positional alignment) survived, which is why accuracy dropped only when the last word (or an
uncorrected early/middle word) was not addressed.

## Solution (after)

The race pipeline now forwards the engine's **cumulative** counters — the same numbers practice uses.

- `Race.tsx` (`RaceTypingInput`) sends `state.totalIncorrect` on every progress tick and, on finish,
  sends `errors = state.totalIncorrect` and `correctChars = state.totalCorrect` (the positional
  `calcErrors` / `calcCorrectChars` helpers are removed).
- `ProgressUpdateDTO` now carries `errors` instead of the unused `typedContent`.
- `RaceService.updateProgress` stores the client-supplied cumulative `errors` (mirroring how
  `finishRace` already consumes client-supplied counts) and no longer recomputes them; the now-unused
  `calculateErrors` helper is deleted.
- `finishRace` / `computeAccuracy` are unchanged — they now receive cumulative counts.

## Impact

- A corrected mistake still counts against accuracy in a race, exactly as in practice mode.
- Live and final race numbers agree (both cumulative), and the results screen shows the same accuracy
  the typist saw in practice.
- `RaceResult.errorCount` / `RaceParticipant.errors` now mean "cumulative incorrect keystrokes"
  (practice's `totalIncorrect`/"Mistakes"), consistent across modes.

## Files changed

- `frontend/src/Pages/Race.tsx` — send `totalIncorrect` / `totalCorrect`; drop positional helpers.
- `frontend/src/hooks/useRaceSocket.ts` — `sendProgress(..., errors)` payload.
- `backend/.../dto/race/ProgressUpdateDTO.java` — `errors` replaces `typedContent`.
- `backend/.../service/RaceService.java` — `updateProgress` takes `errors`; `calculateErrors` removed.
- `backend/.../controller/RaceStompController.java` — pass `errors` through.

## Verification

- `./mvnw -q -DskipTests compile` (green).
- `npx tsc -b` (green).

## Rollback

Revert this commit — race accuracy returns to the positional (final-string) calculation.
