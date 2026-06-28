---
"@runfusion/fusion": minor
---

summary: Done-task Summary tab now shows token usage by model with estimated cost per model and a task total.
category: feature
dev: TaskSummaryTab derives per-model USD cost client-side via costFor + global modelPricingOverrides from task.tokenUsage.perModel; unpriced models render "—" (never $0).
