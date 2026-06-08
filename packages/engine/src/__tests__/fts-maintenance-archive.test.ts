import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TaskStore, type Settings, type TaskStore as TaskStoreType } from "@fusion/core";

import { SelfHealingManager } from "../self-healing.js";

function createMockStore(overrides: Record<string, unknown> = {}): TaskStoreType & EventEmitter {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    getSettings: vi.fn().mockResolvedValue({
      maintenanceIntervalMs: 0,
      globalPause: false,
      enginePaused: false,
    } as unknown as Settings),
    listTasks: vi.fn().mockResolvedValue([]),
    recordRunAuditEvent: vi.fn().mockResolvedValue(undefined),
    fts5Available: true,
    archiveFts5Available: false,
    getFtsIndexBytes: vi.fn().mockReturnValueOnce(4096).mockReturnValueOnce(2048),
    getTaskRowCount: vi.fn().mockReturnValue(4),
    optimizeFts5: vi.fn().mockReturnValue(true),
    getDatabase: vi.fn().mockReturnValue({ rebuildFts5Index: vi.fn().mockReturnValue(true) }),
    getArchiveFtsIndexBytes: vi.fn(),
    getArchivedRowCount: vi.fn(),
    optimizeArchiveFts5: vi.fn(),
    rebuildArchiveFts5Index: vi.fn(),
    ...overrides,
  }) as unknown as TaskStoreType & EventEmitter;
}

function makeTmpDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

const createdDirs = new Set<string>();

function trackDir(path: string): string {
  createdDirs.add(path);
  return path;
}

async function createStore(options?: { disableFts5?: boolean; inMemoryDb?: boolean }) {
  const prevEnv = process.env.FUSION_DISABLE_FTS5;
  if (options?.disableFts5) {
    process.env.FUSION_DISABLE_FTS5 = "1";
  } else if (prevEnv === "1") {
    delete process.env.FUSION_DISABLE_FTS5;
  }

  const rootDir = trackDir(makeTmpDir("kb-engine-archive-fts-root-"));
  const globalDir = trackDir(makeTmpDir("kb-engine-archive-fts-global-"));
  const store = new TaskStore(rootDir, globalDir, { inMemoryDb: options?.inMemoryDb === true });
  await store.init();
  const manager = new SelfHealingManager(store, { rootDir });

  return {
    rootDir,
    globalDir,
    store,
    manager,
    restoreEnv() {
      if (prevEnv === undefined) {
        delete process.env.FUSION_DISABLE_FTS5;
      } else {
        process.env.FUSION_DISABLE_FTS5 = prevEnv;
      }
    },
  };
}

async function cleanupStore(context: Awaited<ReturnType<typeof createStore>> | undefined) {
  if (!context) return;
  context.manager.stop();
  context.store.close();
  context.restoreEnv();
  await rm(context.rootDir, { recursive: true, force: true });
  await rm(context.globalDir, { recursive: true, force: true });
  createdDirs.delete(context.rootDir);
  createdDirs.delete(context.globalDir);
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of Array.from(createdDirs)) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      rmSync(dir, { recursive: true, force: true });
    } finally {
      createdDirs.delete(dir);
    }
  }
});

describe("SelfHealingManager archive FTS maintenance", () => {
  it("skips the archive branch without disturbing live maintenance when archive FTS is unavailable", async () => {
    const store = createMockStore();
    const manager = new SelfHealingManager(store, { rootDir: "/tmp/test-project" });
    (manager as any).maintenanceTickCounter = 1;

    await (manager as any).maintainTaskFts();

    expect(store.optimizeFts5).toHaveBeenCalledWith("merge");
    expect(store.getArchiveFtsIndexBytes).not.toHaveBeenCalled();
    expect(store.optimizeArchiveFts5).not.toHaveBeenCalled();
    expect(store.recordRunAuditEvent).toHaveBeenCalledTimes(1);
    expect(store.recordRunAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      mutationType: "task:fts-maintenance",
      target: "tasks_fts",
    }));
  });

  it("compacts a real disk-backed archive index and preserves archive search results", async () => {
    let ctx: Awaited<ReturnType<typeof createStore>> | undefined;
    try {
      ctx = await createStore();
      const { store, manager } = ctx;
      const archiveDb = (store as any).archiveDb;
      if (!archiveDb.fts5Available) {
        expect(store.archiveFts5Available).toBe(false);
        return;
      }

      const archivedTask = await store.createTask({
        title: "archive maintenance seed",
        description: "archive-maintenance-needle",
        column: "done",
      });
      await store.archiveTask(archivedTask.id);

      const archivedEntry = await store.findInArchive(archivedTask.id);
      expect(archivedEntry).toBeDefined();
      const seedEntry = archivedEntry!;

      const payload = "alpha ".repeat(1600);
      for (let i = 0; i < 240; i++) {
        archiveDb.upsert({
          ...seedEntry,
          title: `archive-maintenance-seed-${i}`,
          description: `${payload}archive-maintenance-needle marker-${i}`,
          comments: [{ id: `c-${i}`, text: `${payload}comment-${i}`, author: "tester", createdAt: new Date(1717372800000 + i * 1000).toISOString() }],
          archivedAt: new Date(1717372800000 + i * 1000).toISOString(),
          updatedAt: new Date(1717372800000 + i * 1000).toISOString(),
        });
      }

      const grownBytes = store.getArchiveFtsIndexBytes();
      expect(grownBytes).not.toBeNull();
      expect(grownBytes!).toBeGreaterThan(512 * 1024);

      const beforeResults = await store.searchTasks("archive-maintenance-needle");
      expect(beforeResults.map((task) => task.id)).toContain(archivedTask.id);

      (manager as any).maintenanceTickCounter = 24;
      await (manager as any).maintainTaskFts();

      const compactedBytes = store.getArchiveFtsIndexBytes();
      expect(compactedBytes).not.toBeNull();
      expect(compactedBytes!).toBeLessThan(grownBytes!);
      expect(compactedBytes!).toBeLessThan(store.getArchivedRowCount() * 512 * 1024);

      const afterResults = await store.searchTasks("archive-maintenance-needle");
      expect(afterResults.map((task) => task.id)).toContain(archivedTask.id);

      const auditEvents = store.getRunAuditEvents({ mutationType: "task:fts-maintenance", limit: 20 })
        .filter((event) => event.target === "archived_tasks_fts");
      expect(auditEvents.length).toBeGreaterThan(0);
      expect(auditEvents.at(-1)).toEqual(expect.objectContaining({
        mutationType: "task:fts-maintenance",
        target: "archived_tasks_fts",
        metadata: expect.objectContaining({
          rowCount: 1,
        }),
      }));
    } finally {
      await cleanupStore(ctx);
    }
  });

  it("keeps archive fallback search working when FTS5 is disabled", async () => {
    let ctx: Awaited<ReturnType<typeof createStore>> | undefined;
    try {
      ctx = await createStore({ disableFts5: true });
      const { store, manager } = ctx;

      const archivedTask = await store.createTask({
        title: "archive fallback target",
        description: "archive-fallback-needle",
        column: "done",
      });
      await store.archiveTask(archivedTask.id);

      await expect((manager as any).maintainTaskFts()).resolves.toBeUndefined();
      expect(store.archiveFts5Available).toBe(false);

      const results = await store.searchTasks("archive-fallback-needle");
      expect(results.map((task) => task.id)).toContain(archivedTask.id);
    } finally {
      await cleanupStore(ctx);
    }
  });
});
