import { isExperimentalFeatureEnabled, type Settings, type Task, type WorkflowIr, type WorkflowIrEdge, type WorkflowIrNode } from "@fusion/core";

export const WORKFLOW_GRAPH_EXECUTOR_FLAG = "workflowGraphExecutor" as const;

export interface WorkflowGraphExecutorDependencies {
  onNode?: (node: WorkflowIrNode) => Promise<void> | void;
}

export interface WorkflowGraphExecutorRunInput {
  workflow: WorkflowIr;
  settings?: Pick<Settings, "experimentalFeatures">;
  task?: Pick<Task, "id">;
}

export interface WorkflowGraphExecutorRunResult {
  executed: boolean;
  visitedNodeIds: string[];
  reason?: "flag-disabled";
}

export class WorkflowGraphExecutor {
  constructor(private readonly deps: WorkflowGraphExecutorDependencies = {}) {}

  async run(input: WorkflowGraphExecutorRunInput): Promise<WorkflowGraphExecutorRunResult> {
    if (!isExperimentalFeatureEnabled(input.settings, WORKFLOW_GRAPH_EXECUTOR_FLAG)) {
      return { executed: false, visitedNodeIds: [], reason: "flag-disabled" };
    }

    const nodesById = new Map(input.workflow.nodes.map((node) => [node.id, node]));
    const outgoingByNode = new Map<string, WorkflowIrEdge[]>();
    for (const edge of input.workflow.edges) {
      const list = outgoingByNode.get(edge.from) ?? [];
      list.push(edge);
      outgoingByNode.set(edge.from, list);
    }

    const startNodes = input.workflow.nodes.filter((node) => node.kind === "start");
    if (startNodes.length !== 1) {
      throw new Error(`WorkflowGraphExecutor expected exactly one start node, received ${startNodes.length}.`);
    }

    const visitedNodeIds: string[] = [];
    const queue: string[] = [startNodes[0].id];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || seen.has(nodeId)) continue;
      seen.add(nodeId);

      const node = nodesById.get(nodeId);
      if (!node) {
        throw new Error(`WorkflowGraphExecutor found unknown node id: ${nodeId}`);
      }

      visitedNodeIds.push(node.id);
      await this.dispatchNode(node);
      const nextEdges = outgoingByNode.get(node.id) ?? [];
      for (const edge of nextEdges) {
        queue.push(edge.to);
      }
    }

    return { executed: true, visitedNodeIds };
  }

  private async dispatchNode(node: WorkflowIrNode): Promise<void> {
    await this.deps.onNode?.(node);
    switch (node.kind) {
      case "start":
      case "prompt":
      case "script":
      case "gate":
      case "end":
        return;
      default: {
        const exhaustive: never = node.kind;
        throw new Error(`Unsupported node kind: ${String(exhaustive)}`);
      }
    }
  }
}
