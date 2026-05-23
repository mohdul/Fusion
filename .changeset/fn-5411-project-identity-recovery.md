---
"@runfusion/fusion": minor
---

Per-project `fusion.db` now persists the canonical `projectId` in `__meta.projectIdentity`. If the central registry loses a project row, the next startup reattaches the same id from the stored identity instead of silently minting a new one (which would hide all project-scoped data keyed to the old id). Interactive flows prompt before destructive overwrites.
