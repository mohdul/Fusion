---
"@fusion/dashboard": patch
---

fix(dashboard): clear `needs action` on recent integration-branch advances after manual sync

The Git Manager's "Recent integration-branch advances" list derived `needsAction` purely from the original `merge:auto-sync` audit-event outcome. When the operator clicked "Sync working tree" — or fixed up the worktree by hand — the worktree caught up to the integration tip, but the list kept showing "(N need action)" because the historical audit events still recorded the original failure/disabled state.

`collectRecentMergeAdvances` now also checks whether each advance's `toSha` is reachable from the current HEAD. If it is, the worktree already contains that advance and `needsAction` is false regardless of what the audit trail recorded.
