---
"@runfusion/fusion": patch
---

Auto-continue the agent session after an engine-internal pause/resume abort instead of re-queueing the task to todo. When the engine tears down in-flight work (hard-cancel) and the workflow graph run ends with the task back in `todo`, the executor now retries the agent session in place — bounded by the existing graph-resume retry budget with backoff, falling back to a benign re-queue only after retries are exhausted. Before re-dispatching, it re-checks the task at fire time and aborts the auto-continue if the task was paused, moved, or deleted during the backoff window, so genuine user/global/task pauses are never resumed against the operator's intent. The transient reclassification clears any stale `failed` status and emits an `Auto-recovered:` log so no spurious failure notification fires.
