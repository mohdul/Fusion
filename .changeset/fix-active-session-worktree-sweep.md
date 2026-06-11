---
"@runfusion/fusion": patch
---

Stop self-healing from removing worktrees that are still in use. The idle-worktree and cap-enforcement sweeps now skip any worktree bound to a live executor/merger/step/workflow session, so a checkout is no longer reaped while its task transiently sits in `done` or loses its worktree linkage mid-run.
