---
"@runfusion/fusion": patch
---

Fix the executor's pre-session worktree liveness assertion firing on
freshly-created worktrees (Runfusion/Fusion#601). The gate now skips when
`acquireTaskWorktree` returns `source: "fresh"`, and legitimate failures
are classified into `missing` / `incomplete` / `unregistered` /
`outside-work-tree` with a canonicalized registered-paths snapshot in the
log plus a `worktree:incomplete-detected` run-audit event. The existing
`taskDoneRetryCount` requeue-to-`todo` contract on this gate is preserved
unchanged.
