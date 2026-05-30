---
"@runfusion/fusion": patch
---

Fix scheduler overlap starvation for coordination-only tasks by allowing no-commit/coordination scopes to bypass active file-scope leases when overlaps are limited to safe read-only paths. Implementation tasks with real write-scope overlaps remain serialized behind active leases.
