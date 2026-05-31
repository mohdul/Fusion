import { describe, expect, it, vi } from "vitest";
import { BUILTIN_CODING_WORKFLOW_IR, parseWorkflowIr } from "@fusion/core";
import { WorkflowGraphExecutor, WORKFLOW_GRAPH_EXECUTOR_FLAG } from "../workflow-graph-executor.js";

describe("workflow graph executor parity scaffold", () => {
  it("is strict no-op when flag is absent or false", async () => {
    const onNode = vi.fn();
    const executor = new WorkflowGraphExecutor({ onNode });

    const absent = await executor.run({ workflow: BUILTIN_CODING_WORKFLOW_IR, settings: undefined });
    expect(absent).toEqual({ executed: false, visitedNodeIds: [], reason: "flag-disabled" });

    const disabled = await executor.run({
      workflow: BUILTIN_CODING_WORKFLOW_IR,
      settings: { experimentalFeatures: { [WORKFLOW_GRAPH_EXECUTOR_FLAG]: false } },
    });
    expect(disabled).toEqual({ executed: false, visitedNodeIds: [], reason: "flag-disabled" });
    expect(onNode).not.toHaveBeenCalled();
  });

  it("loads builtin coding workflow IR", () => {
    const parsed = parseWorkflowIr(BUILTIN_CODING_WORKFLOW_IR);
    const stages = parsed.nodes.map((node) => String(node.config?.stage ?? ""));

    expect(stages).toEqual(expect.arrayContaining(["triage", "execute", "review", "merge"]));
  });

  it.todo("parity invariant: file-scope violations match legacy FileScopeViolationError behavior");
  it.todo("parity invariant: squash/merge contract outcomes match legacy merger");
  it.todo("parity invariant: autoMerge=false keeps in-review terminal until human merge");
  it.todo("parity invariant: moveTask in-progress->todo hard-cancels active execution");
});
