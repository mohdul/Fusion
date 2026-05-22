---
"@fusion/dashboard": patch
---

fix(dashboard): stop main-chat and quick-chat composers from instantly dismissing the Android soft keyboard

Two layered Android-specific fixes for the chat composers:

1. The body scroll-lock applied while the keyboard is open in main chat was an iOS-specific workaround for visualViewport drift. On Android Chrome it does the opposite of what we want — mutating `body { position: fixed; ... }` while the keyboard is opening causes Chrome to treat it as a focus-target relayout and immediately dismisses the keyboard. `useMobileScrollLock` is now gated to iOS UAs.

2. ChatView and QuickChatFAB both had an iOS-specific `onTouchStart` on the textarea that called `event.preventDefault()` and then programmatically refocused the input (to suppress iOS's visualViewport auto-scroll on re-focus). On Android, `preventDefault` on a textarea touchstart prevents the soft keyboard from opening — programmatic `focus()` alone does not raise the Android keyboard. Result: tapping the composer focused the input but the keyboard never appeared, looking like an instant dismiss. The touchstart workaround is now gated to iOS UAs via `isIOS()`.
