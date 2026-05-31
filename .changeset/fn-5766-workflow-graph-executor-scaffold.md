---
"@runfusion/fusion": minor
---

Add a flagged-off Workflow Graph Executor scaffold and built-in coding lifecycle Workflow IR exports.

- Adds `BUILTIN_CODING_WORKFLOW_IR` and `buildBuiltinCodingWorkflowIr` to `@fusion/core`.
- Adds `WorkflowGraphExecutor` and `WORKFLOW_GRAPH_EXECUTOR_FLAG` to `@fusion/engine`.
- Adds parity-harness skeleton tests and IR documentation updates.

The new executor path is gated by `experimentalFeatures.workflowGraphExecutor` and remains strict no-op while disabled (default).