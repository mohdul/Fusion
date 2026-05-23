---
"@fusion/dashboard": patch
---

fix(dashboard): keep mobile nav bar pinned to page bottom when keyboard opens

The mobile nav bar's `bottom` defaults to `var(--icb-bottom-offset)`, which on iOS equals the soft-keyboard height once it opens — floating the bar above the keyboard. The existing `.mobile-nav-bar--keyboard-open` override (which pins `bottom: 0`) was only applied when `!modalManager.anyModalOpen && isIOS()`, so the bar still tracked the keyboard with a modal open. Introduces `mobileNavKeyboardOpen = isMobile && keyboardOpen` as a nav-bar-only flag so the bar stays pinned in all keyboard cases. Content padding and ExecutorStatusBar remain on the gated `mobileKeyboardOpen` to preserve their existing behavior.
