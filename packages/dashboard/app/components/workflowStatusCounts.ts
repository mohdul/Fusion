import type { Task } from "@fusion/core";
import type { BoardWorkflowColumn, BoardWorkflowsPayload } from "../api";

export interface WorkflowStatusCounts {
  todo: number;
  inProgress: number;
  done: number;
}

const EMPTY_COUNTS = (): WorkflowStatusCounts => ({ todo: 0, inProgress: 0, done: 0 });

/**
 * FNXC:WorkflowSwitcher 2026-06-20-00:09:
 * The board/list workflow dropdown must show compact Todo, In Progress, and Done task counts for every selectable workflow without duplicating logic across render surfaces.
 * Use workflow column flags as the source of truth: archived columns are excluded, complete columns count as Done, active non-intake WIP columns count as In Progress, and all remaining visible work counts as Todo/not-yet-started.
 */
export function computeWorkflowStatusCounts(
  tasks: readonly Task[] | null | undefined,
  boardWorkflows: BoardWorkflowsPayload | null | undefined,
): Map<string, WorkflowStatusCounts> {
  const countsByWorkflow = new Map<string, WorkflowStatusCounts>();
  if (!boardWorkflows) return countsByWorkflow;

  const workflowsById = new Map(boardWorkflows.workflows.map((workflow) => [workflow.id, workflow]));
  const columnsByWorkflowId = new Map<string, Map<string, BoardWorkflowColumn>>();

  for (const workflow of boardWorkflows.workflows) {
    countsByWorkflow.set(workflow.id, EMPTY_COUNTS());
    columnsByWorkflowId.set(workflow.id, new Map(workflow.columns.map((column) => [column.id, column])));
  }

  if (!tasks?.length) return countsByWorkflow;

  for (const task of tasks) {
    const workflowId = boardWorkflows.taskWorkflowIds[task.id] ?? boardWorkflows.defaultWorkflowId;
    const workflow = workflowsById.get(workflowId);
    if (!workflow) continue;

    const column = columnsByWorkflowId.get(workflow.id)?.get(task.column);
    if (!column || column.flags.archived) continue;

    const counts = countsByWorkflow.get(workflow.id) ?? EMPTY_COUNTS();
    if (column.flags.complete) {
      counts.done += 1;
    } else if (column.flags.countsTowardWip && !column.flags.intake) {
      counts.inProgress += 1;
    } else {
      counts.todo += 1;
    }
    countsByWorkflow.set(workflow.id, counts);
  }

  return countsByWorkflow;
}
