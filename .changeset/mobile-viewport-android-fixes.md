---
"@fusion/dashboard": patch
---

fix(dashboard): keep mobile nav visible on Android in landscape and when keyboard opens

- Broaden mobile media query to `(max-width: 768px), (max-height: 480px)` so phones held in landscape (which exceed 768 CSS px wide) still render the bottom nav and mobile board layout instead of the desktop horizontally-scrollable columns.
- Distinguish pinch-zoom from keyboard-open in `useMobileKeyboard` by checking `visualViewport.scale > 1` — Android Chrome ignores `user-scalable=no` for a11y, and a zoomed-in textarea was false-positiving keyboard-open and hiding `MobileNavBar`.
- Use `documentElement.clientHeight` instead of stale `window.innerHeight` when computing keyboard overlap (Android multi-window can leave `innerHeight` cached at a wildly different value than the actual layout viewport).
- Add `interactive-widget=resizes-content` to the viewport meta so Android Chrome shrinks the layout viewport with the soft keyboard, matching iOS behavior.
