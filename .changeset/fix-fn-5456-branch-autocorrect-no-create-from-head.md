---
"@fusion/engine": patch
---

fix(engine): never create task branches from arbitrary HEAD in autocorrect

`attemptBranchAutocorrect` previously fell back to `git checkout -B
<expected>` with no start point when rename was not applicable. If the
worktree's HEAD happened to be at a previous occupant's commit (e.g. an
orphaned tip from a different task), the new branch label silently
captured that commit — the "branch: Created from HEAD" contamination
pattern that the cross-contamination guard then refuses to auto-resolve.

This is the only branch-creation site in the engine that did not thread
a resolved base SHA; every other path (`prepareForTask`,
`reanchorBranchToBase`) already passes the base explicitly.

Autocorrect now verifies the expected ref exists and uses a plain
`git checkout`, so it can only *switch to* an already-existing branch.
When the ref is missing it returns `failed`, letting upstream recovery
(which knows the proper base) re-anchor with `prepareForTask` /
`reanchorBranchToBase`.
