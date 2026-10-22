# Use a typing-shaped skeleton for solo loading

**Area:** Frontend (`/solo` route fallback and passage loading)
**Architecture pattern:** Route-specific Suspense fallback plus a content-shaped loading state
**Status:** Done

## Issue (before)

Two different loading states broke the transition into a test. While the lazy `/solo` route chunk
was loading, the global `PageFallback` replaced the whole page with a centered spinner. After the
route mounted, the passage card showed a single "Loading passage..." line and then grew into the
full typing layout. Both states discarded the page geometry the user was about to use.

## Solution (after)

`TypingSkeleton` mirrors the typing page's header, progress bar, passage card, and footer footprint.
The `/solo` route has its own Suspense boundary using that skeleton, so only the typing content
loads behind a stable layout. `TypingPassageSkeleton` is the reusable in-card variant and replaces
the text-only passage placeholder while the queue is empty.

Both skeletons are decorative and expose a polite status label for assistive technology rather than
announcing every shimmer block.

## Impact

- The page no longer flashes a full-screen spinner before showing the typing layout.
- Header, progress, card, and footer stay in place when real content arrives, reducing layout shift.
- The route chunk and passage request now have loading states shaped like their final content.

## Files changed

- `frontend/src/Components/TypingTest/TypingSkeleton.tsx` - full-page and passage skeletons.
- `frontend/src/App.tsx` - route-specific Suspense fallback for `/solo`.
- `frontend/src/Components/TypingTest/TypingTest.tsx` - uses the passage skeleton while loading.

## Verification

- `npx tsc -b` (green).
- `npm run build` (green; the typing route remains a separate lazy chunk).
- `npm run lint` still reports pre-existing repository errors; this change introduces no new lint
  error.

## Rollback

Revert this commit. The `/solo` route returns to the global page spinner and the passage card
returns to its text-only loading line.
