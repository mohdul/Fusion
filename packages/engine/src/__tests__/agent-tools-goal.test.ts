import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaskStore, collectCitedGoalIdsFromAudit, type RunAuditEventInput } from "@fusion/core";
import { createGoalListTool, createGoalShowTool } from "../agent-tools.js";
import { GOAL_RETRIEVAL_INVOKED } from "../goal-anchoring-audit.js";

function makeTmpDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  return first && first.type === "text" ? (first.text ?? "") : "";
}

function detailsOf<T>(result: { details: unknown }): T {
  return result.details as T;
}

const callCtx = [undefined, undefined] as const;

describe("goal retrieval agent tools", () => {
  let rootDir: string;
  let globalDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    rootDir = makeTmpDir("kb-engine-goal-tools-");
    globalDir = makeTmpDir("kb-engine-goal-tools-global-");
    store = new TaskStore(rootDir, globalDir, { inMemoryDb: true });
    await store.init();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    store.close();
    await rm(rootDir, { recursive: true, force: true });
    await rm(globalDir, { recursive: true, force: true });
  });

  it("lists no goals with stable empty-state output", async () => {
    const tool = createGoalListTool(store);
    const result = await tool.execute("list-1", {}, ...callCtx, {} as never);

    expect(textOf(result)).toBe(["Goals (0) [filter: active]", "Active: 0/5", "", "No goals found."].join("\n"));
    expect(detailsOf(result)).toEqual({
      goals: [],
      activeCount: 0,
      softWarning: false,
      hardLimit: 5,
    });
  });

  it("lists goals concisely without dumping multiline descriptions", async () => {
    const created = store.getGoalStore().createGoal({
      title: "Grow plugin ecosystem",
      description: "First line with extra    spaces that should collapse before truncation because it is intentionally very long and verbose.\nSecond line must never appear in fn_goal_list output.",
    });
    const tool = createGoalListTool(store);
    const result = await tool.execute("list-2", {}, ...callCtx, {} as never);
    const text = textOf(result);

    expect(text).toContain(`- ${created.id} [active] Grow plugin ecosystem — First line with extra spaces`);
    expect(text).toContain("…");
    expect(text).not.toContain("Second line must never appear");
    expect(detailsOf<{ goals: Array<{ id: string; title: string; status: string; snippet?: string }> }>(result).goals).toEqual([
      {
        id: created.id,
        title: "Grow plugin ecosystem",
        status: "active",
        snippet: "First line with extra spaces that should collapse before truncation because it…",
      },
    ]);
  });

  it("supports archived and all status filters with soft warning output", async () => {
    const goalStore = store.getGoalStore();
    const archived = goalStore.createGoal({ title: "Archive me", description: "one line" });
    goalStore.archiveGoal(archived.id);
    goalStore.createGoal({ title: "One" });
    goalStore.createGoal({ title: "Two" });
    goalStore.createGoal({ title: "Three" });

    const tool = createGoalListTool(store);
    const archivedResult = await tool.execute("list-archived", { status: "archived" }, ...callCtx, {} as never);
    const allResult = await tool.execute("list-all", { status: "all" }, ...callCtx, {} as never);

    expect(textOf(archivedResult)).toBe([
      "Goals (1) [filter: archived]",
      "Active: 3/5",
      "⚠  3/5 active goals — soft warning at 3, hard cap at 5",
      "",
      `- ${archived.id} [archived] Archive me — one line`,
    ].join("\n"));
    expect(textOf(allResult)).toContain("Goals (4) [filter: all]");
    expect(textOf(allResult)).toContain("⚠  3/5 active goals — soft warning at 3, hard cap at 5");
    expect(resultGoalIds(detailsOf<{ goals: Array<{ id: string }> }>(allResult).goals)).toEqual(expect.arrayContaining([archived.id]));
  });

  it("shows full goal details including multiline descriptions", async () => {
    const created = store.getGoalStore().createGoal({
      title: "Stabilize goal citations",
      description: "Line one\n- bullet two",
    });
    const tool = createGoalShowTool(store);
    const result = await tool.execute("show-1", { id: created.id }, ...callCtx, {} as never);
    const text = textOf(result);

    expect((result as { isError?: boolean }).isError).toBeUndefined();
    expect(text).toContain(`${created.id}: Stabilize goal citations`);
    expect(text).toContain("Status: active");
    expect(text).toContain("Description: Line one\n- bullet two");
    expect(detailsOf<{ goal: Record<string, unknown> }>(result).goal).toMatchObject({
      id: created.id,
      title: "Stabilize goal citations",
      description: "Line one\n- bullet two",
      status: "active",
    });
  });

  it("returns GOAL_NOT_FOUND for missing goals", async () => {
    const tool = createGoalShowTool(store);
    const result = await tool.execute("show-404", { id: "G-404" }, ...callCtx, {} as never);

    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textOf(result)).toBe("Goal G-404 not found");
    expect(detailsOf(result)).toEqual({ code: "GOAL_NOT_FOUND", goalId: "G-404" });
  });

  it("emits retrieval audit events when run context is available", async () => {
    const events: RunAuditEventInput[] = [];
    const recordSpy = vi.spyOn(store, "recordRunAuditEvent").mockImplementation((event) => {
      events.push(event);
      return event as never;
    });
    const created = store.getGoalStore().createGoal({ title: "Reliable engine goal tools" });
    const listTool = createGoalListTool(store, { runContext: { runId: "run-1", agentId: "agent-1" }, taskId: "FN-5977" });
    const showTool = createGoalShowTool(store, { runContext: { runId: "run-1", agentId: "agent-1" }, taskId: "FN-5977" });

    await listTool.execute("list-audit", { status: "active" }, ...callCtx, {} as never);
    await showTool.execute("show-audit", { id: created.id }, ...callCtx, {} as never);
    await showTool.execute("show-missing", { id: "G-404" }, ...callCtx, {} as never);

    const goalEvents = events.filter((event) => event.mutationType === GOAL_RETRIEVAL_INVOKED);
    expect(recordSpy).toHaveBeenCalled();
    expect(goalEvents).toHaveLength(3);
    expect(goalEvents[0]).toMatchObject({
      target: "goals",
      metadata: expect.objectContaining({ toolName: "fn_goal_list", count: 1, goalIds: [created.id], notFound: false }),
    });
    expect(goalEvents[1]).toMatchObject({
      target: created.id,
      metadata: expect.objectContaining({ toolName: "fn_goal_show", count: 1, goalIds: [created.id], notFound: false }),
    });
    expect(goalEvents[2]).toMatchObject({
      target: "G-404",
      metadata: expect.objectContaining({ toolName: "fn_goal_show", count: 0, goalIds: [], notFound: true }),
    });

    const citedGoalEvents = goalEvents.filter((event) => event.metadata?.notFound !== true);
    expect(collectCitedGoalIdsFromAudit(citedGoalEvents as any)).toEqual({
      injectedGoalIds: [],
      retrievedGoalIds: [created.id],
      citedGoalIds: [created.id],
    });
  });

  it("silently skips retrieval audit when run context is absent", async () => {
    const recordSpy = vi.spyOn(store, "recordRunAuditEvent");
    const created = store.getGoalStore().createGoal({ title: "No audit without context" });
    const listTool = createGoalListTool(store);
    const showTool = createGoalShowTool(store);

    await listTool.execute("list-no-audit", {}, ...callCtx, {} as never);
    await showTool.execute("show-no-audit", { id: created.id }, ...callCtx, {} as never);
    await showTool.execute("show-no-audit-404", { id: "G-404" }, ...callCtx, {} as never);

    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("accepts engine-style ctx metadata for audit emission", async () => {
    const events: RunAuditEventInput[] = [];
    vi.spyOn(store, "recordRunAuditEvent").mockImplementation((event) => {
      events.push(event);
      return event as never;
    });
    const created = store.getGoalStore().createGoal({ title: "Citable goal" });
    const tool = createGoalShowTool(store);

    await tool.execute(
      "show-ctx",
      { id: created.id },
      ...callCtx,
      { runId: "run-ctx", agentId: "agent-ctx", taskId: "FN-CTX" } as never,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      runId: "run-ctx",
      agentId: "agent-ctx",
      taskId: "FN-CTX",
      mutationType: GOAL_RETRIEVAL_INVOKED,
      metadata: expect.objectContaining({ goalIds: [created.id] }),
    });
  });
});

function resultGoalIds(goals: Array<{ id: string }>): string[] {
  return goals.map((goal) => goal.id);
}
