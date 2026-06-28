---
"@runfusion/fusion": patch
---

summary: Tasks sent back by Code Review or Browser Verification verdicts now re-run and complete their steps before re-checking.
category: fix
dev: Fixes the post-verdict remediation bounce (requestPreMergeOptionalStepFix → sendTaskBackForFix → reopenLastStepForRevision → scheduleWorkflowRerun → graph re-run) so resumed execution re-launches the executor and drives reopened implementation/verification/delivery steps and the verdict-demanded fix to done across both in-progress and in-review bounce sources, bounded by the existing maxRevisions/maxPostReviewFixes budget.
