import { describe, expect, it } from "vitest";
import { clampTaskListText, MAX_TASK_LIST_TEXT_CHARS } from "../task-list-format.js";

describe("clampTaskListText", () => {
  it("returns an empty string for empty input", () => {
    expect(clampTaskListText([])).toBe("");
  });

  it("returns small input unchanged without a marker", () => {
    const lines = ["Todo (2):", "  FN-001  First task", "  FN-002  Second task"];

    expect(clampTaskListText(lines)).toBe(lines.join("\n"));
    expect(clampTaskListText(lines)).not.toContain("truncated to fit");
  });

  it("truncates large input to the budget with an accurate dropped-line marker", () => {
    const lines = [
      "Todo (5):",
      "  FN-001  Task one",
      "  FN-002  Task two",
      "  FN-003  Task three",
      "  FN-004  Task four",
      "  FN-005  Task five",
    ];

    const text = clampTaskListText(lines, { maxChars: 95 });

    expect(text.length).toBeLessThanOrEqual(95);
    expect(text).toContain("Todo (5):");
    expect(text).toContain("FN-001");
    expect(text).toContain("... and 4 more tasks (truncated to fit; narrow with column/limit)");
  });

  it("never splits retained lines mid-line", () => {
    const lines = [
      "Todo (4):",
      "  FN-001  Retain me whole",
      "  FN-002  Retain me whole too",
      "  FN-003  Drop me whole",
      "  FN-004  Drop me whole too",
    ];

    const text = clampTaskListText(lines, { maxChars: 105 });
    const outputLines = text.split("\n");

    expect(outputLines).toEqual([
      "Todo (4):",
      "  FN-001  Retain me whole",
      "... and 3 more tasks (truncated to fit; narrow with column/limit)",
    ]);
  });

  it("honors a custom maxChars budget", () => {
    const lines = Array.from({ length: 20 }, (_, index) => `FN-${String(index + 1).padStart(3, "0")}  ${"x".repeat(20)}`);

    const text = clampTaskListText(lines, { maxChars: 150 });

    expect(text.length).toBeLessThanOrEqual(150);
    expect(text).toContain("truncated to fit");
  });

  it("keeps default output within the exported budget", () => {
    const lines = Array.from({ length: 500 }, (_, index) => `FN-${String(index + 1).padStart(3, "0")}  ${"x".repeat(80)}`);

    expect(clampTaskListText(lines).length).toBeLessThanOrEqual(MAX_TASK_LIST_TEXT_CHARS);
  });

  it("handles a single over-budget line by returning a bounded truncation marker", () => {
    const text = clampTaskListText(["FN-001  " + "x".repeat(200)], { maxChars: 40 });

    expect(text.length).toBeLessThanOrEqual(40);
    expect(text).toMatch(/^\.\.\. and 1 more tas/);
    expect(text.endsWith("…")).toBe(true);
  });
});
