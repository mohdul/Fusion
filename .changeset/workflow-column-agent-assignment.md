---
"@runfusion/fusion": minor
---

Add per-column agent assignment for workflow columns, behind the combined `experimentalFeatures.workflowColumns` + `experimentalFeatures.workflowGraphExecutor` flags.

A workflow column can now name a permanent agent from the registry plus a mode — `defer` (the column agent is the default for work in that column that carries no agent/model settings of its own) or `override` (the column agent supersedes node- and task-level agent/model settings). The binding applies to all session-running work attributable to the column's nodes: custom prompt/gate/script nodes, the execute seam's coding session, and step-execute sessions. Precedence is resolved by one shared `@fusion/core` resolver (`resolveColumnAgentBinding` + `resolveEffectiveAgent`) consumed by every reader, with defer/override expressed as explicit named rules and defer granularity all-or-nothing (an own agent identity OR a complete `modelProvider`+`modelId` pair suppresses the column agent). The binding keys off the node's declared IR column; foreach template nodes inherit the enclosing foreach node's column. A missing/deleted agent at resolution time logs and falls back to normal resolution — a live session is never aborted. The built-in default workflow carries no column agents and stays byte-identical (parity oracle); with either flag off, column agents are inert.
