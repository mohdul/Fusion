# Soft-delete verification matrix

**Purpose:** Single source of truth for closing the FN-5105 / FN-5135 / FN-5137 / FN-5139 / FN-5140 / FN-5141 / FN-5142 / FN-5143 soft-delete stream.

**Success metric:** 0 reproducible cases where a soft-deleted task is runnable in scheduler / executor / merger / triage or visible in active dashboard queues after refresh or engine tick.

**Gate rule:** Every matrix row is GREEN or has a linked follow-up FN task before the stream is closed.

## Scenario matrix

| Scenario | Pre-state | API (REST) | Scheduler / Executor | Merger | Triage | Dashboard (SSE + initial load) | Agent logs | Documents | Owning FN |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Soft-delete a `triage` task with no `PROMPT.md` yet | Live `triage` row; task dir may exist without spec | `DELETE /api/tasks/:id` soft-deletes; later live readers 404 / omit; forensic store access still sees `deletedAt` row | Not dispatchable; auto-claim snapshots exclude it; executor entry points refuse if manually targeted | N/A | Active/queued triage abort + cleanup now asserted in the end-to-end composition backstop | SSE `task:deleted` removes it; reload keeps it absent from board/ListView/TodoView | Preserved until FN-5143 lands | No documents expected; document APIs still treat parent as absent once FN-5140 lands | FN-5105 / FN-5135 / FN-5137 / FN-5142 |
| 2. Soft-delete a `todo` task with dependencies pointing AT it | Live `todo`; other live tasks depend on it | Delete is 409 `TASK_HAS_DEPENDENTS` unless caller opts into `removeDependencyReferences`; retry succeeds and returns soft-deleted task | Deleted task is never redispatched; rewritten dependents keep running as live tasks | N/A | N/A | SSE removes deleted card; dependents reflect rewritten dependency state on refresh | Preserved until FN-5143 | Hidden from live readers once FN-5140 lands | FN-5105 / FN-5137 |
| 3. Soft-delete a `todo` task with lineage children | Live `todo`; `sourceParentTaskId` children exist | 409 lineage-child guard + removeLineageReferences retry path are asserted in composition backstop | Deleted parent never dispatches; rewritten children remain live | N/A | N/A | Delete/archive UI must surface confirm-retry flow once FN-5139 lands | Preserved until FN-5143 | Hidden from live readers once FN-5140 lands | FN-5139 |
| 4. Soft-delete an `in-progress` task with an active executor session | Live `in-progress`; executor owns active session | Delete succeeds; task vanishes from live readers immediately | Entry guards refuse reruns; active-session abort / dispose now asserted in composition backstop | N/A | N/A | SSE removes card; reload does not re-seed it into active queues | Preserved until FN-5143 | Hidden from live readers once FN-5140 lands | FN-5137 / FN-5142 |
| 5. Soft-delete an `in-progress` task with an active workflow-step session and reviewer subagent | Live `in-progress`; workflow step child session exists | Delete succeeds; no public recovery/undelete flag | New execution attempts refuse; workflow-step + reviewer cleanup covered in FN-5142 owning suite and composition backstop | N/A | N/A | SSE removes card; reload stays clean | Preserved until FN-5143 | Hidden from live readers once FN-5140 lands | FN-5142 |
| 6. Soft-delete an `in-review` task that is currently being merged | Live `in-review`; active merge session in flight | Delete succeeds; live readers omit afterward | Scheduler must not requeue it | Active merge abort, queue removal, and controller cleanup now asserted in composition backstop | N/A | SSE removes card; reload keeps it absent | Preserved until FN-5143 | Hidden from live readers once FN-5140 lands | FN-5142 |
| 7. Soft-delete an `in-review` task queued for merge but not yet active | Live `in-review`; merge queued only | Delete succeeds; row stays for forensics only | Scheduler/executor must not pick it up again | Merge queue filter assertion is now covered in composition backstop | N/A | SSE removes card; reload keeps it absent | Preserved until FN-5143 | Hidden from live readers once FN-5140 lands | FN-5137 / FN-5142 |
| 8. Soft-delete a `done` task with archived/visible agent logs and saved task documents | Live `done`; has task docs + agent logs | Delete succeeds; live task readers omit afterward; forensic reads still allowed internally | Not runnable after any engine tick or restart | N/A | N/A | SSE removes card; refresh does not show it in board/ListView/TodoView | `agentLogEntries` clear + empty readers asserted in composition backstop | `/api/documents` and per-task docs are hidden while DB rows remain, asserted in composition backstop | FN-5140 / FN-5143 |
| 9. Soft-delete an archived task | Task already archived / moved out of live `tasks` table | `DELETE /api/tasks/:id` returns **410 Gone** with `{ code: "TASK_ALREADY_HARD_ARCHIVED", taskId, archivedAt, message }`. Caller must `POST /api/tasks/:id/unarchive` first, then re-delete; archive-cleanup APIs remain the forensic-removal path. | Never affected; archived rows are absent from live scheduler/executor readers | N/A | N/A | No `task:deleted` SSE re-emit for this failure path; dashboard surfaces the 410 and points to unarchive | N/A | N/A | FN-5196 ✅ |
| 10. Soft-delete a task that is checked out by an agent (`checkedOutBy` set) | Live task with lease / checkout metadata | Delete succeeds; linked agent task references clear with delete | Soft-deleted checked-out task must not be auto-claimed or executed after refresh/tick; extra deterministic coverage filed as **FN-5195** | If merge-owned, FN-5142 owns active merge abort details | If triage-owned, FN-5142 owns active triage abort details | SSE removes card; refresh must not show stale checked-out task | Preserved until FN-5143 | Hidden from live readers once FN-5140 lands | FN-5137 / FN-5195 |

