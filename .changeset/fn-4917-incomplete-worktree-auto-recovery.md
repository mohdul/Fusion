---
"@runfusion/fusion": patch
---

Prevent and auto-recover "Refusing to start coding agent in incomplete
worktree" session-start failures. The worktree-acquisition layer now
classifies pool-returned and resume worktrees before handing them to the
executor, and the executor's two `createResolvedAgentSession` call sites
catch the three `assertValidWorktreeSession` variants in `in-progress`,
emit `worktree:incomplete-detected` + `worktree:auto-recovered` run-audit
telemetry, and requeue the task to `todo` via the shared
`autoRecoverWorktreeSessionStartFailure` helper instead of surfacing the
error to the user. Bounded by `MAX_WORKTREE_SESSION_RETRIES = 3`.
