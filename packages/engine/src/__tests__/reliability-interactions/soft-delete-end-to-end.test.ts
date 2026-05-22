import "../executor-test-helpers.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskStore } from "@fusion/core";
import { AutoClaimSnapshotManager } from "../../auto-claim-snapshot.js";
import { Scheduler } from "../../scheduler.js";
import { TaskExecutor } from "../../executor.js";
import { TriageProcessor } from "../../triage.js";
import { executorLog } from "../../logger.js";
import { createMockStore, resetExecutorMocks } from "../executor-test-helpers.js";

type TestTask = {
  id: string;
  title: string;
  description: string;
  status: string;
  column: string;
  createdAt: string;
  updatedAt: string;
  dependencies: string[];
  comments: unknown[];
  steps: unknown[];
  currentStep: number;
  log: unknown[];
  deletedAt?: string | null;
  paused?: boolean;
  checkedOutBy?: string | null;
};

function createEventedSoftDeleteStore(initialTasks: TestTask[] = []) {
  const listeners = new Map<string, ((payload: any) => void)[]>();
  let sequence = 1;
  const tasks = initialTasks.map((task) => ({ ...task }));

  const emit = (event: string, payload: any) => {
    for (const listener of listeners.get(event) ?? []) {
      listener(payload);
    }
  };

  const nextTimestamp = () => new Date(1_716_000_000_000 + sequence++).toISOString();

  return {
    emitEvent: emit,
    on: vi.fn((event: string, listener: (payload: any) => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
    }),
    off: vi.fn((event: string, listener: (payload: any) => void) => {
      const existing = listeners.get(event) ?? [];
      listeners.set(
        event,
        existing.filter((entry) => entry !== listener),
      );
    }),
    getSettings: vi.fn().mockResolvedValue({ globalPause: false, enginePaused: false, maxConcurrent: 2, maxWorktrees: 4 }),
    getRootDir: vi.fn().mockReturnValue("/test/project"),
    getTasksDir: vi.fn().mockReturnValue("/test/project/.fusion/tasks"),
    parseFileScopeFromPrompt: vi.fn().mockResolvedValue([]),
    logEntry: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockImplementation(async (id: string, patch: Partial<TestTask>) => {
      const task = tasks.find((entry) => entry.id === id);
      if (!task) return undefined;
      Object.assign(task, patch, { updatedAt: nextTimestamp() });
      emit("task:updated", { ...task });
      return { ...task };
    }),
    async createTask(input: Partial<TestTask> = {}) {
      const id = `FN-${String(sequence).padStart(4, "0")}`;
      const task: TestTask = {
        id,
        title: input.title ?? `Task ${id}`,
        description: input.description ?? id,
        status: input.status ?? "open",
        column: input.column ?? "triage",
        createdAt: nextTimestamp(),
        updatedAt: nextTimestamp(),
        dependencies: input.dependencies ?? [],
        comments: [],
        steps: [],
        currentStep: 0,
        log: [],
        deletedAt: input.deletedAt ?? null,
        paused: input.paused,
        checkedOutBy: input.checkedOutBy ?? null,
      };
      tasks.push(task);
      emit("task:created", { ...task });
      return { ...task };
    },
    async getTask(id: string, options?: { includeDeleted?: boolean }) {
      const task = tasks.find((entry) => entry.id === id);
      if (!task || (!options?.includeDeleted && task.deletedAt)) {
        throw new Error(`Task ${id} not found`);
      }
      return { ...task };
    },
    readTaskFromDb(id: string, options?: { includeDeleted?: boolean }) {
      const task = tasks.find((entry) => entry.id === id);
      if (!task || (!options?.includeDeleted && task.deletedAt)) {
        return undefined;
      }
      return { ...task };
    },
    async listTasks(options?: { column?: string; slim?: boolean }) {
      return tasks
        .filter((task) => !task.deletedAt)
        .filter((task) => (options?.column ? task.column === options.column : true))
        .map((task) => ({ ...task }));
    },
    async moveTask(id: string, column: string) {
      const task = tasks.find((entry) => entry.id === id);
      if (!task) {
        throw new Error(`Task ${id} not found`);
      }
      const from = task.column;
      task.column = column;
      task.updatedAt = nextTimestamp();
      emit("task:moved", { task: { ...task }, from, to: column });
      return { ...task };
    },
    async deleteTask(id: string) {
      const task = tasks.find((entry) => entry.id === id);
      if (!task) {
        throw new Error(`Task ${id} not found`);
      }
      if (task.deletedAt) {
        return { ...task };
      }
      const deletedAt = nextTimestamp();
      task.deletedAt = deletedAt;
      task.updatedAt = deletedAt;
      emit("task:deleted", { ...task });
      return { ...task };
    },
  };
}

