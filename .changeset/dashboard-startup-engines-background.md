---
"@runfusion/fusion": patch
---

Fix slow `fusion` startup that hung on "Starting engine…" while every registered project's engine initialized serially in `Promise.allSettled`. Engine startup now runs in the background — the TUI proceeds immediately, and the existing reconciliation loop plus the server's on-access fast path bring each project's engine up before it's actually needed.
