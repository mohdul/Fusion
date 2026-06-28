---
"@runfusion/fusion": minor
---

summary: Add a setting to control whether clicking outside the Quick Chat window closes it.
category: feature
dev: New project setting `quickChatCloseOnOutsideClick` (default true, preserving FN-7152 behavior). Wired through ProjectSettings/DEFAULT_PROJECT_SETTINGS, useAppSettings, the Settings → General toggle, and the Quick Chat FloatingWindow `closeOnOutsidePointerDown` prop. Project-scoped only.
