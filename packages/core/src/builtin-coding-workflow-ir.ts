import { parseWorkflowIr, serializeWorkflowIr } from "./workflow-ir.js";
import { WORKFLOW_IR_SCHEMA_VERSION, type WorkflowIr } from "./workflow-ir-types.js";

/**
 * Built-in coding lifecycle workflow encoded in v1 Workflow IR.
 *
 * Mapping notes:
 * - Legacy "agent-call" semantics are represented by `prompt` nodes with `config.agentRole`.
 * - Typed edge semantics are represented via `edge.condition` tokens.
 */
export const BUILTIN_CODING_WORKFLOW_IR: WorkflowIr = {
  schemaVersion: WORKFLOW_IR_SCHEMA_VERSION,
  metadata: {
    name: "Built-in Coding Lifecycle Workflow",
    description: "Legacy authoritative coding lifecycle encoded as v1 IR scaffold.",
    createdAt: "2026-05-31T00:00:00.000Z",
    templateId: "builtin-coding-lifecycle-v1",
  },
  nodes: [
    { id: "node-start", kind: "start", label: "Start" },
    {
      id: "node-triage",
      kind: "prompt",
      label: "Triage",
      config: { stage: "triage", agentRole: "triage", legacySeam: "triage" },
    },
    {
      id: "node-execute",
      kind: "prompt",
      label: "Execute",
      config: { stage: "execute", agentRole: "executor", legacySeam: "executor" },
    },
    {
      id: "node-review",
      kind: "gate",
      label: "Review",
      config: { stage: "review", gateMode: "approval", legacySeam: "reviewer" },
    },
    {
      id: "node-merge",
      kind: "script",
      label: "Merge",
      config: { stage: "merge", script: "legacy-merger", legacySeam: "merger" },
    },
    { id: "node-end", kind: "end", label: "End" },
  ],
  edges: [
    { id: "edge-start-triage", from: "node-start", to: "node-triage" },
    { id: "edge-triage-execute", from: "node-triage", to: "node-execute", condition: "success" },
    { id: "edge-execute-review", from: "node-execute", to: "node-review", condition: "success" },
    { id: "edge-review-merge", from: "node-review", to: "node-merge", condition: "approved" },
    { id: "edge-review-execute", from: "node-review", to: "node-execute", condition: "revise" },
    { id: "edge-merge-end", from: "node-merge", to: "node-end", condition: "success" },
  ],
};

/** Ensure built-in IR remains parser-valid and serializable. */
export function buildBuiltinCodingWorkflowIr(): WorkflowIr {
  return parseWorkflowIr(serializeWorkflowIr(BUILTIN_CODING_WORKFLOW_IR));
}
