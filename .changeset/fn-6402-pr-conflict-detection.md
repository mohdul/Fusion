---
"@runfusion/fusion": patch
---

Fix Create Pull Request conflict preflight to derive `conflictsWithBase` from `git merge-tree --write-tree` exit codes instead of non-empty output, and treat no-op PR conflict resolution merges as successful without attempting an empty commit.
