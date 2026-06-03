# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Merge lifecycle

### Task
The core board entity: a unit of work that moves through columns (triage, todo, in-progress, in-review, done, archived) and is executed by agents. A Task carries its own per-task settings that can override project-level defaults.

### Auto-merge
The named process that automatically lands a completed Task's branch onto its merge target once the Task reaches In-review and passes its merge blockers. Gated twice: a project-level setting enables it globally, and each Task may carry an explicit per-task override.

The per-task override takes precedence in both directions: an explicit per-task enable proceeds even when the global setting is off, and an explicit per-task disable routes the merge to Manual-required even when the global setting is on. Trigger-layer gates (enqueue, Self-healing sweeps) must evaluate additively — global on lets everything through for downstream routing; global off admits only explicit per-task enables — rather than collapsing the override to a single effective value, which would starve Manual-required routing.

### In-review
The Task status column between execution and completion: work is done and the branch awaits merging. An In-review Task either auto-merges, waits for a human merge (PR-based/manual flow), or surfaces a stall diagnostic when it sits unprocessed longer than expected. Tasks not eligible for Auto-merge processing intentionally remain In-review until a human acts — recovery sweeps must not move them.

### Merge queue
The ordered line of In-review Tasks awaiting Auto-merge, with a single merge active at a time. Tasks enter only through trigger gates (engine startup sweep, periodic retry, unpause, and the moved-to-review fast path); a Task filtered out at a gate is invisible to the merger regardless of its own settings.

### Manual-required
The merge-request state for a Task whose merge needs an explicit human go-ahead — typically a Task with auto-merge explicitly disabled under a globally-enabled project. Reaching this state requires the Task to flow through the Merge queue trigger gates; upstream filtering that excludes such Tasks strands them In-review instead of parking them here.

### Self-healing sweep
A recurring background scan that detects and repairs stuck Task states — stalled In-review Tasks, confirmed merges never finalized, ghost or limbo states, exhausted retries. Sweeps respect the same Auto-merge eligibility as the Merge queue: they may inspect any Task but mutate only those eligible for auto-merge processing.

### Shared branch group
A set of Tasks integrating into a common shared branch instead of each merging straight to the project's default branch. Member integration (task branch → shared branch) is a soft pre-integration step exempt from the global auto-merge gate; promotion (shared branch → default branch) is gated separately.

## Compound Engineering sessions

### CE Stage
A registered step of the compound-engineering pipeline (e.g. brainstorm, plan, work, compound), each mapped to a bundled skill and a conventional artifact location. Adding a stage is a registry data entry, not new code surface.

### CE Session
A single interactive run of a CE Stage: an agent drives a question/answer flow with the user and produces the stage's artifact on completion. Sessions are independent pipeline runs — many can exist concurrently, each with its own lifecycle (launching, active, awaiting-input, completed, error, interrupted) and conversation history. A completed work-stage CE Session lands derived Tasks on the board, linked back to the session for provenance.

### Detached turn
The execution posture for CE Session agent turns: the request that triggers a turn returns as soon as the session reflects it, and the turn runs in the background while clients converge through push events and polling. A detached turn never rejects — every failure persists into session state and emits an observable event, so progress is never silently lost.

### Live activity
The transient working output of an in-flight agent turn — accumulated thinking, streamed text, and tool execution markers. It is observable while the turn runs but is not session state; when the turn settles or is interrupted, a condensed trace is folded into the conversation history so the transcript keeps the story.

### Steering
The user's mid-stage feedback channel: free-text guidance attached to an answer, or sent on its own without answering the pending question. Agents treat steering as first-class input — incorporate it, adjust course, and either re-ask or proceed.

### Rehydration
Re-establishing a live agent handle for a paused CE Session by replaying its recorded conversation against the model. Replay is side-effect-suppressed: it reconstructs the agent's context without re-emitting events, re-streaming Live activity, or re-writing artifacts.

## Flagged ambiguities

- "Merging" a shared-branch-group Task had been used for both member integration and group promotion — these are distinct steps with independent gating and must not be conflated.
