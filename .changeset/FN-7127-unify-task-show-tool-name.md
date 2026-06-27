---
"@runfusion/fusion": patch
---

summary: The task detail tool is now named fn_task_show consistently across triage, planning, chat, and CLI surfaces.
category: internal
dev: Renames the legacy fn_task_get registration to canonical fn_task_show in createTriageTools (engine) and createPlanningBoardTools (dashboard), updates all prompt references and the FN-7118 cross-surface drift test, and retains fn_task_get in BOTH READONLY_FN_TOOLS and COORDINATION_EXEMPT_TOOLS as a deprecated recognition alias for backward-compatible action-gate classification and analytics.
