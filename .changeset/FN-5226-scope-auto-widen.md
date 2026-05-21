---
"@runfusion/fusion": patch
---

Merger Layer 2.5: auto-widen `## File Scope` for files whose branch-side commits
are exclusively attributed to the current task before the FN-4956 scope
partition strips them. Emits `merge:scope:auto-widen` run-audit events.
Fail-closed against foreign commits, cross-task scope claims, and ignored paths.
