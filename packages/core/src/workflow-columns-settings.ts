import type { Settings } from "./types.js";

/**
 * Workflow columns are now the default task-state model. Stale persisted
 * `experimentalFeatures.workflowColumns=false` values are ignored so operators
 * cannot fall back to the retired legacy column runtime through settings.
 *
 * FNXC:WorkflowColumns 2026-06-22-18:00:
 * The workflow column model graduated from Experimental alongside the graph
 * engine. Keep this accessor as a compatibility seam for existing call sites,
 * but make it unconditional until the legacy branches are removed.
 */
export function isWorkflowColumnsEnabled(
  _settings: Pick<Settings, "experimentalFeatures"> | undefined,
): boolean {
  return true;
}
