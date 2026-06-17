export const MAX_TASK_LIST_TEXT_CHARS = 12_000;

const TRUNCATION_HINT = "truncated to fit; narrow with column/limit";

function markerLine(droppedCount: number): string {
  return `... and ${droppedCount} more tasks (${TRUNCATION_HINT})`;
}

function joinWithMarker(lines: string[], marker: string): string {
  return [...lines, marker].join("\n");
}

/**
 * FNXC:TaskListOutput 2026-06-16-17:45:
 * FN-6492 requires every fn_task_list surface to emit bounded plain text so column-filtered or otherwise large board listings remain readable to text-only heartbeat agents and stay below host runtimes' imageification thresholds.
 * The default budget is intentionally below common MCP attachment-conversion limits while preserving dozens of compact task rows.
 */
export function clampTaskListText(
  lines: string[],
  opts: { maxChars?: number } = {},
): string {
  const maxChars = Math.max(1, Math.floor(opts.maxChars ?? MAX_TASK_LIST_TEXT_CHARS));
  const text = lines.join("\n");
  if (text.length <= maxChars) {
    return text;
  }

  const droppedTotal = lines.length;
  let kept = lines.slice();
  while (kept.length > 0) {
    const droppedCount = droppedTotal - kept.length;
    const candidate = joinWithMarker(kept, markerLine(droppedCount));
    if (candidate.length <= maxChars) {
      return candidate;
    }
    kept = kept.slice(0, -1);
  }

  const marker = markerLine(droppedTotal);
  if (marker.length <= maxChars) {
    return marker;
  }

  return marker.slice(0, Math.max(0, maxChars - 1)) + "…";
}
