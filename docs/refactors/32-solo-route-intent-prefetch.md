# Preload the solo typing route from landing intent

**Area:** Frontend (`App`, landing start CTA, route loading)
**Architecture pattern:** Intent-based route prefetching over a memoized dynamic import
**Status:** Done

## Issue (before)

`TypingTest` was imported only when React rendered `/solo`. Clicking **Start Typing** navigated
first and started downloading the route chunk second, so the global full-page spinner appeared
before the typing page itself could render. There was no opportunity to overlap the chunk download
with the user reading or configuring the landing page.

## Solution (after)

`frontend/src/routes/preloadSolo.ts` owns one memoized `import()` of the typing route. `App.tsx`
uses the same function for the lazy route, so a prefetched module and a routed load share one
promise. The landing page calls the preload:

- after 800 ms idle, without waiting for interaction;
- on pointer enter, focus, or touch start of the start button;
- on click, before navigation.

The start button also shows a busy state and rejects repeat clicks while the transition begins.

## Impact

- The solo route chunk download can complete before the user presses Start Typing.
- Navigation still renders immediately; if the chunk is not ready, Suspense shows the route
  fallback rather than blocking the click.
- The module is requested at most once per page load because the dynamic import is memoized.

## Files changed

- `frontend/src/routes/preloadSolo.ts` - memoized route import.
- `frontend/src/App.tsx` - lazy route uses the shared preload function.
- `frontend/src/LandingPage/Landing-page.tsx` - idle/intent prefetch and start-button feedback.

## Verification

- `npx tsc -b` (green).
- `npm run build` (green; `TypingTest` remains a separate lazy chunk).
- `npm run lint` still reports pre-existing repository errors (empty catches, hook purity, and
  fast-refresh rules); this change introduces no new lint error.

## Rollback

Revert this commit. The landing page no longer preloads the typing chunk and the route returns to
loading only after navigation.
