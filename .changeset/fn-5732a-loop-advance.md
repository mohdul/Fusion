---
"@runfusion/fusion": patch
---

Fix mission loop no-assertions auto-pass handling so completion deterministically advances feature `loopState` to `passed`, sets `lastValidatorStatus` to `passed`, and emits the structured `validation_auto_passed_no_assertions` audit event exactly once.