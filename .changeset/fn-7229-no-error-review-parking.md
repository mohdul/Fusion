---
"@runfusion/fusion": patch
---

summary: Stop routing failed workflow execution into the review column.
category: fix
dev: Graph and execution failures now stay executable or failed in-place instead of handing errored tasks to in-review.
