import { afterEach, beforeEach, describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  detectSelfDefeatingDependency,
  SELF_DEFEATING_OPERATION_VERBS,
  SelfDefeatingDependencyError,
} from "../store.js";
import { createSharedTaskStoreTestHarness } from "./store-test-helpers.js";

describe("self-defeating dependency detection", () => {
  it.each(SELF_DEFEATING_OPERATION_VERBS)("matches verb %s", (verb) => {
    const title = `${verb[0]!.toUpperCase()}${verb.slice(1)} FN-100`;
    expect(detectSelfDefeatingDependency(title, ["FN-100"]))
      .toEqual({ matchedVerb: verb, operandTaskId: "FN-100" });
  });

  it("returns null when FN operand is not in dependencies", () => {
    expect(detectSelfDefeatingDependency("Finalize FN-100", ["FN-200"])).toBeNull();
  });

  it("returns null when title has FN id but no matching verb", () => {
    expect(detectSelfDefeatingDependency("Refine FN-100", ["FN-100"])).toBeNull();
  });

  it("keeps test titles legal", () => {
    expect(detectSelfDefeatingDependency("Test FN-4847", ["FN-4847"])).toBeNull();
  });

  it("returns null for empty titles", () => {
    expect(detectSelfDefeatingDependency(undefined, ["FN-100"])).toBeNull();
    expect(detectSelfDefeatingDependency("   ", ["FN-100"])).toBeNull();
  });

  it("matches case-insensitive verbs and ids", () => {
    expect(detectSelfDefeatingDependency("FINALIZE FN-100", ["fn-100"]))
      .toEqual({ matchedVerb: "finalize", operandTaskId: "FN-100" });
    expect(detectSelfDefeatingDependency("finalize fn-100", ["FN-100"]))
      .toEqual({ matchedVerb: "finalize", operandTaskId: "FN-100" });
  });

  it("enforces whole-word boundaries", () => {
    expect(detectSelfDefeatingDependency("refinalize FN-100", ["FN-100"])).toBeNull();
    expect(detectSelfDefeatingDependency("re-finalize FN-100", ["FN-100"]))
      .toEqual({ matchedVerb: "finalize", operandTaskId: "FN-100" });
  });

  it("matches manual recovery phrase", () => {
    expect(detectSelfDefeatingDependency("Manual recovery: FN-100 stuck", ["FN-100"]))
      .toEqual({ matchedVerb: "manual recovery", operandTaskId: "FN-100" });
  });
});

describe("TaskStore create-time self-defeating dep guard", () => {
  const harness = createSharedTaskStoreTestHarness();

  beforeAll(harness.beforeAll);
  afterAll(harness.afterAll);

  beforeEach(async () => {
    await harness.beforeEach();
  });

  afterEach(async () => {
    await harness.afterEach();
  });

  it("rejects createTask with SelfDefeatingDependencyError and persists nothing", async () => {
    await expect(
      harness.store().createTask({
        title: "Finalize FN-4847: mark steps done",
        description: "manual closeout",
        dependencies: ["FN-4847"],
      }),
    ).rejects.toMatchObject({
      name: "SelfDefeatingDependencyError",
      code: "SELF_DEFEATING_DEPENDENCY",
      taskTitle: "Finalize FN-4847: mark steps done",
      matchedVerb: "finalize",
      operandTaskId: "FN-4847",
    } satisfies Partial<SelfDefeatingDependencyError>);

    const tasks = await harness.store().listTasks();
    expect(tasks).toHaveLength(0);
  });

  it("rejects createTaskWithReservedId for same shape", async () => {
    await expect(
      harness.store().createTaskWithReservedId(
        {
          title: "Finalize FN-4847: mark steps done",
          description: "manual closeout",
          dependencies: ["FN-4847"],
        },
        { taskId: "FN-9000" },
      ),
    ).rejects.toMatchObject({
      code: "SELF_DEFEATING_DEPENDENCY",
      matchedVerb: "finalize",
      operandTaskId: "FN-4847",
    });
  });

  it("allows non-operational sibling title", async () => {
    const created = await harness.store().createTask({
      title: "Test FN-4847",
      description: "verification task",
      dependencies: ["FN-4847"],
    });
    expect(created.id).toMatch(/^FN-/);
    expect(created.dependencies).toEqual(["FN-4847"]);
  });
});
