---
"@runfusion/fusion": patch
---

fix(FN-5627): suppress ntfy notifications for transient merge failures the engine auto-recovers

Even with the FN-5627 merger TOCTOU fix + transient-failure self-healing sweep + safety-fallback auto-prerebase landed, the merger can still hit transient failure classes (lease handoff races, brief same-SHA non-FF advances) for tasks whose branches are particularly out-of-sync. The self-healing sweep auto-recovers them within bounded budget — but each individual failure cycle was firing a ntfy alarm before the recovery cleared the failed state, producing user-facing alarm spam for tasks that were never actually stuck.

Two layers of fix:

1. `NotificationService.handleTaskUpdated` now classifies `task.error` via the new shared `classifyTransientMergeError` helper before scheduling the deferred failure notification. Transient classes (`lease-handoff-target-not-queued`, `spurious-concurrent-advance-same-sha`) get logged as suppressed and never schedule a ntfy timer.

2. Defense-in-depth: `fireDeferredFailureNotification` re-classifies the error at dispatch time, so a failure scheduled before the suppression landed on a newer cycle still suppresses if the error matches a transient class.

The classifier itself moved from `self-healing.ts` to a new logger-free `transient-merge-error-classifier.ts` module so consumers in `NotificationService` don't pull `createLogger` through the import chain and break test mocks of `../logger.js`. `self-healing.ts` re-exports the symbol for backward compatibility.

Log prefix for the recovery actions also changed from `[FN-5627] Auto-recovering...` to `Auto-recovered:` so that `NotificationService.maybeSuppressTransientFailedNotification`'s existing `/^Auto-recovered:/` log-prefix check cancels any already-scheduled failure notification when the sweep runs mid-grace-window.

Tests:
- 3 new notification-service tests covering transient suppression for both error classes plus a control case ensuring genuine non-transient failures still notify.
- Existing transient-recovery tests in self-healing.test.ts continue to pass against the relocated classifier.
