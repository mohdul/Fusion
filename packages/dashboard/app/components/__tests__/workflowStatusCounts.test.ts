import { describe, expect, it } from "vitest";
import type { Task } from "@fusion/core";
import type { BoardWorkflowsPayload } from "../../api";
import { computeWorkflowStatusCounts } from "../workflowStatusCounts";

const boardWorkflows: BoardWorkflowsPayload = {
  flagEnabled: true,
  defaultWorkflowId: "default",
  taskWorkflowIds: {},
  workflows: [
    {
      id: "default",
      name: "Default",
      columns: [
        { id: "todo", name: "Todo", flags: { intake: true } },
        { id: "ready", name: "Ready", flags: {} },
        { id: "active", name: "Active", flags: { countsTowardWip: true } },
        { id: "review", name: "Review", flags: { countsTowardWip: true, mergeBlocker: true } },
        { id: "done", name: "Done", flags: { complete: true } },
        { id: "archived", name: "Archived", flags: { archived: true } },
      ],
    },
    {
      id: "design",
      name: "Design",
      columns: [
        { id: "design-todo", name: "Todo", flags: { intake: true } },
        { id: "design-active", name: "Active", flags: { countsTowardWip: true } },
        { id: "design-done", name: "Done", flags: { complete: true } },
        { id: "design-archived", name: "Archived", flags: { archived: true } },
      ],
    },
    {
      id: "empty",
      name: "Empty",
      columns: [
        { id: "empty-todo", name: "Todo", flags: { intake: true } },
        { id: "empty-active", name: "Active", flags: { countsTowardWip: true } },
        { id: "empty-done", name: "Done", flags: { complete: true } },
      ],
    },
  ],
};

function task(id: string, column: string): Task {
  return {
    id,
    title: id,
    description: id,
    column,
    dependencies: [],
    steps: [],
    currentStep: 0,
  } as Task;
}

describe("computeWorkflowStatusCounts", () => {
  it("returns an empty map when workflow metadata is unavailable", () => {
    expect(computeWorkflowStatusCounts([task("FN-1", "todo")], null).size).toBe(0);
    expect(computeWorkflowStatusCounts(undefined, undefined).size).toBe(0);
  });

  it("initializes every workflow with zero counts for empty and duplicate/populated states", () => {
    const counts = computeWorkflowStatusCounts([], boardWorkflows);

    expect(counts.get("default")).toEqual({ todo: 0, inProgress: 0, done: 0 });
    expect(counts.get("design")).toEqual({ todo: 0, inProgress: 0, done: 0 });
    expect(counts.get("empty")).toEqual({ todo: 0, inProgress: 0, done: 0 });
  });

  it("classifies todo, in-progress, and done buckets from workflow column flags", () => {
    const counts = computeWorkflowStatusCounts(
      [
        task("FN-todo", "todo"),
        task("FN-ready", "ready"),
        task("FN-active", "active"),
        task("FN-review", "review"),
        task("FN-done", "done"),
      ],
      boardWorkflows,
    );

    expect(counts.get("default")).toEqual({ todo: 2, inProgress: 2, done: 1 });
  });

  it("falls back to the default workflow when a task has no workflow assignment", () => {
    const counts = computeWorkflowStatusCounts([task("FN-unassigned", "done")], boardWorkflows);

    expect(counts.get("default")).toEqual({ todo: 0, inProgress: 0, done: 1 });
  });

  it("counts tasks independently for their assigned workflow", () => {
    const counts = computeWorkflowStatusCounts(
      [task("FN-design-todo", "design-todo"), task("FN-design-active", "design-active"), task("FN-design-done", "design-done")],
      {
        ...boardWorkflows,
        taskWorkflowIds: {
          "FN-design-todo": "design",
          "FN-design-active": "design",
          "FN-design-done": "design",
        },
      },
    );

    expect(counts.get("design")).toEqual({ todo: 1, inProgress: 1, done: 1 });
    expect(counts.get("default")).toEqual({ todo: 0, inProgress: 0, done: 0 });
  });

  it("excludes archived-column tasks and ignores unknown workflows or columns", () => {
    const counts = computeWorkflowStatusCounts(
      [task("FN-archived", "archived"), task("FN-unknown-column", "missing"), task("FN-unknown-workflow", "todo")],
      {
        ...boardWorkflows,
        taskWorkflowIds: {
          "FN-unknown-workflow": "missing-workflow",
        },
      },
    );

    expect(counts.get("default")).toEqual({ todo: 0, inProgress: 0, done: 0 });
  });
});
