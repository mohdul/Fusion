---
"@runfusion/fusion": minor
---

summary: Failed optional workflow steps now send tasks back for a bounded executor fix pass.
category: feature
dev: New `requestPreMergeOptionalStepFix` graph-executor seam wired to `sendTaskBackForFix`; bounded by `maxPostReviewFixes`/`postReviewFixCount`; falls through to prior advisory/gate behavior once the budget is exhausted. Pre-merge phase only; post-merge optional groups stay non-blocking.
