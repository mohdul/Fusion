import type { WorkflowIr } from "./workflow-ir-types.js";
import { parseWorkflowIr } from "./workflow-ir.js";
import { BUILTIN_WORKFLOW_SETTINGS } from "./builtin-workflow-settings.js";

/**
 * FNXC:WorkflowMarketing 2026-06-20-00:00:
 * Fusion needs a non-coding built-in workflow for marketing and content work. Keep the engine pipeline unchanged by reusing the standard lifecycle trait vocabulary and the canonical merge-primitive region while exposing marketing-specific columns and prompts for brief, draft, and editorial review phases.
 */
const RAW_BUILTIN_MARKETING_WORKFLOW_IR: WorkflowIr = {
  version: "v2",
  name: "builtin-marketing-workflow",
  columns: [
    { id: "ideation", name: "Ideation", traits: [{ trait: "intake" }] },
    {
      id: "backlog",
      name: "Backlog",
      traits: [{ trait: "hold", config: { release: "capacity" } }, { trait: "reset-on-entry" }],
    },
    {
      id: "drafting",
      name: "Drafting",
      traits: [
        { trait: "wip", config: { limitSetting: "maxConcurrent", countPending: true } },
        { trait: "abort-on-exit" },
        { trait: "timing" },
      ],
    },
    {
      id: "editorial-review",
      name: "Editorial review",
      traits: [{ trait: "merge-blocker" }, { trait: "human-review" }, { trait: "stall-detection" }, { trait: "merge" }],
    },
    { id: "published", name: "Published", traits: [{ trait: "complete" }] },
    { id: "archived", name: "Archived", traits: [{ trait: "archived" }] },
  ],
  nodes: [
    { id: "start", kind: "start", column: "ideation" },
    {
      id: "brief",
      kind: "prompt",
      column: "ideation",
      config: {
        seam: "planning",
        name: "Content brief",
        prompt:
          "You are a marketing content strategist. Turn this task into a concrete content brief: audience, channel, key message, format, success metric, required source material, and approval constraints.",
      },
    },
    {
      id: "draft",
      kind: "prompt",
      column: "drafting",
      config: {
        seam: "execute",
        name: "Draft content",
        prompt:
          "You are a marketing copywriter executing the approved brief. Produce the requested deliverable, following brand voice, audience intent, channel constraints, format requirements, and the brief's success metric.",
        maxRetries: 2,
      },
    },
    {
      id: "editorial",
      kind: "prompt",
      column: "editorial-review",
      config: {
        seam: "review",
        name: "Editorial review",
        prompt:
          "You are an independent editorial reviewer. Check the draft for brand voice, factual accuracy, audience fit, channel fit, CTA clarity, compliance with the brief, and substantive quality issues; block on issues that would harm publication readiness.",
      },
    },
    { id: "merge-gate", kind: "merge-gate", column: "editorial-review", config: { gate: "auto-merge" } },
    { id: "merge-retry", kind: "retry-backoff", column: "editorial-review", config: { policy: "merge", maxAttempts: 3 } },
    { id: "merge-manual-hold", kind: "manual-merge-hold", column: "editorial-review", config: { release: "manual" } },
    {
      id: "branch-group-member-integration",
      kind: "branch-group-member-integration",
      column: "editorial-review",
      config: { reworkRegion: true, maxReworkCycles: 3 },
    },
    { id: "branch-group-promotion", kind: "branch-group-promotion", column: "editorial-review" },
    {
      id: "merge-attempt",
      kind: "merge-attempt",
      column: "editorial-review",
      config: { capability: "task-merge", reworkRegion: true, maxReworkCycles: 3 },
    },
    { id: "recovery-router", kind: "recovery-router", column: "editorial-review", config: { surfaces: ["merge", "retry"] } },
    { id: "end", kind: "end", column: "published" },
  ],
  edges: [
    { from: "start", to: "brief" },
    { from: "brief", to: "draft", condition: "success" },
    { from: "draft", to: "editorial", condition: "success" },
    { from: "editorial", to: "merge-gate", condition: "success" },
    { from: "merge-gate", to: "branch-group-member-integration", condition: "outcome:auto-on" },
    { from: "merge-gate", to: "merge-manual-hold", condition: "outcome:auto-off" },
    { from: "merge-retry", to: "merge-attempt", condition: "success", kind: "rework" },
    { from: "merge-manual-hold", to: "branch-group-member-integration", condition: "success", kind: "rework" },
    { from: "branch-group-member-integration", to: "branch-group-promotion", condition: "success" },
    { from: "branch-group-member-integration", to: "merge-manual-hold", condition: "outcome:manual-required" },
    { from: "branch-group-promotion", to: "merge-attempt", condition: "success" },
    { from: "branch-group-promotion", to: "merge-manual-hold", condition: "outcome:manual-required" },
    { from: "merge-attempt", to: "end", condition: "success" },
    { from: "merge-attempt", to: "merge-retry", condition: "outcome:transient-failure" },
    { from: "merge-attempt", to: "merge-manual-hold", condition: "outcome:manual-required" },
    { from: "recovery-router", to: "merge-attempt", condition: "outcome:wake-merge", kind: "rework" },
    { from: "brief", to: "end", condition: "failure" },
    { from: "draft", to: "end", condition: "failure" },
    { from: "editorial", to: "end", condition: "failure" },
    { from: "merge-attempt", to: "end", condition: "failure" },
  ],
  settings: BUILTIN_WORKFLOW_SETTINGS,
};

export const BUILTIN_MARKETING_WORKFLOW_IR = parseWorkflowIr(RAW_BUILTIN_MARKETING_WORKFLOW_IR);
