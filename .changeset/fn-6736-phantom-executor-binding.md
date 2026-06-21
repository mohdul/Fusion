---
"@runfusion/fusion": patch
---

Recover in-progress tasks wedged behind stale in-memory executor bindings by clearing the phantom binding and requeueing with progress and worktree preserved.
