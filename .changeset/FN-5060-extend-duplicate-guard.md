---
"@runfusion/fusion": patch
---

Extend the FN-4918 deterministic duplicate guard to the remaining task-creation surfaces: CLI `fn task add` (direct-store, with a new `--no-dedup` flag), engine `createAgentTask` (powers `fn_task_create` and triage subtask splits — duplicate detections now report `Linked existing ...`), and mission feature triage (links to the canonical task on duplicate). Dashboard `POST /api/tasks` now consumes the same shared helper so behavior is identical across surfaces. `InlineCreateCard` gains the duplicate-warning modal already shipped on `QuickEntryBox`.
