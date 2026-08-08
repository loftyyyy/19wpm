# Investigation: Public Multiplayer Matchmaking Inconsistencies

## Objective
Investigate and diagnose why public multiplayer matchmaking on the `/race` page behaves inconsistently. Focus on root-causing each issue below (not just patching symptoms), and propose fixes with the affected files/modules once the root cause is confirmed.

## Test Setup
- Two separate accounts, each in a different browser (or browser profile), to simulate two independent players:
  - **Player A** — creates/joins the public lobby first
  - **Player B** — joins after Player A
- Reproduce each issue below on the `/race` page, capturing browser console logs and network tab activity (especially auth and matchmaking requests) for both players simultaneously.

## Known Symptoms

### 1. "Find Public Match" requires multiple clicks; intermittent 401s
- Clicking "Find Public Match" on `/race` sometimes does nothing on the first click and must be clicked again to actually start matchmaking.
- Console shows a **"failed to join matchmaking"** error paired with a **401 Unauthorized**.
- A separate **401 on `/auth/me`** appears around the same time.
- A **`400 Bad Request` on `/api/v1/auth/refresh`** is also observed.
- **Working hypothesis:** the automatic token refresh flow is not reliably completing before (or in response to) an expired/invalid token, causing the matchmaking request to fire with a stale token and fail silently until a manual retry.
- **Investigate:**
  - Token expiry timing vs. when refresh is triggered (is refresh proactive/scheduled, or only reactive to a 401?).
  - Why `/api/v1/auth/refresh` returns 400 — expired refresh token, malformed request, race condition with concurrent requests, refresh token already rotated/invalidated by a prior call?
  - Whether the matchmaking request and the refresh request can race each other (e.g., matchmaking fires before refresh resolves, or two refresh calls fire concurrently and the second is rejected because the first already rotated the token).
  - Whether the UI silently swallows the first failed attempt (no visible error/toast to the user), which is why it "looks like" nothing happened on first click.

### 2. Players see different lobby countdowns
- While both players wait in the lobby, Player A and Player B sometimes see **different countdown values** at the same real-world moment.
- **Expected:** both players should see an identical, synchronized countdown.
- **Investigate:**
  - Is the countdown computed/started independently on each client (client-side timer) instead of being driven by a single server-authoritative timestamp?
  - If server-authoritative, is the countdown start event delivered to both clients at different times (e.g., due to network/socket latency or reconnects), causing each client's local timer to start from a different point?
  - Check whether the countdown is recalculated from a fixed `startsAt`/`endsAt` server timestamp on each client tick, vs. each client just counting down independently from when it received the event.

### 3. Lobby shows Player B as "joined" on Player A's screen while Player B is still "connecting"
- Player A's screen shows Player B as fully in the lobby.
- Player B's own screen still shows "connecting to room."
- The countdown/match start proceeds based on Player A's (incorrect) view, without waiting for Player B's client to confirm it has actually joined the room.
- **Fix direction:** the lobby "player joined" state shown to other players should reflect a **confirmed** room-join event from Player B's client (e.g., an explicit ack/handshake once Player B's socket/session is fully established in the room), not just the server marking Player B as "assigned" to the lobby. The countdown/start logic should gate on this confirmed state for **all** players in the lobby.
- **Investigate:**
  - What event marks a player as "joined" in the lobby UI — is it based on matchmaking assignment, or an actual room-connection ack?
  - Is there a distinction in the backend between "assigned to lobby" and "connected to room," and is that distinction properly propagated to other clients?

### 4. Match starts even though a player never actually joined the room
- Lobby state indicates both players joined, but Player B was actually still in the matchmaking/finding-match flow (not yet in the room at all).
- The match starts anyway, effectively without Player B.
- **Investigate:**
  - Likely related to/compounded by issue #3 — confirm whether this is the same root cause (start condition not actually verifying live room connection) or a distinct failure mode (e.g., a stale/duplicate matchmaking result being applied to the lobby state).
  - Check for race conditions between the matchmaking service confirming a match and the room/lobby service confirming an actual socket connection.

## Suggested Investigation Order
1. Start with **#1 (auth/token refresh)**, since a flaky auth layer could be an underlying contributor to connection issues in #3 and #4 (e.g., Player B's room-join request failing/retrying silently due to the same refresh race condition).
2. Then trace the **room-join confirmation handshake** (#3 and #4 together), since they appear to share a root cause: lobby/start logic trusting an "assigned" state instead of a "connected" state.
3. Handle **#2 (countdown sync)** separately — confirm whether countdown is server-authoritative; if not, that's the fix.

## Deliverables
- Root cause for each of the 4 issues (or confirmation that 2+ share a root cause).
- Affected files/modules/services for each.
- Proposed fix approach per issue.
- Any additional logging/telemetry needed to confirm the diagnosis before shipping a fix.

## Tracked Follow-ups (Results Parity)
- **Tier 3 (deferred, not dropped): TypingReplay on the race results screen.** Practice-mode `TestResults` offers a keystroke-by-keystroke replay (`TypingReplay` in `src/Components/TypingTest/TestResults.tsx`), fed by `result.replayEvents`. Race results currently render the own-run WPM burst chart (parity tiers 1–2, shipped) but not the replay. Deferring because it needs `replayEvents` threaded through the race flow (engine → `onFinish` → `RaceResults`) and a replay UI adapted for the race context (opponents' live snapshots, not full run data). No decision to drop it permanently — revisit when race results parity work resumes.

## Tracked Follow-ups (Q2 Smoke Test)
- **"Maximum update depth exceeded" console warning after finishing a practice test.** During the Q2 smoke run, the browser console logged `Maximum update depth exceeded...` once, right after a solo practice test finished while still on `/results`. Streak + Texts Completed still updated live (no user-visible breakage), so this is a React render-loop that the depth guard tripped on, not a crash. Root cause NOT yet isolated.
  - **Investigate:** `setState`-in-`useEffect` on the `/results` page (`TestResults` and children) keyed on an object identity that changes every render. Candidate chain in `frontend/src/context/AuthContext.tsx`: `addResult` prepends to `serverResults` (new array identity each call) → on the API response `updateUser({ streak: data.streak })` → `updateUserProfile` rewrites `localStorage` `19wpm-session` + `setUser` → new `user` object identity → any `/results` effect depending on `user`/`results` re-fires and calls `setState`, looping until React throws the depth guard. Candidate files: `frontend/src/Pages/Race.tsx`, `frontend/src/Components/TypingTest/TestResults.tsx`, `frontend/src/context/AuthContext.tsx`.
- **Register form email `pattern` is an invalid regex under the modern `v` flag.** `frontend/src/Components/Auth/LoginContainer.tsx` register form uses `pattern="[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"`. The browser reports `Invalid regular expression: /.../v: Invalid character in character class` in the console (React compiles the `pattern` with the `v` flag / unicodeSets mode, where the character class is parsed as class-set syntax). Registration still succeeds — the server-side `@Email`/`@Pattern` in `RegisterRequestDTO` is the real gate — so this is console noise today, not a functional bug.
  - **Investigate/fix:** under `v`-mode class-set parsing the `-`/`+` inside `[A-Za-z0-9+_.-]` is the likely trigger. Simplest fix: drop the `pattern` attribute and rely on `type="email"` + server validation, or replace the class with a `v`-safe form (e.g. `[\w+_.-]` with `-` escaped or moved, or validate with a `RegExp` test in the submit handler instead of the `pattern` attribute).
