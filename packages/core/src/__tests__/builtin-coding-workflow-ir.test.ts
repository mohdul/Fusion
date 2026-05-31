import { describe, expect, it } from "vitest";
import {
  BUILTIN_CODING_WORKFLOW_IR,
  WORKFLOW_IR_SCHEMA_VERSION,
  buildBuiltinCodingWorkflowIr,
  parseWorkflowIr,
  serializeWorkflowIr,
} from "../index.js";

describe("builtin coding workflow ir", () => {
  it("parses and round-trips", () => {
    const parsed = parseWorkflowIr(BUILTIN_CODING_WORKFLOW_IR);
    const reparsed = parseWorkflowIr(serializeWorkflowIr(parsed));
    expect(reparsed).toEqual(parsed);
    expect(parsed.schemaVersion).toBe(WORKFLOW_IR_SCHEMA_VERSION);
  });

  it("contains exactly one start and one end node", () => {
    const nodes = BUILTIN_CODING_WORKFLOW_IR.nodes;
    expect(nodes.filter((node) => node.kind === "start")).toHaveLength(1);
    expect(nodes.filter((node) => node.kind === "end")).toHaveLength(1);
  });

  it("exposes coding lifecycle stages", () => {
    const stageNodes = BUILTIN_CODING_WORKFLOW_IR.nodes.filter((node) => node.config?.stage);
    const stages = stageNodes.map((node) => String(node.config?.stage));
    expect(stages).toEqual(expect.arrayContaining(["triage", "execute", "review", "merge"]));
  });

  it("builder returns parser-validated ir", () => {
    const built = buildBuiltinCodingWorkflowIr();
    expect(built.metadata.name).toContain("Coding Lifecycle");
  });
});
