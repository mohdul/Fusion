import { describe, expect, it } from "vitest";
import * as LucideIcons from "lucide-react";
import { getStage, listStages } from "../session/stage-registry.js";
import { nextStageAfter } from "../sync/reconciler.js";

describe("compound engineering stage registry", () => {
  it("keeps the linear pipeline order unchanged and appends debug at the tail", () => {
    const stageIds = listStages().map((stage) => stage.stageId);

    expect(stageIds.slice(0, 5)).toEqual(["strategy", "ideate", "brainstorm", "plan", "work"]);
    expect(stageIds.at(-1)).toBe("debug");
    expect(stageIds.filter((stageId) => stageId === "debug")).toHaveLength(1);
    expect(stageIds.indexOf("plan")).toBeLessThan(stageIds.indexOf("work"));
    expect(stageIds.indexOf("work")).toBeLessThan(stageIds.indexOf("debug"));
  });

  it("aliases brainstorm to unified docs/plans artifacts without renaming the stage or skill", () => {
    const stage = getStage("brainstorm");

    expect(stage).toMatchObject({
      stageId: "brainstorm",
      order: 300,
      skillId: "ce-brainstorm",
      artifactLocation: "docs/plans/",
      artifactGlob: "docs/plans/**/*.md",
      icon: "Sparkles",
      label: "Brainstorm",
    });
    expect(nextStageAfter("brainstorm")).toBe("plan");
    expect(nextStageAfter("plan")).toBe("work");
    expect((LucideIcons as unknown as Record<string, unknown>)[stage!.icon]).toBeTruthy();
  });

  it("registers debug as a launchable ce-debug stage with a real lucide icon", () => {
    const stage = getStage("debug");

    expect(stage).toMatchObject({
      stageId: "debug",
      order: 600,
      skillId: "ce-debug",
      artifactLocation: "docs/debug/",
      artifactGlob: "docs/debug/**/*.md",
      icon: "Bug",
      label: "Debug",
    });
    expect((LucideIcons as unknown as Record<string, unknown>)[stage!.icon]).toBeTruthy();
  });
});
