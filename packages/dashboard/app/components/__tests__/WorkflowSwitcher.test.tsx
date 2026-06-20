import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoardWorkflowDefinition } from "../../api";
import { WorkflowSwitcher } from "../WorkflowSwitcher";
import type { WorkflowStatusCounts } from "../workflowStatusCounts";

const workflows: BoardWorkflowDefinition[] = [
  {
    id: "coding",
    name: "Coding",
    columns: [],
  },
  {
    id: "design",
    name: "Design",
    columns: [],
  },
];

function countMap(entries: Array<[string, WorkflowStatusCounts]> = []) {
  return new Map<string, WorkflowStatusCounts>(entries);
}

describe("WorkflowSwitcher", () => {
  it("renders the active workflow with compact inline counts", () => {
    render(
      <WorkflowSwitcher
        workflows={workflows}
        value="coding"
        onChange={vi.fn()}
        counts={countMap([["coding", { todo: 3, inProgress: 1, done: 5 }]])}
      />,
    );

    const trigger = screen.getByTestId("workflow-switcher");
    expect(trigger).toHaveTextContent("Coding");
    expect(trigger).toHaveTextContent("3");
    expect(trigger).toHaveTextContent("1");
    expect(trigger).toHaveTextContent("5");
    expect(trigger).toHaveAccessibleName("Select workflow. Current workflow: Coding");
  });

  it("opens and closes the portaled listbox", () => {
    render(<WorkflowSwitcher workflows={workflows} value="coding" onChange={vi.fn()} counts={countMap()} />);

    fireEvent.click(screen.getByTestId("workflow-switcher"));
    expect(screen.getByRole("listbox", { name: "Workflow" })).toBeInTheDocument();
    expect(screen.getByTestId("workflow-switcher-option-coding")).toHaveAttribute("aria-selected", "true");

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox", { name: "Workflow" })).not.toBeInTheDocument();
  });

  it("calls onChange when an option is selected", () => {
    const onChange = vi.fn();
    render(<WorkflowSwitcher workflows={workflows} value="coding" onChange={onChange} counts={countMap()} />);

    fireEvent.click(screen.getByTestId("workflow-switcher"));
    fireEvent.click(screen.getByTestId("workflow-switcher-option-design"));

    expect(onChange).toHaveBeenCalledWith("design");
    expect(screen.queryByRole("listbox", { name: "Workflow" })).not.toBeInTheDocument();
  });

  it("supports keyboard navigation and escape dismissal", () => {
    const onChange = vi.fn();
    render(<WorkflowSwitcher workflows={workflows} value="coding" onChange={onChange} counts={countMap()} />);

    const trigger = screen.getByTestId("workflow-switcher");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("design");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox", { name: "Workflow" })).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Workflow" })).not.toBeInTheDocument();
  });

  it("renders zero counts for workflows absent from the counts map", () => {
    render(<WorkflowSwitcher workflows={workflows} value="coding" onChange={vi.fn()} counts={countMap()} />);

    fireEvent.click(screen.getByTestId("workflow-switcher"));
    const designOption = screen.getByTestId("workflow-switcher-option-design");

    expect(within(designOption).getByText("0", { selector: ".workflow-switcher-count--todo" })).toBeInTheDocument();
    expect(within(designOption).getByText("0", { selector: ".workflow-switcher-count--in-progress" })).toBeInTheDocument();
    expect(within(designOption).getByText("0", { selector: ".workflow-switcher-count--done" })).toBeInTheDocument();
  });
});
