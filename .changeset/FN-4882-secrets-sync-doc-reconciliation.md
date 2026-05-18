---
"@runfusion/fusion": patch
---

Reconcile docs/secrets.md and docs/architecture.md with the FN-4867 secrets sync surfaces that now ship (push/pull/receive/sync-export + fn_secret_get + secrets-env materialization), and add a reliability-interaction backstop for cross-node secrets sync route contracts.
