---
"@runfusion/fusion": patch
---

Add near-duplicate intent guard at task intake: dashboard `POST /api/tasks`
now rejects new tasks whose route paths, file paths, or identifier tokens
substantially overlap with an existing active task created in the last 7
days, returning `409 duplicate_candidates` with `reason: "near-duplicate-intent"`.
Triage `finalizeApprovedTask` backstops with a File-Scope-aware re-check
after PROMPT.md is written, auto-archiving the loser with a
`sourceMetadata.nearDuplicateOf` lineage marker. Layered on top of the
FN-4918 deterministic and FN-4829 similarity gates; fails open on any error.