async function createProjectEngineHarness() {
  vi.resetModules();
  const mocks = {
    runtimeStart: vi.fn(async () => undefined),
    runtimeStop: vi.fn(async () => undefined),
    runtimeResumeAfterUnpause: vi.fn(async () => undefined),
    runtimeConfigurePrMonitoring: vi.fn(),
    aiMergeTask: vi.fn(),
    execFile: vi.fn(),
    currentStore: null as Record<string, unknown> | null,
  };

  vi.doMock("@fusion/core", async (importOriginal) => {
    const { createEngineCoreMock } = await import("../../test/mockCore.js");
    return createEngineCoreMock(() => importOriginal<typeof import("@fusion/core")>(), {});
  });
  vi.doMock("../../merger.js", () => ({ aiMergeTask: mocks.aiMergeTask, sweepStaleAutostashes: vi.fn(async () => undefined) }));
  vi.doMock("node:child_process", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:child_process")>();
    return { ...actual, execFile: mocks.execFile };
  });
  vi.doMock("../../pr-monitor.js", () => ({ PrMonitor: vi.fn().mockImplementation(() => ({ onNewComments: vi.fn() })) }));
  vi.doMock("../../pr-comment-handler.js", () => ({ PrCommentHandler: vi.fn().mockImplementation(() => ({ handleNewComments: vi.fn() })) }));
  vi.doMock("../../auth-storage.js", () => ({
    createFusionAuthStorage: vi.fn(() => ({ reload: vi.fn(), getOAuthProviders: vi.fn(() => []), get: vi.fn(() => undefined) })),
  }));
  vi.doMock("../../notifier.js", () => ({ NtfyNotifier: vi.fn().mockImplementation(() => ({ start: vi.fn(), stop: vi.fn() })) }));
  vi.doMock("../../notification/index.js", () => ({
    NotificationService: vi.fn().mockImplementation(() => ({ start: vi.fn(), stop: vi.fn() })),
    OAuthExpiryMonitor: vi.fn().mockImplementation(() => ({ start: vi.fn(), stop: vi.fn() })),
  }));
  vi.doMock("../../cron-runner.js", () => ({
    CronRunner: vi.fn().mockImplementation(() => ({ start: vi.fn(), stop: vi.fn() })),
    createAiPromptExecutor: vi.fn(async () => vi.fn()),
  }));
  vi.doMock("../../runtimes/in-process-runtime.js", () => ({
    InProcessRuntime: vi.fn().mockImplementation(() => ({
      start: mocks.runtimeStart,
      stop: mocks.runtimeStop,
      resumeAfterUnpause: mocks.runtimeResumeAfterUnpause,
      getTaskStore: () => mocks.currentStore,
      getAgentStore: vi.fn(),
      getMessageStore: vi.fn(),
      getRoutineStore: vi.fn(),
      getRoutineRunner: vi.fn(),
      getHeartbeatMonitor: vi.fn(),
      getTriggerScheduler: vi.fn(),
      configurePrMonitoring: mocks.runtimeConfigurePrMonitoring,
      setActiveMergeTaskIdProvider: vi.fn(),
      setMergeEnqueuer: vi.fn(),
      setMergeActiveClearer: vi.fn(),
    })),
  }));

  const { ProjectEngine } = await import("../../project-engine.js");
  const mockStore = createEventedSoftDeleteStore() as any;
  mockStore.getActiveMergingTask = vi.fn(() => null);
  mockStore.addTaskComment = vi.fn(async () => undefined);
  mocks.currentStore = mockStore;

  const engine = new ProjectEngine(
    {
      projectId: "proj_test",
      workingDirectory: "/tmp/proj_test",
      isolationMode: "in-process",
      maxConcurrent: 2,
      maxWorktrees: 2,
    },
    {} as never,
    { skipNotifier: true },
  );

  return { engine, mockStore };
}

