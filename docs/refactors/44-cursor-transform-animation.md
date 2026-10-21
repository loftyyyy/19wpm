# Refactor 4.3 — Animate the caret with transforms

**Area:** Typing caret (`TypingViewport`, `index.css`)
**Architecture pattern:** Compositor-only cursor motion
**Status:** Done

## Bottleneck / anti-pattern (before)

The caret was absolutely positioned, but every 85 ms move animated `left` and `top` with Anime.js:

```ts
animate(cursorEl, { left, top, duration: 85 });
```

Both properties participate in layout. Each animation frame forced the browser to recalculate the
caret's position and could invalidate layout around the typing viewport. The stylesheet also declared
a conflicting CSS `transform` transition and a base opacity animation that were not used by the
component's actual class names.

## Solution / enhancement (after)

- The caret is positioned once with `transform: translate3d(x, y, 0)`.
- Subsequent moves animate `translateX` and `translateY`, so the browser can keep the caret on the
  compositor instead of triggering layout.
- All invariant caret geometry (size, color, radius, stacking, pointer behavior, `will-change`) moved
  into `.typing-cursor`; the component no longer creates an inline style object per render.
- Caret state uses explicit classes: `typing-cursor-active` while typing, `animate-blink` while idle,
  and `typing-cursor-hidden` when the test is finished.
- The unused `blink-pulse` keyframes and the conflicting transform transition were removed.

The caret still measures character offsets when the cursor moves, but that read happens in a
`requestAnimationFrame` after commit and no longer writes a layout property.

## Result

The same production-preview benchmark was repeated after the change:

| Measure | After memoization | After transform caret |
| --- | --- | --- |
| `keystroke` p50 / p95 | 0.3 / 0.5 ms | 0.4 / 0.5 ms |
| `viewport` p50 / p95 | 0.2 / 0.3 ms | 0.2 / 0.3 ms |

The JavaScript timing window is effectively unchanged, as expected: the benefit is removing layout
and paint work from the animation frames themselves, which the User Timing markers do not cover.
A headless check confirmed the caret moved from `translate3d(-1px, 5.1px, 0)` to
`translate3d(305px, 5.1px, 0)` after typing, with inline `left` and `top` empty.

## Notes / trade-offs

- `translate3d` promotes the caret to its own compositing layer. The caret is a single small element,
  so the memory cost is negligible and `will-change: transform` reinforces the intent.
- Transform values are relative to the caret's original absolute position at `top: 0; left: 0`, which
  preserves the previous coordinate calculation.
- Hiding the caret with `display: none` removes it from the accessibility tree, which is appropriate
  for a decorative cursor.
- The scrolling content still animates `marginTop`; that is a separate concern and was left unchanged
  in this step.

## Files changed

- `frontend/src/Components/TypingTest/TypingViewport.tsx` — transform-based caret placement and motion.
- `frontend/src/index.css` — caret classes and removal of unused/conflicting animation rules.

## Verification

- `npx tsc -b` — green.
- `npm run build` — green.
- Headless Chrome typing check confirmed the caret uses `transform`, not `left`/`top`.
- Full 200-word benchmark rerun completed without rendering errors.

## Rollback

Revert this commit. The caret returns to inline geometry and `left`/`top` animation; typing behavior is
unchanged.
