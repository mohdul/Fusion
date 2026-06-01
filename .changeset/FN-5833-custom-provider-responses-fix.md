---
"@runfusion/fusion": patch
---

Fix custom-provider model resolution in the bundled engine for OpenAI Responses API providers.

- Align custom-provider reads with global settings directory resolution (including legacy `~/.pi/fusion` and `~/.pi/kb` migration paths), so providers persist across restart and remain visible during agent session creation.
- Ensure custom provider registration diagnostics include enough detail for troubleshooting registration failures.
- Improve configured-model resolution errors to clearly identify the failing `provider/model` selection while retaining the existing `"was not found in the pi model registry"` matcher substring and pointing users to Settings → Custom Providers.
- Add regression tests covering legacy settings-path custom-provider loading and openai-responses provider model resolution.