async function createCoreStoreForTest() {
  const rootDir = await mkdtemp(join(tmpdir(), "kb-engine-soft-delete-"));
  const globalDir = await mkdtemp(join(tmpdir(), "kb-engine-soft-delete-global-"));
  const store = new TaskStore(rootDir, globalDir, { inMemoryDb: true });
  await store.init();
  return {
    store,
    async cleanup() {
      store.stopWatching();
      store.close();
      await rm(rootDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      await rm(globalDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    },
  };
}

describe("reliability interactions: FN-5153 soft-delete end-to-end", () => {
  beforeEach(async () => {
    resetExecutorMocks();
  });

  afterEach(async () => {
    vi.doUnmock("@fusion/core");
  });

  it("keeps live readers and scheduler snapshots converged after task:deleted", async () => {
    const store = createEventedSoftDeleteStore();
    const task = await store.createTask({ column: "todo", title: "Soft delete target" });
    const snapshotManager = new AutoClaimSnapshotManager({ taskStore: store as any });
    const invalidateSpy = vi.spyOn(snapshotManager, "invalidate");
    new Scheduler(store as any, { snapshotManager } as any);

    expect((await snapshotManager.getSnapshot()).tasks.map((entry) => entry.id)).toContain(task.id);
    expect((await store.listTasks()).map((entry) => entry.id)).toContain(task.id);

    await store.deleteTask(task.id);

    await expect(store.getTask(task.id)).rejects.toThrow(`Task ${task.id} not found`);
    expect((await store.listTasks()).map((entry) => entry.id)).not.toContain(task.id);
    expect(store.readTaskFromDb(task.id, { includeDeleted: true })?.deletedAt).toBeTruthy();
    expect(invalidateSpy).toHaveBeenCalledWith("task:deleted");
    expect((await snapshotManager.getSnapshot()).tasks.map((entry) => entry.id)).not.toContain(task.id);
  });

  it("keeps executor entry points from running soft-deleted tasks", async () => {
    const deletedTask = {
      id: "FN-5153-DELETED",
      title: "Deleted",
      description: "deleted",
      status: "open",
      column: "in-progress",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      dependencies: [],
      comments: [],
      steps: [],
      currentStep: 0,
      log: [],
      deletedAt: "2026-01-02T00:00:00.000Z",
    } as any;
    const store = createMockStore();
    store.listTasks.mockResolvedValue([deletedTask]);

    const executor = new TaskExecutor(store as any, "/tmp/test");
    const warnSpy = vi.spyOn(executorLog, "warn");
    const executeSpy = vi.spyOn(executor, "execute");

    await executor.execute(deletedTask);
    await executor.resumeOrphaned();

    expect(warnSpy).toHaveBeenCalledWith("FN-5153-DELETED: refusing execute — task is soft-deleted");
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it("FN-5142 — abort in-flight executor session on task:deleted", async () => {
    const store = createEventedSoftDeleteStore();
    const stuckTaskDetector = { untrackTask: vi.fn() };
    const executor = new TaskExecutor(store as any, "/tmp/test", { stuckTaskDetector } as any);
    const abort = vi.fn().mockResolvedValue(undefined);
    const dispose = vi.fn();
    const task = await store.createTask({ column: "in-progress" });
    const taskId = task.id;

    (executor as any).activeSessions.set(taskId, { session: { abort, dispose }, seenSteeringIds: new Set<string>() });

    await store.deleteTask(taskId);
    await (executor as any).pendingTaskDisposals.get(taskId);

    expect(abort).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect((executor as any).activeSessions.has(taskId)).toBe(false);
    expect((executor as any).pausedAborted.has(taskId)).toBe(true);
    expect((executor as any).userCanceledTaskIds.has(taskId)).toBe(true);
    expect(stuckTaskDetector.untrackTask).toHaveBeenCalledWith(taskId);
  });

  it("FN-5142 — abort active merge on task:deleted", async () => {
    const { engine, mockStore } = await createProjectEngineHarness();
    const privateEngine = engine as any;
    const abort = vi.fn();
    const dispose = vi.fn();

    await engine.start();
    const task = await mockStore.createTask({ column: "in-review" });
    const taskId = task.id;
    privateEngine.activeMergeTaskId = taskId;
    privateEngine.activeMergeSession = { dispose };
    privateEngine.mergeAbortController = { abort };
    privateEngine.mergeActive.add(taskId);
    privateEngine.mergeQueue = [taskId, "FN-OTHER"];
    privateEngine.pausedReviewTaskIds.add(taskId);

    await mockStore.deleteTask(taskId);

    expect(abort).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(privateEngine.activeMergeTaskId).toBeNull();
    expect(privateEngine.activeMergeSession).toBeNull();
    expect(privateEngine.mergeAbortController).toBeNull();
    expect(privateEngine.mergeActive.has(taskId)).toBe(false);
    expect(privateEngine.mergeQueue).toEqual(["FN-OTHER"]);
    expect(privateEngine.pausedReviewTaskIds.has(taskId)).toBe(false);

    await engine.stop();
  });

  it("FN-5142 — abort triage session on task:deleted", async () => {
    const store = createEventedSoftDeleteStore();
    const abort = vi.fn().mockResolvedValue(undefined);
    const dispose = vi.fn();
    const stuckTaskDetector = { untrackTask: vi.fn() };
    const processor = new TriageProcessor(store as any, "/tmp/root", { stuckTaskDetector } as any);

    const taskId = "FN-5142-TRIAGE";
    processor.start();
    (processor as any).activeSessions.set(taskId, { abort, dispose });

    store.emitEvent("task:deleted", { id: taskId });
    await Promise.resolve();

    expect(abort).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect((processor as any).activeSessions.has(taskId)).toBe(false);
    expect((processor as any).pauseAborted.has(taskId)).toBe(true);
    expect(stuckTaskDetector.untrackTask).toHaveBeenCalledWith(taskId);

    processor.stop();
  });

  it("FN-5143 — agent log rows cleared on task:deleted", async () => {
    const core = await createCoreStoreForTest();
    const store = core.store;
    const task = await store.createTask({ description: "Test task" });

    await store.appendAgentLog(task.id, "entry-1", "text");
    await store.appendAgentLog(task.id, "entry-2", "text");
    await store.appendAgentLog(task.id, "entry-3", "text");
    await store.getAgentLogs(task.id);

    const before = (store as any).db
      .prepare("SELECT COUNT(*) as count FROM agentLogEntries WHERE taskId = ?")
      .get(task.id) as { count: number };
    expect(before.count).toBe(3);

    await store.deleteTask(task.id);

    const after = (store as any).db
      .prepare("SELECT COUNT(*) as count FROM agentLogEntries WHERE taskId = ?")
      .get(task.id) as { count: number };
    expect(after.count).toBe(0);
    await expect(store.getAgentLogs(task.id)).resolves.toEqual([]);
    await expect(store.getAgentLogCount(task.id)).resolves.toBe(0);

    await core.cleanup();
  });

  it("FN-5140 — documents excluded from live readers", async () => {
    const core = await createCoreStoreForTest();
    const store = core.store;
    const liveTask = await store.createTask({ description: "live" });
    const deletedTask = await store.createTask({ description: "deleted" });

    await store.upsertTaskDocument(liveTask.id, { key: "plan", content: "shared visibility token" });
    await store.upsertTaskDocument(deletedTask.id, { key: "notes", content: "shared visibility token" });
    await store.deleteTask(deletedTask.id);

    const all = await store.getAllDocuments();
    expect(all).toHaveLength(1);
    expect(all[0]?.taskId).toBe(liveTask.id);

    const searched = await store.getAllDocuments({ searchQuery: "shared visibility token" });
    expect(searched).toHaveLength(1);
    expect(searched[0]?.taskId).toBe(liveTask.id);

    await expect(store.getTaskDocuments(deletedTask.id)).resolves.toEqual([]);
    await expect(store.getTaskDocument(deletedTask.id, "notes")).resolves.toBeNull();
    await expect(store.getTaskDocumentRevisions(deletedTask.id, "notes")).resolves.toEqual([]);

    const row = (store as any).db
      .prepare("SELECT COUNT(*) as count FROM task_documents WHERE taskId = ?")
      .get(deletedTask.id) as { count: number };
    expect(row.count).toBeGreaterThan(0);

    await core.cleanup();
  });

  it("FN-5139 — TaskHasLineageChildrenError surfaces as 409 with lineageChildIds", async () => {
    const core = await createCoreStoreForTest();
    const store = core.store;
    const parent = await store.createTask({ description: "parent" });
    const child = await store.createTask({
      description: "child",
      source: { sourceType: "task_refine", sourceParentTaskId: parent.id },
    });

    await expect(store.deleteTask(parent.id)).rejects.toMatchObject({
      name: "TaskHasLineageChildrenError",
      taskId: parent.id,
      childIds: [child.id],
    });
    await expect(store.deleteTask(parent.id, { removeLineageReferences: true })).resolves.toMatchObject({ id: parent.id });

    await core.cleanup();
  });
  it("keeps re-delete idempotent and deleted IDs reserved", async () => {
    const store = createEventedSoftDeleteStore();
    const task = await store.createTask({ column: "todo", title: "Original" });
    const deletedEvents: string[] = [];
    store.on("task:deleted", (event) => deletedEvents.push(event.id));

    const firstDelete = await store.deleteTask(task.id);
    const secondDelete = await store.deleteTask(task.id);
    const replacement = await store.createTask({ column: "todo", title: "Replacement" });

    expect(firstDelete.deletedAt).toBeTruthy();
    expect(secondDelete.deletedAt).toBe(firstDelete.deletedAt);
    expect(deletedEvents).toEqual([task.id]);
    expect(replacement.id).not.toBe(task.id);
  });

  it("converges cleanly when in-progress → todo is immediately followed by task:deleted", async () => {
    const store = createEventedSoftDeleteStore();
    const task = await store.createTask({ column: "in-progress", title: "Race target" });
    const snapshotManager = new AutoClaimSnapshotManager({ taskStore: store as any });
    const invalidateSpy = vi.spyOn(snapshotManager, "invalidate");
    new Scheduler(store as any, { snapshotManager } as any);

    await store.moveTask(task.id, "todo");
    await store.deleteTask(task.id);

    expect(invalidateSpy).toHaveBeenCalledWith("task:deleted");
    expect((await snapshotManager.getSnapshot()).tasks.map((entry) => entry.id)).not.toContain(task.id);
    await expect(store.getTask(task.id)).rejects.toThrow(`Task ${task.id} not found`);
    expect((await store.listTasks()).map((entry) => entry.id)).not.toContain(task.id);

    const mockStore = createMockStore();
    mockStore.listTasks.mockResolvedValue([]);
    const executor = new TaskExecutor(mockStore as any, "/tmp/test");
    const warnSpy = vi.spyOn(executorLog, "warn");
    const executeSpy = vi.spyOn(executor, "execute");

    await executor.resumeOrphaned();

    expect(executeSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