## ID reservation invariant

| Scenario set | Invariant | Evidence owner |
| --- | --- | --- |
| 1-10 | Soft-delete never frees the task ID. The `tasks` row persists with `deletedAt` set and allocators continue scanning all rows, so the ID is not reusable. | FN-5105 / FN-5128 |
| Re-delete of an already soft-deleted task | Second delete is a no-op: same `deletedAt`, no fresh event, ID still reserved. | FN-5127 / FN-5128 |

## Coverage gaps

| Scenario # | Layer | Existing coverage (file:line) | Gap | Proposed test file target | Owning FN |
| --- | --- | --- | --- | --- | --- |
| 1,4,7,10 | Scheduler invalidation on `task:deleted` | `packages/engine/src/__tests__/scheduler-auto-claim-invalidation.test.ts:31` | GREEN | — | FN-5137 |
| 1,4,7,10 | Executor `execute()` refusal of soft-deleted task | `packages/engine/src/__tests__/executor-soft-delete-guard.test.ts:50` | GREEN | — | FN-5137 |
| 4,5 | In-flight executor / workflow-step / reviewer abort on `task:deleted` | `packages/engine/src/__tests__/executor-soft-delete-abort.test.ts` + composition assertions in `packages/engine/src/__tests__/reliability-interactions/soft-delete-end-to-end.test.ts` | GREEN | — | FN-5142 |
| 6,7 | In-flight merge abort / merge queue filtering | `packages/engine/src/__tests__/project-engine-soft-delete-merge-abort.test.ts` + composition assertions in `packages/engine/src/__tests__/reliability-interactions/soft-delete-end-to-end.test.ts` | GREEN | — | FN-5142 |
| 1,10 | Triage abort on `task:deleted` | `packages/engine/src/__tests__/triage-soft-delete-abort.test.ts` + composition assertions in `packages/engine/src/__tests__/reliability-interactions/soft-delete-end-to-end.test.ts` | GREEN | — | FN-5142 |
| 8 | `agentLogEntries` cleared on soft-delete | `packages/core/src/__tests__/soft-delete-agent-logs.test.ts` + composition assertion in `packages/engine/src/__tests__/reliability-interactions/soft-delete-end-to-end.test.ts` | GREEN | — | FN-5143 |
| 8 | `/api/documents` and per-task docs exclude soft-deleted parents | `packages/core/src/__tests__/task-documents.test.ts` + composition assertion in `packages/engine/src/__tests__/reliability-interactions/soft-delete-end-to-end.test.ts` | GREEN | — | FN-5140 |
| 3 | Lineage-unlink 409 flow through API + UI | `packages/dashboard/src/__tests__/routes-tasks-ops.test.ts` (route/UI path) + composition store-level lineage guard assertion in `packages/engine/src/__tests__/reliability-interactions/soft-delete-end-to-end.test.ts` | GREEN for stream-close gating | — | FN-5139 |
| Stream-wide | `fn_task_delete` tool / skill terminology | No regression asserting soft-delete wording | Missing user-facing copy coverage | `packages/cli/src/__tests__/extension.test.ts` | FN-5141 |
| 1,4,6,7,8 | Dashboard SSE + reload deleted-task filtering | `packages/dashboard/src/__tests__/sse-task-deleted-payload.test.ts:5`; `packages/dashboard/app/hooks/__tests__/useTasks.test.ts:1124`; `packages/dashboard/app/hooks/__tests__/useTasks.test.ts:1147`; `packages/dashboard/app/hooks/__tests__/useTasks.test.ts:1255` | GREEN | — | FN-5135 |
| 4,10 | Cross-layer delete-during-execution / refresh convergence | No single composition backstop before this task | Added in this task | `packages/engine/src/__tests__/reliability-interactions/soft-delete-end-to-end.test.ts` | FN-5153 |
| 9 | Archived-task delete contract | `packages/core/src/__tests__/soft-delete-tasks.test.ts` (`throws TaskAlreadyHardArchivedError when deleting a hard-archived task`, `throws TaskAlreadyHardArchivedError for a legacy in-db archivedTasks row`) and `packages/dashboard/src/__tests__/routes-tasks-ops.test.ts` (`returns 410 TASK_ALREADY_HARD_ARCHIVED when deleteTask throws TaskAlreadyHardArchivedError`) | GREEN — pinned to typed `TaskAlreadyHardArchivedError` + HTTP 410 | — | FN-5196 |
| 10 | Checked-out-task soft-delete composition | Entry guards exist, but no coverage focused on checked-out deleted tasks | New follow-up filed | `packages/core/src/__tests__/soft-delete-tasks.test.ts` and `packages/engine/src/__tests__/auto-claim-snapshot-soft-delete.test.ts` | FN-5195 |

## Release-blocking checks

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm --filter @fusion/dashboard test:browser-smoke`
- Every scenario-matrix row is GREEN or has a linked follow-up FN task before the FN closing that row merges
- Soft-delete against a hard-archived task returns HTTP 410 with `code: TASK_ALREADY_HARD_ARCHIVED` and never silently succeeds (FN-5196)
- `packages/engine/src/__tests__/reliability-interactions/soft-delete-end-to-end.test.ts` is now fully un-skipped (closed by FN-5481) and remains a stream-close gate
- Manual smoke once on the live dashboard at port 4040: delete one `todo`, one `in-progress`, and one `in-review` task; refresh; confirm none reappear in any board column, ListView, or TodoView; confirm no SSE flicker re-adds the card
- `node scripts/audit-squash-merge.mjs <sha>` remains unaffected by any task in this stream

## Forensic access escape hatch

Supported forensic access is internal only:

- `readTaskFromDb(id, { includeDeleted: true })` in `packages/core/src/store.ts`
- direct SQL against `tasks`, `task_documents`, and `agentLogEntries`

No public API flag exposes deleted-task forensics today. Adding one requires a new FN with its own review.

## Out of scope

- Undelete UX / restore-from-trash flow — file a new FN if requested
- Hard-delete UI — file a new FN if requested
- Mission / feature / slice soft-delete — those entities do not use `deletedAt` today; file a new FN if requested
- Agent / node / secret soft-delete — file a new FN if requested

## Notes

- Store-level soft-delete invariants live in `packages/core/src/store.ts` (`ACTIVE_TASKS_WHERE`, `deleteTask`, `readTaskFromDb(..., { includeDeleted: true })`) and `packages/core/src/__tests__/soft-delete-tasks.test.ts`.
- Cross-reference `docs/storage.md` for the persisted-row model; FN-5140 and FN-5143 own the storage-doc deltas for document and agent-log visibility.